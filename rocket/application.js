// Step 2 — the shape of a framework.
//
// The surprising part of Express is the first line of it: `app` is a *function*.
// Not an object with a handle method, a function you could pass straight to
// http.createServer. Everything else hangs off that decision.

import http from 'node:http';

export function createApplication() {
  // `app` is the request handler. In JavaScript a function is an object, so it can
  // carry methods of its own — and that is why `http.createServer(app)` works, and
  // why one app can later be mounted inside another.
  const app = (req, res) => app.handle(req, res);

  // The single entry point every request passes through. Right now it knows one
  // thing: it does not know anything. Step 3 gives it a route table.
  app.handle = (req, res) => {
    const message = `Cannot ${req.method} ${req.url}`;
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(message),
    });
    res.end(message);
  };

  // A thin wrapper. It exists so an application never has to mention node:http,
  // which is the seam we swap out in section 8 when the transport changes.
  app.listen = (...args) => http.createServer(app).listen(...args);

  return app;
}
