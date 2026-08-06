// Step 21 — two things the framework already did, rewritten as ordinary layers.
//
// This is the test of the interface built over the last four steps. If reading a
// body cannot be expressed as middleware, then middleware is not general enough to
// build a framework on, and the shape is wrong.
//
// Both of these are factories: you call them and they return the layer. That is one
// extra pair of brackets at the call site, and it is what lets a layer take options
// without the framework inventing a way to pass them.

import { read, parse, LIMIT } from './body.js';

// Reading the body stops being something every request pays for and becomes
// something an application asks for. A server with no POST routes now does no body
// work at all, and a path nobody registered is no longer read off the wire in full
// before the 404 — which is the cost step 15 named and could not fix at the time.
export function bodyParser({ limit = LIMIT } = {}) {
  return async (req, res, next) => {
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
