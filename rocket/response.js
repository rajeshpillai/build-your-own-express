// Step 13 — redirects, and the answer when there is no answer.
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

// A redirect is a status and a Location header, and nothing else. There is no body
// worth sending, because a client that follows redirects never shows it and a client
// that does not is a script reading the header.
//
// 302 by default, which means "look over there for now". 301 says "look over there
// from now on" and browsers cache it hard — get a 301 wrong in production and people
// keep hitting the old target long after you fix it. That is why the permanent one
// has to be asked for.
response.redirect = function redirect(location, code = 302) {
  this.writeHead(code, { Location: location, 'Content-Length': 0 });
  this.end();
};

// Step 25 — render a template, and send it as a page.
//
// The response does not know how to render. It is handed a function by the
// application, because the engine and the directory are the application's choice
// and this object exists once per request.
response.render = async function render(name, locals = {}) {
  const html = await this.app.render(name, locals);
  this.setHeader('Content-Type', 'text/html; charset=utf-8');
  return this.send(html);
};
