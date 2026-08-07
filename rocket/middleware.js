// Step 21 — two things the framework already did, rewritten as ordinary layers.
//
// This is the test of the interface built over the last four steps. If reading a
// body cannot be expressed as middleware, then middleware is not general enough to
// build a framework on, and the shape is wrong.
//
// Both of these are factories: you call them and they return the layer. That is one
// extra pair of brackets at the call site, and it is what lets a layer take options
// without the framework inventing a way to pass them.

import { read, parse, handles, LIMIT } from './body.js';
import { boundaryOf, parse as parseMultipart } from './multipart.js';

// Reading the body stops being something every request pays for and becomes
// something an application asks for. A server with no POST routes now does no body
// work at all, and a path nobody registered is no longer read off the wire in full
// before the 404 — which is the cost step 15 named and could not fix at the time.
export function bodyParser({ limit = LIMIT } = {}) {
  return async (req, res, next) => {
    // Decline what we cannot parse, without reading it. Reading consumes the
    // stream, so a layer registered after this one would find it empty. That is
    // exactly what happened the first time a real upload middleware was put
    // behind this parser.
    if (!handles(req.headers['content-type'])) return next();

    try {
      req.body = parse(await read(req, limit), req.headers['content-type']);
      next();
    } catch (error) {
      // Statuses are attached here rather than decided in the error handler,
      // because this layer is the only place that knows which failure happened.
      error.status = error.code === 'BODY_TOO_LARGE' ? 413 : 400;
      next(error);
    }
  };
}

// A logger runs for every request, including the ones no route matches, and it
// reports the status — which is not known until the response has finished.
// So it registers a listener and calls next immediately rather than waiting.
export function logger({ log = console.log } = {}) {
  return (req, res, next) => {
    const started = process.hrtime.bigint();

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      log(`${req.method} ${req.url} ${res.statusCode} ${ms.toFixed(1)}ms`);
    });

    next();
  };
}

// Step 21.1 — the layer that turns a multipart body into fields and files.
//
// Separate from bodyParser on purpose. Most requests are not uploads, and a server
// that never accepts one should not carry the code that handles them. It is also
// the honest shape: an upload has different limits, different failure modes and
// different storage than a JSON body, and pretending otherwise is how one
// configuration option becomes six.
export function multipart({ limit = LIMIT } = {}) {
  return async (req, res, next) => {
    const boundary = boundaryOf(req.headers['content-type']);
    if (!boundary) return next();

    try {
      const { fields, files } = parseMultipart(await read(req, limit), boundary);
      req.body = fields;
      req.files = files;
      req.file = files[0];
      next();
    } catch (error) {
      error.status = error.code === 'BODY_TOO_LARGE' ? 413 : 400;
      next(error);
    }
  };
}
