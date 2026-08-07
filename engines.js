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

import handlebars from 'handlebars';
import ejs from 'ejs';

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
export function hbs(source, locals) {
  return compiledBy(hbsCache, source, handlebars.compile)(locals);
}

// EJS uses <%= %>, and escapes on that form. <%- %> is the unescaped one, which
// is worth knowing because the difference is one character and one of them is a
// hole.
export function ejsRender(source, locals) {
  return compiledBy(ejsCache, source, (s) => ejs.compile(s))(locals);
}
