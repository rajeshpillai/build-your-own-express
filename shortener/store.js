// Step 26 — where the links live.
//
// A Map, not a database. Swapping this for one is a lesson about databases, and
// the course is about the framework — but the shape here is chosen so that swap
// would be small: three functions, all of them async, none of them leaking how the
// data is held.
//
// Async matters even though a Map is not. If these were synchronous, every handler
// that used them would be written synchronously, and the day the store became a
// real one every one of those handlers would have to change.

import { generate, isReserved } from './codes.js';

const links = new Map();

// Random codes collide, rarely, and a store that ignores that will one day hand
// two links the same address. So it asks for another one — and gives up after a
// few tries rather than looping forever, because a generator that has run out of
// space should fail loudly instead of hanging the request.
const ATTEMPTS = 5;

export async function create(target) {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const code = generate();
    if (links.has(code) || isReserved(code)) continue;

    // A real time, not a sequence number. Anything that wants to say "three
    // minutes ago" needs a moment to subtract from, and a counter is not one.
    links.set(code, { code, target, hits: 0, created: new Date().toISOString() });
    return links.get(code);
  }

  throw new Error(`could not find a free code after ${ATTEMPTS} attempts`);
}

export async function lookup(code) {
  return links.get(code);
}

// Counting the visit is a write on the read path, which is worth noticing. It is
// why a shortener that looks trivially cacheable is not.
export async function visit(code) {
  const link = links.get(code);
  if (!link) return undefined;
  link.hits += 1;
  return link;
}

export async function all() {
  return [...links.values()];
}
