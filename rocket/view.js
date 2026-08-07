// Step 25 — rendering a page, with a template engine you supply.
//
// The framework does not ship a template language, and that is the decision worth
// defending. A language means syntax, escaping rules, error messages and a
// compiler, none of which is what this course is about. What the framework owes
// you is smaller: somewhere to say which engine, where the files live, and one
// method that ties them together.
//
// That interface is a single function:
//
//   (source, locals) => string
//
// Anything matching it works, including the twenty-line one this step writes to
// prove the point.

import fsp from 'node:fs/promises';
import path from 'node:path';

// A deliberately small engine, so the seam is visible rather than buried in a
// dependency. Substitutes {{ name }} and nothing else. No conditionals, no loops
// and no partials, because each of those is a language decision this course is
// not making.
//
// It escapes by default. A template engine that does not is a cross-site scripting
// hole with a nice syntax, and the safe direction has to be the default one.
const ESCAPES = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function tiny(source, locals = {}) {
  return source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = key.split('.').reduce((o, k) => o?.[k], locals);
    if (value === undefined || value === null) return '';
    return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
  });
}

// Settings are a plain map with two readers, because app.set is the smallest thing
// that lets an application configure a framework without the framework inventing a
// configuration format.
export function views({ settings, cache }) {
  return async function render(name, locals = {}) {
    const dir = settings.get('views') ?? 'views';
    const engine = settings.get('view engine');

    if (typeof engine !== 'function') {
      throw new Error("no view engine set — app.set('view engine', fn)");
    }

    const file = path.join(path.resolve(dir), name);

    // Read once per file. A template read on every request is a disk hit per page
    // view, and the whole point of a cache here is that templates change when you
    // deploy rather than when a request arrives.
    if (!cache.has(file)) {
      cache.set(file, await fsp.readFile(file, 'utf8'));
    }

    return engine(cache.get(file), locals);
  };
}
