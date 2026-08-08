// Step 25.1 — two engines people actually use, on the seam from step 25.
//
// These live beside the application rather than inside rocket/, and that is the
// point rather than tidiness. The framework asked for one thing:
//
//   (source, locals) => string
//
// Anything of that shape works, so the adapter belongs to whoever chose the
// engine. rocket/ imports neither of these and still has no dependencies.
//
// The seam hands over source, not a compiled template, because caching the file
// read is the framework's job and compiling is the engine's. So each adapter
// keeps its own cache of compiled templates. A narrow interface does not stop an
// engine being fast; it decides where the speed is arranged.

import fs from 'node:fs';
import path from 'node:path';
import handlebars from 'handlebars';
import ejs from 'ejs';

// Step 28.2 — a real interface needs three things this seam cannot carry.
//
// render() hands over ONE file's source and gets ONE string back. A page with a
// shared shell, a repeated row and a formatted count needs a layout, partials and
// a helper, and none of those fit through that door.
//
// They do not have to. The engine already has all three, and this file is where
// the engine is configured. rocket/ gains nothing below, which is the point: the
// narrow seam did not limit the application, it moved the decision to the side
// that chose the engine.

const VIEWS = path.resolve('views');

// Read once, at startup. Templates change when you deploy, not when a request
// arrives — the same reasoning rocket/view.js uses for its own cache.
for (const file of fs.readdirSync(path.join(VIEWS, 'partials'))) {
  if (!file.endsWith('.hbs')) continue;
  const source = fs.readFileSync(path.join(VIEWS, 'partials', file), 'utf8');
  handlebars.registerPartial(path.basename(file, '.hbs'), source);
}

// "1 link" and "2 links". Small, but it is formatting, and formatting in a
// handler is how a template language starts leaking back into the application.
handlebars.registerHelper('plural', (n, word) =>
  `${n} ${word}${n === 1 ? '' : 's'}`);

// "3 minutes ago" rather than an ISO timestamp, because nobody reads one of those
// and subtracts. This is why store.js records a real time: a counter gives you
// nothing to subtract from.
//
// Deliberately coarse. A shortener does not need seconds, and rounding down means
// the label never claims more time has passed than actually has.
const MINUTE = 60_000;
const SCALE = [
  ['day', 24 * 60 * MINUTE],
  ['hour', 60 * MINUTE],
  ['minute', MINUTE],
];

handlebars.registerHelper('ago', (iso) => {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const elapsed = Date.now() - then;
  for (const [unit, size] of SCALE) {
    const n = Math.floor(elapsed / size);
    if (n >= 1) return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
});

const layout = handlebars.compile(
  fs.readFileSync(path.join(VIEWS, 'layout.hbs'), 'utf8'));

// One cache per engine, keyed on the source. The source is already cached by
// rocket/view.js, so the same string arrives every time and this hits.
const hbsCache = new Map();
const ejsCache = new Map();

function compiledBy(cache, source, compile) {
  let template = cache.get(source);
  if (!template) {
    template = compile(source);
    cache.set(source, template);
  }
  return template;
}

// Handlebars uses the same double braces tiny does, which is why one template
// file serves both. tiny is not a toy version of Handlebars — it just happens to
// have copied the least surprising syntax available.
//
// The page is rendered first, then dropped into the layout. Two compilations and
// one string out, so what rocket/ sees through the seam has not changed at all.
export function hbs(source, locals) {
  const body = compiledBy(hbsCache, source, handlebars.compile)(locals);
  return layout({ ...locals, body });
}

// EJS uses <%= %>, and escapes on that form. <%- %> is the unescaped one, which
// is worth knowing because the difference is one character and one of them is a
// hole.
export function ejsRender(source, locals) {
  return compiledBy(ejsCache, source, (s) => ejs.compile(s))(locals);
}
