// Step 29 — the harness, and the number it produces.
//
//   node bench/run.mjs            all three, in order
//   node bench/run.mjs rocket     just one
//   node bench/run.mjs --quick    two seconds each, for checking the harness works
//
// WHAT IS BEING COMPARED. One route, GET /users/:id, answering the same JSON
// through each server's own idea of how a response is written. Same machine,
// same generator, same handler. That is the only comparison this course makes.
//
// WHAT IS NOT BEING CLAIMED. autocannon is a Node process on the same cores as
// the server, so the load generator is part of what is being measured. These
// numbers are a ratio between three servers on one box, not a property of any of
// them. Run it on your own machine and the absolute figures will differ; the
// ordering is what has held.
//
// Every server is started fresh, given a moment to warm, measured, and killed.
// Running them in one process would let one warm the others' code paths.

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import autocannon from 'autocannon';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const SERVERS = [
  { name: 'node:http, by hand', file: 'raw.js', port: 3100 },
  { name: 'express', file: 'express.js', port: 3102 },
  { name: 'rocket', file: 'rocket.js', port: 3101 },
  { name: 'rocket on uWS', file: 'rocket-uws.js', port: 3103 },
];

const quick = process.argv.includes('--quick');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

// Ten seconds is long enough for the numbers to settle and short enough that
// nobody skips running it. Two connections short of fifty changes nothing; fifty
// is simply what the first measurement used, and changing it now would make the
// runs incomparable.
const DURATION = quick ? 2 : 10;
const CONNECTIONS = 50;

async function measure({ name, file, port }) {
  const child = spawn(process.execPath, [path.join(HERE, 'servers', file)], {
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });

  try {
    // Wait for the port rather than for a fixed delay: a fixed delay is either
    // too short on a loaded machine or wasted on an idle one.
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/users/1`);
        if (r.ok) break;
      } catch { /* not up yet */ }
      await sleep(50);
    }

    // A short unmeasured run first. The first few hundred requests through any
    // of these is the JIT compiling, and including that measures the warm-up.
    await autocannon({ url: `http://127.0.0.1:${port}/users/1`,
                       connections: 10, duration: 1 });

    const r = await autocannon({ url: `http://127.0.0.1:${port}/users/1`,
                                 connections: CONNECTIONS, duration: DURATION });

    return {
      name,
      rps: Math.round(r.requests.average),
      p99: r.latency.p99,
      non2xx: r.non2xx,
      errors: r.errors,
    };
  } finally {
    child.kill('SIGKILL');
  }
}

const wanted = only.length
  ? SERVERS.filter((s) => only.some((o) => s.file.startsWith(o) || s.name.includes(o)))
  : SERVERS;

const results = [];
for (const server of wanted) {
  process.stderr.write(`  measuring ${server.name} ...\n`);
  results.push(await measure(server));
}

// A run where anything answered with a non-2xx measured the wrong thing, and a
// table that does not say so is worse than no table.
const broken = results.filter((r) => r.non2xx > 0 || r.errors > 0);

const express = results.find((r) => r.name === 'express');

console.log();
console.log(`  ${DURATION}s, ${CONNECTIONS} connections, GET /users/:id -> JSON`);
console.log(`  node ${process.version}, ${process.platform}`);
console.log();
console.log('  server                   req/s      p99     vs express');
console.log('  ' + '-'.repeat(54));
for (const r of results) {
  const ratio = express ? (r.rps / express.rps).toFixed(2) + '×' : '—';
  console.log(
    `  ${r.name.padEnd(22)} ${String(r.rps).padStart(7)}  ${String(r.p99 + ' ms').padStart(7)}`
    + `  ${ratio.padStart(9)}`,
  );
}
console.log();

if (broken.length) {
  console.log('  THIS RUN IS NOT USABLE:');
  for (const r of broken) {
    console.log(`    ${r.name}: ${r.non2xx} non-2xx, ${r.errors} errors`);
  }
  process.exit(1);
}
