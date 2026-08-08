// Step 28.3 — the store the interface promised.
//
// Step 26 wrote this comment: "Async matters even though a Map is not. If these
// were synchronous, every handler that used them would be written synchronously,
// and the day the store became a real one every one of those handlers would have
// to change."
//
// This is that day, and the claim gets tested rather than repeated. The four
// functions below keep their names, their arguments and their return values.
// Nothing in app.js changes. Nothing in shortener/api.js changes. A promise that
// costs nothing to make and something to keep is worth keeping once in public.
//
// It is a JSON file, not a database. A database is a lesson about databases; what
// is being shown here is that the seam held.

import fsp from 'node:fs/promises';
import path from 'node:path';
import { generate, isReserved } from './codes.js';

// Overridable, because the checks need their own file and two test runs must not
// fight over one.
const FILE = path.resolve(process.env.LINKS_FILE ?? 'links.json');

const links = new Map();

// Read once, on the first call that needs it, and remember the promise rather
// than the result. Two requests arriving together then share one read instead of
// racing to do it twice.
let loading = null;

function load() {
  loading ??= (async () => {
    try {
      const raw = await fsp.readFile(FILE, 'utf8');
      for (const link of JSON.parse(raw)) links.set(link.code, link);
    } catch (error) {
      // A missing file is the first run, not a failure. Anything else is real.
      if (error.code !== 'ENOENT') throw error;
    }
  })();
  return loading;
}

// Writes are queued behind each other, and each one writes a temporary file and
// renames it over the real one.
//
// Both halves matter. Without the queue, two requests can interleave their writes
// and the file ends up holding one of them. Without the rename, a process that
// dies part way through a write leaves a half-written file where the links used
// to be — and rename on one filesystem is atomic, so a reader sees the old file
// or the new one and never a torn one.
let writing = Promise.resolve();

function save() {
  writing = writing.then(async () => {
    const temporary = `${FILE}.${process.pid}.tmp`;
    await fsp.writeFile(temporary, JSON.stringify([...links.values()], null, 2));
    await fsp.rename(temporary, FILE);
  });
  return writing;
}

const ATTEMPTS = 5;

export async function create(target) {
  await load();

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const code = generate();
    if (links.has(code) || isReserved(code)) continue;

    links.set(code, { code, target, hits: 0, created: new Date().toISOString() });
    await save();
    return links.get(code);
  }

  throw new Error(`could not find a free code after ${ATTEMPTS} attempts`);
}

export async function lookup(code) {
  await load();
  return links.get(code);
}

// Counting the visit was already a write on the read path. On a Map that cost
// nothing; on a file it costs a write per redirect, and that is the honest price
// of keeping the count. A real one would batch it, and batching is a lesson about
// durability rather than about frameworks.
export async function visit(code) {
  await load();
  const link = links.get(code);
  if (!link) return undefined;
  link.hits += 1;
  await save();
  return link;
}

export async function all() {
  await load();
  return [...links.values()];
}
