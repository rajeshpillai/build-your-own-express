// Step 3 — the framework can answer.
//
// `app` is still a function (step 2). What changed is that app.handle now consults
// a route table instead of always answering 404.

import http from 'node:http';
import { Router } from './router.js';
import { response } from './response.js';
import { read, parse } from './body.js';
import { run, isErrorHandler } from './chain.js';

// The verbs worth generating. `http.METHODS` has around forty, including LINK,
// UNLINK and three flavours of WebDAV lock, and generating all of them would put
// thirty-odd methods on every application that nobody will ever call.
//
// This is a judgement, not a rule: Express registers all of them. Seven covers what
// people write, and adding one later is a line in this array.
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

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
  // Step 19 — a route takes any number of layers, and the last one is only the
  // handler by convention. app.get('/x', authenticate, handler) is the same list
  // as app.get('/x', handler); one entry is not a special case.
  for (const method of METHODS) {
    app[method.toLowerCase()] = (path, ...handlers) => {
      router.add(method, path, handlers);
      return app;
    };
  }

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

  app.use = (fn) => {
    stack.push(fn);
    return app;
  };

  // Same reasoning as app.routes — the order is the meaning, so it is inspectable.
  app.stack = stack;

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

    if (!res.writableEnded) {
      res.status(500).send('Internal Server Error');
    }
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

    // Split the url into the part that routes and the part that does not.
    //
    // NOT url.parse. That is Node's legacy parser, and it now warns that its
    // behaviour is not standardised and prone to errors with security implications.
    // The WHATWG URL parser is the replacement, and it needs an absolute url —
    // hence the throwaway base, which is never used for anything but satisfying it.
    const parsed = new URL(req.url, 'http://localhost');
    req.path = parsed.pathname;
    req.query = Object.fromEntries(parsed.searchParams);

    // The body is read before routing, so a handler can treat req.body as a value
    // rather than an event. That also means a request to a path nobody registered
    // is still read off the wire in full — which is the door step 16 closes.
    try {
      req.body = parse(await read(req), req.headers['content-type']);
    } catch (error) {
      // Two different failures, and answering both with the same status would be
      // lying to the client about which one it caused. Too large is 413; a body
      // that contradicts its own Content-Type is 400.
      if (error.code === 'BODY_TOO_LARGE') {
        // Stop the sender, but only once the answer is actually out. Destroying
        // the socket any earlier throws the 413 away with it, and the client is
        // left with a reset connection and no idea which request was wrong.
        // Waiting for 'finish' is what makes the refusal legible instead of a
        // dropped call.
        res.on('finish', () => req.destroy());
        res.status(413).send('Body too large');
        return;
      }

      // A malformed body is the client's mistake, and answering 400 is the
      // framework declining to guess. Throwing here would take the process down
      // over a request anybody can send.
      res.status(400).send('Invalid body');
      return;
    }

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

    const match = router.find(req.method, req.path);

    if (!match) {
      // The response now has methods, so the framework's own last resort uses them
      // like any handler would. If send is broken, this is broken too, which is the
      // right coupling — there should not be a second way to write a response.
      res.status(404).send(`Cannot ${req.method} ${req.url}`);
      return;
    }

    // Everything the router learned while matching is attached to the request,
    // which is why a handler can read req.params without being passed anything
    // extra. The request object is the shared surface a framework decorates on the
    // way past.
    req.params = match.params;

    // Step 19 — the route's own layers go through the SAME chain as the app-level
    // stack. That is the whole fix.
    //
    // The draft this course is built from ran route middleware as
    // `m(req, res, () => {})` — every layer, unconditionally, with a next that did
    // nothing. So a route guard could refuse a request and the handler would run
    // anyway. App-level middleware short-circuited correctly and route-level did
    // not, which is the worst version of the bug: the mechanism looks present and
    // is decorative on exactly the layer people reach for to protect a route.
    //
    // Reusing run() means there is one implementation of next in the framework. A
    // second one is a second place for the two to disagree.
    try {
      await run(match.route.handlers, req, res);
    } catch (error) {
      // A route layer that throws reaches the same error handlers as an app-level
      // one. Two different destinations for the same failure would mean an
      // application had to write its logging twice.
      await fail(error, req, res);
      return;
    }

    // Every layer called next and none of them answered, so the route declined the
    // request. Falling through to the 404 is the honest reading — the route matched
    // the path but nothing was willing to handle it.
    if (!res.writableEnded) {
      res.status(404).send(`Cannot ${req.method} ${req.url}`);
    }
  };

  app.listen = (...args) => http.createServer(app).listen(...args);

  return app;
}
