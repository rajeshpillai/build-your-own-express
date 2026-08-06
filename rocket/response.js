// Step 11 — send takes more than a string.
//
// An application sends HTML, JSON and occasionally raw bytes, and having to pick
// the content type by hand every time is the thing res.send exists to remove. So
// send looks at what it was given and decides.
//
// This is a guess, and guesses are worth being explicit about. A string that starts
// with a bracket really is usually HTML. It is not always, and step 12 gives you
// res.json for when you want to say so rather than be inferred at.

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
