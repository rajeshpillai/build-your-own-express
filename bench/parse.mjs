// Step 33 — what the two ways of reading a url actually cost.
//
//   node bench/parse.mjs
//
// The harness in run.mjs measures a whole server, which means it also measures the
// load generator, the kernel, and whatever else your machine is doing. That is the
// right tool for "is this framework faster than Express" and the wrong one for "is
// this line worth changing": the noise is larger than the effect.
//
// So this measures the line. No sockets, no load generator, one operation in a
// loop. The absolute nanoseconds still move between runs and between machines —
// they are timings, not counts. The ratio is what holds, and it is large.
//
// WHAT IS BEING COMPARED. Both produce the path, and both can produce the query.
// The difference is how much work a request with no query string pays for. One
// of the three urls below has one, so the second figure is not a best case.

const N = 500_000;
const WARM = 50_000;

// Three urls rather than one, so the loop cannot fold a single constant away.
const URLS = ['/users/42', '/links/abc', '/users/7?full=1'];

function time(label, fn) {
  for (let i = 0; i < WARM; i++) fn(URLS[i % URLS.length]);
  const started = process.hrtime.bigint();
  let sink = 0;
  for (let i = 0; i < N; i++) sink += fn(URLS[i % URLS.length]).length;
  const ns = Number(process.hrtime.bigint() - started) / N;
  const shown = `${ns.toFixed(0)}`.padStart(5);
  console.log(`  ${label.padEnd(30)} ${shown} ns   (checksum ${sink})`);
  return ns;
}

const runs = N.toLocaleString('en-US');
console.log(`\n  ${runs} iterations each, node ${process.version}\n`);

const parsed = time('new URL, query built', (url) => {
  const u = new URL(url, 'http://localhost');
  const query = Object.fromEntries(u.searchParams);
  return u.pathname + Object.keys(query).length;
});

const split = time('indexOf, query if present', (url) => {
  const mark = url.indexOf('?');
  if (mark === -1) return url + Object.keys({}).length;
  const path = url.slice(0, mark);
  const query = Object.fromEntries(new URLSearchParams(url.slice(mark + 1)));
  return path + Object.keys(query).length;
});

const ratio = (parsed / split).toFixed(0);
console.log(`\n  the parser costs ${ratio}x the split, on this run\n`);
