// Step 9 — giving the response object methods of its own.
//
// Until now a handler got Node's response exactly as Node made it, so every route
// wrote its own writeHead and its own end. That is three decisions per route that
// are the same in almost every route.
//
// The trick Express uses, and the one worth understanding, is the prototype chain.

import http from 'node:http';

// An object whose OWN prototype is Node's response prototype. Anything we put here
// is found before Node's version, and anything we do not define still resolves to
// Node's — writeHead, end, setHeader and the rest all keep working untouched.
export const response = Object.create(http.ServerResponse.prototype);

response.send = function send(body) {
  // Content-Length from body.length. Step 10 is entirely about why that is wrong,
  // and it is left wrong here on purpose so the failure can be seen before it is
  // explained. Do not copy this line.
  this.writeHead(this.statusCode || 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
  });
  this.end(body);
};
