// Step 3 — the framework can answer.
//
// `app` is still a function (step 2). What changed is that app.handle now consults
// a route table instead of always answering 404.

import http from 'node:http';
import { Router } from './router.js';

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
  for (const method of METHODS) {
    app[method.toLowerCase()] = (path, handler) => {
      router.add(method, path, handler);
      return app;
    };
  }

  // Exposed on purpose. Printing your own route table is the fastest way to see
  // what a framework thinks you asked for.
  app.routes = router.routes;

  app.handle = (req, res) => {
    const route = router.find(req.method, req.url);

    if (!route) {
      const message = `Cannot ${req.method} ${req.url}`;
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': Buffer.byteLength(message),
      });
      res.end(message);
      return;
    }

    // The handler gets Node's own req and res. There is no res.send yet, so an
    // application still calls res.end itself. Section 3 fixes that.
    route.handler(req, res);
  };

  app.listen = (...args) => http.createServer(app).listen(...args);

  return app;
}
