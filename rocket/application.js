// Step 3 — the framework can answer.
//
// `app` is still a function (step 2). What changed is that app.handle now consults
// a route table instead of always answering 404.

import http from 'node:http';
import { Router, METHODS } from './router.js';
import { response } from './response.js';
import { run, isErrorHandler } from './chain.js';
import { views } from './view.js';

export function createApplication() {
  const app = (req, res) => app.handle(req, res);
  const router = new Router();

  // Step 4 — one loop instead of one method per verb.
  //
  // Registering a route is data going into a table, not a branch being added to the
  // function that serves every request. And since every verb does the identical
  // thing, writing app.get, app.post and app.put by hand would be three chances to
  // typo the same four lines.
  //
  // Returning `app` is what makes app.get(…).post(…) chain. It costs one word and
  // it is the difference between an API people enjoy and one they tolerate.
  // Step 23 — registration is now a pass-through to the router's own methods.
  // One table, one set of verbs, and the application returns itself so that
  // app.get(...).post(...) still chains the way it has since step 4.
  for (const method of METHODS) {
    app[method.toLowerCase()] = (path, ...handlers) => {
      router[method.toLowerCase()](path, ...handlers);
      return app;
    };
  }

  // Step 25 — app.get is now two functions wearing one name.
  //
  // With a path and a handler it registers a route, as it has since step 3. With
  // a single string it reads a setting. Express does exactly this and it is a
  // wart: the meaning of a call depends on how many arguments you passed, which
  // no signature tells you and no editor can warn you about.
  //
  // It is matched here anyway, because a viewer who learns app.get('views') on
  // this framework and then meets it in Express should find it behaves the same.
  const registerGet = app.get;
  app.get = (...args) =>
    (args.length === 1 && typeof args[0] === 'string'
      ? settings.get(args[0])
      : registerGet(...args));

  // Exposed on purpose. Printing your own route table is the fastest way to see
  // what a framework thinks you asked for.
  app.routes = router.routes;

  // Step 17 — the stack. Middleware is a list, in registration order, and every
  // entry has the same shape as a handler with one extra argument:
  //
  //     (req, res, next) => { … }
  //
  // That third argument is the whole design. A handler is the end of the line; a
  // middleware is a link in it, and next is how it says "I am done, carry on".
  const stack = [];

  // Step 24 — use takes an optional prefix, and that one extra argument is the
  // whole of mounting.
  //
  // A mounted layer sees a path with the prefix removed. That is not a
  // convenience: it is what lets a router be written once, with no knowledge of
  // where it will hang, and then mounted at /api or /v2 or nowhere at all. A
  // router that had to know its own prefix would not be a unit.
  app.use = (first, ...rest) => {
    if (typeof first === 'function') {
      stack.push(first);
      return app;
    }

    const prefix = first.endsWith('/') ? first.slice(0, -1) : first;

    for (const fn of rest) {
      stack.push((req, res, next) => {
        // Match on a boundary, not on a prefix. Without the second test, mounting
        // at /api would also capture /apiary — which is the same mistake the
        // static layer makes if it compares without a separator.
        if (req.path !== prefix && !req.path.startsWith(prefix + '/')) {
          return next();
        }

        // Strip the prefix for the duration of this layer, and put it back
        // afterwards. Restoring matters: a later layer, or the 404, would
        // otherwise report the shortened path and name an address the client
        // never asked for.
        const full = req.path;
        req.path = full.slice(prefix.length) || '/';
        req.baseUrl = prefix;

        const restore = (error) => {
          req.path = full;
          next(error);
        };

        const result = fn(req, res, restore);
        if (result && typeof result.then === 'function') result.catch(restore);
      });
    }

    return app;
  };

  // Same reasoning as app.routes — the order is the meaning, so it is inspectable.
  app.stack = stack;

  // Step 25 — settings, which is the smallest thing that lets an application
  // configure the framework without the framework inventing a config format.
  const settings = new Map();
  const templates = new Map();

  app.set = (key, value) => {
    settings.set(key, value);
    return app;
  };

  app.render = views({ settings, cache: templates });

  // Step 20 — where a failure goes. The error handlers are the four-argument
  // layers, in the order they were registered, and they get one attempt each.
  //
  // If none of them answers, the framework does. A 500 with no detail is not
  // laziness: the error may carry a stack trace, a query or a key, and deciding
  // that a stranger should see it is the application's call, never the
  // framework's.
  const fail = async (error, req, res) => {
    const handlers = stack.filter(isErrorHandler);

    try {
      await run(handlers, req, res, error);
    } catch {
      // An error handler that itself threw. There is nowhere left to send it, and
      // trying again would be a loop.
    }

    if (res.writableEnded) return;

    // A layer may attach a status to say which failure it caused — the body parser
    // does, because it is the only place that knows the difference between a body
    // that was too big and one that contradicted its own header. Anything else is
    // a 500, with no detail: the error may carry a stack trace or a key, and
    // deciding a stranger may read those is the application's call.
    const status = Number.isInteger(error?.status) ? error.status : 500;

    // A client still uploading when it is refused would otherwise keep streaming
    // into a request nobody is reading. Stop it, but only once the answer is out.
    if (error?.code === 'BODY_TOO_LARGE') res.on('finish', () => req.destroy());

    res.status(status).send(status === 500 ? 'Internal Server Error' : error.message);
  };

  // Step 15 — handle is async now, because the body arrives over time.
  //
  // Every request waits for its own body before a handler runs, including the ones
  // that carry none. A GET with no body resolves on the next tick, so the cost is
  // an await rather than a wait — but it is not nothing, and step 21 makes this
  // opt-in middleware for exactly that reason.
  app.handle = async (req, res) => {
    // Re-point the response at our prototype. Node made this object; we are adding to
    // it on the way past, which is the same thing the router does to the request.
    Object.setPrototypeOf(res, response);

    // The response needs a way back to the application to reach the renderer,
    // because the engine and the views directory belong to the application and
    // this object is made fresh for every request.
    res.app = app;

    // Split the url into the part that routes and the part that does not.
    //
    // NOT url.parse. That is Node's legacy parser, and it now warns that its
    // behaviour is not standardised and prone to errors with security implications.
    // The WHATWG URL parser is the replacement, and it needs an absolute url —
    // hence the throwaway base, which is never used for anything but satisfying it.
    const parsed = new URL(req.url, 'http://localhost');
    req.path = parsed.pathname;
    req.query = Object.fromEntries(parsed.searchParams);

    // Step 21 — the body is no longer read here. It is read by a layer, if an
    // application asks for one. A server with no POST routes now does no body work
    // at all, and an unregistered path is no longer read off the wire in full
    // before the 404.

    // Step 18 — the stack runs as a chain now, so a middleware that does not call
    // next stops everything after it. That is not an error case: authentication,
    // caching and rate limiting are all "answer now, and do not route this".
    //
    // The await below therefore never settles for a short-circuited request, which
    // is exactly right — the code after it must not run.
    try {
      await run(stack, req, res);
    } catch (error) {
      await fail(error, req, res);
      return;
    }

    // Step 23 — the application no longer dispatches. It asks the router, which
    // is now a layer like any other, and answers 404 only if the router declined.
    await new Promise((resolve) => {
      router.handle(req, res, (error) => {
        if (error) fail(error, req, res).then(resolve);
        else if (!res.writableEnded) {
          res.status(404).send(`Cannot ${req.method} ${req.url}`);
          resolve();
        } else resolve();
      });
    });
  };

  app.listen = (...args) => http.createServer(app).listen(...args);

  return app;
}
