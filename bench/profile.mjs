// Step 33 — where the time actually goes, rather than where we assume.
//
//   node bench/profile.mjs
//
// Guessing which line is slow is how people spend an afternoon optimising something
// that was never the problem. Node ships a sampling profiler; this drives it.
//
// It starts the framework's own bench server under --cpu-prof, points a load
// generator at it, exits cleanly so the profile is written, and prints the frames
// where the program actually sat. The process must exit NORMALLY: a profile is
// written on exit, and a killed process leaves nothing behind.
//
// Samples are a statistical picture, so small percentages move between runs. The
// ordering of the top few frames is what to read.

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { readdirSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import autocannon from 'autocannon';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, '.profile');
const PORT = 3190;

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });

// A server that stops on its own, because --cpu-prof only writes on a clean exit.
const child = spawn(process.execPath,
  ['--cpu-prof', `--cpu-prof-dir=${DIR}`, path.join(HERE, 'servers', 'rocket.js')],
  { env: { ...process.env, PORT: String(PORT), BENCH_EXIT_MS: '14000' },
    stdio: 'ignore' });

await sleep(700);
console.log('\n  profiling under load for 8 seconds ...');
await autocannon({
  url: `http://localhost:${PORT}/users/42`, connections: 50, duration: 8,
});

// It stops itself; waiting is how the profile gets written.
//
// The exitCode test is not defensive noise. If the load generator takes longer
// than the server's own timeout, the child has already gone by the time this
// line runs, 'exit' has already fired, and once() would wait for an event that
// is never coming again. That hung twice before this guard existed.
if (child.exitCode === null && child.signalCode === null) {
  await new Promise((resolve) => child.once('exit', resolve));
}
await sleep(300);

const file = readdirSync(DIR).find((f) => f.endsWith('.cpuprofile'));
if (!file) {
  console.error('  no profile written — the server did not exit cleanly');
  process.exit(1);
}

const profile = JSON.parse(readFileSync(path.join(DIR, file), 'utf8'));
const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();

for (const id of profile.samples) {
  const node = nodes.get(id);
  if (!node) continue;
  const { functionName, url } = node.callFrame;
  const where = url ? url.split('/').pop() : '(node)';
  const key = `${where}:${functionName || '(anonymous)'}`;
  self.set(key, (self.get(key) ?? 0) + 1);
}

const total = [...self.values()].reduce((a, b) => a + b, 0);
const ranked = [...self.entries()].sort((a, b) => b[1] - a[1]);

console.log(`\n  ${total.toLocaleString('en-US')} samples\n`);
console.log('  where the program sat');
console.log('  ' + '-'.repeat(52));
for (const [key, count] of ranked.slice(0, 10)) {
  console.log(`  ${((100 * count) / total).toFixed(1).padStart(5)}%  ${key}`);
}

const OURS = /^(application|router|response|chain)\.js:/;
const ours = ranked.filter(([key]) => OURS.test(key));
console.log('\n  and of that, our own code');
console.log('  ' + '-'.repeat(52));
for (const [key, count] of ours.slice(0, 6)) {
  console.log(`  ${((100 * count) / total).toFixed(1).padStart(5)}%  ${key}`);
}
console.log();
