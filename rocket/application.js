// Step 3 — the framework can answer.
//
// `app` is still a function (step 2). What changed is that app.handle now consults
// a route table instead of always answering 404.

import http from 'node:http';
import { Router } from './router.js';

export function createApplication() {
  const app = (req, res) => app.handle(req, res);
  const router = new Router();

  // Registering a route is now data going into a table, not a branch being added
  // to the function that serves every request.
  //
  // Returning `app` is what makes app.get(…).get(…) chain. It costs one word and
  // it is the difference between an API people enjoy and one they tolerate.
  app.get = (path, handler) => {
    router.add('GET', path, handler);
    return app;
  };

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
