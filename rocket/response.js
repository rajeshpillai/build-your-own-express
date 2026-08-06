// Step 12 — saying what you mean, and saying it in one expression.
//
// An application sends HTML, JSON and occasionally raw bytes, and having to pick
// the content type by hand every time is the thing res.send exists to remove. So
// send looks at what it was given and decides.
//
// send's type sniffing is a guess. json and status are how an application says what
// it means instead of being inferred at, and both return `this` so they compose into
// the one line people actually want to write.

import http from 'node:http';

export const response = Object.create(http.ServerResponse.prototype);

response.send = function send(body) {
  let payload = body;
  let type = 'text/plain; charset=utf-8';

  if (Buffer.isBuffer(body)) {
    // Already bytes. Nothing to encode, and no charset to claim — we do not know
    // what these bytes are, only that they are bytes.
    type = 'application/octet-stream';
  } else if (typeof body === 'object' && body !== null) {
    payload = JSON.stringify(body);
    type = 'application/json; charset=utf-8';
  } else {
    payload = String(body);
    if (/^\s*</.test(payload)) {
      type = 'text/html; charset=utf-8';
    }
  }

  this.writeHead(this.statusCode || 200, {
    'Content-Type': this.getHeader('Content-Type') ?? type,
    'Content-Length': Buffer.byteLength(payload),
  });
  this.end(payload);
};

// Explicit beats inferred. An empty array, a string of digits, or null are all things
// send would have guessed wrong about, and all things an API returns.
response.json = function json(body) {
  this.setHeader('Content-Type', 'application/json; charset=utf-8');
  return this.send(JSON.stringify(body));
};

// Returns `this`, which is the whole point. Without it, setting a status and sending
// a body are two statements about the same response that do not look related:
//
//   res.statusCode = 404;
//   res.send('not found');
//
// With it, they are one:  res.status(404).send('not found')
//
// Node already has a statusCode property. This does not replace it — it sets it and
// hands the response back, so both styles keep working.
response.status = function status(code) {
  this.statusCode = code;
  return this;
};
