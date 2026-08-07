// Step 29 — the same framework, on a different transport.
//
// Everything above this file is written against two objects: a request with a
// url, a method and headers, and a response that can set a status, set headers
// and end. Neither of those is specific to node:http. They are just the shapes
// the framework agreed to use.
//
// uWebSockets.js is a C++ server with its own request and response objects, and
// they do not look like Node's. So this file translates. Nothing in the router,
// the response prototype, the middleware chain or any application changes.
//
// What is NOT handled here, and each is a step of its own because each is a real
// problem rather than a detail:
//
//   writing safely    uWS warns that writes belong inside a corked callback,
//                     and it means it. Anything that pipes a stream into the
//                     response — the static layer, for one — has nothing to pipe
//                     into. That is step 31.
//
// GET routes work today, which is enough to prove the shapes translate.

import uWS from 'uWebSockets.js';

// uWS gives the handler its own request object. This presents it as the one the
// framework expects, reading each field from uWS as it is asked for.
function requestFrom(uwsReq, uwsRes, method) {
  // Step 30 — every field is read NOW, before this function returns.
  //
  // uWS reuses its request object. The moment the handler returns it belongs to
  // the next request, and reading getUrl() after that gives you whatever arrived
  // since — not an error, not undefined, but a real url belonging to somebody
  // else. Our handle is asynchronous, so it always returns before a route runs.
  //
  // Keeping a reference and reading lazily is the obvious way to write this
  // adapter and it is wrong under load and correct on your laptop, which is the
  // worst combination a bug can have.
  const url = uwsReq.getUrl() + (uwsReq.getQuery() ? '?' + uwsReq.getQuery() : '');

  const headers = {};
  uwsReq.forEach((k, v) => { headers[k] = v; });

  const req = { url, method, headers };

  // The body does not arrive with the headers, exactly as it does not on
  // node:http. uWS delivers it through onData rather than through a stream, so
  // this presents it as the two events the framework already knows: one per
  // chunk, and one at the end.
  //
  // onData must be attached here, synchronously, for the same reason the fields
  // are read here. Attaching it after an await is attaching it to the next
  // request.
  const listeners = { data: [], end: [], error: [] };

  req.on = (event, fn) => {
    if (listeners[event]) listeners[event].push(fn);
    return req;
  };
  // Nothing in the framework pauses a uWS request, but the size limit calls it
  // and a missing method is a crash rather than a slower response.
  req.pause = () => req;
  req.resume = () => req;

  uwsRes.onData((chunk, isLast) => {
    // The buffer uWS hands over is reused after this callback returns, so it is
    // copied rather than kept. Holding it gives you a body that changes shape
    // between the read and the parse.
    if (chunk.byteLength) {
      const copy = Buffer.from(Buffer.from(chunk));
      for (const fn of listeners.data) fn(copy);
    }
    if (isLast) for (const fn of listeners.end) fn();
  });

  return req;
}

// The response side. The framework calls writeHead, setHeader, getHeader and end,
// so those are what this provides. uWS wants the status as text and headers one
// at a time, which is the whole of the difference.
function responseFrom(uwsRes) {
  const headers = new Map();
  // Set the moment the client goes away. Writing to a dead connection in uWS is
  // not a no-op the way it is in Node — it is a crash — so every write has to ask
  // first.
  let aborted = false;
  let headSent = false;
  let waitingForDrain = false;

  const res = {
    statusCode: 200,
    writableEnded: false,

    setHeader(name, value) {
      headers.set(String(name), String(value));
      return res;
    },
    getHeader(name) { return headers.get(String(name)); },
    removeHeader(name) { headers.delete(String(name)); },

    writeHead(status, extra) {
      res.statusCode = status;
      for (const [k, v] of Object.entries(extra ?? {})) headers.set(k, String(v));
      return res;
    },

    // Step 31 — the status and the headers go out once, before any body, and
    // only inside a cork. uWS warns about an uncorked write and it means it:
    // each write outside a cork is its own packet, so a status, six headers and
    // a body leave as eight. Corking batches them into one.
    sendHead() {
      if (headSent) return;
      headSent = true;
      const text = STATUS[res.statusCode] ?? '';
      uwsRes.writeStatus(`${res.statusCode} ${text}`.trim());

      // Content-Length is skipped deliberately. The framework computes one
      // because node:http will not, and uWS computes its own from the bytes it
      // is handed. Sending both puts the header in the response twice, which is
      // not a warning anywhere — it is simply wrong, and a client is entitled to
      // reject it. The first port of this file sent both.
      for (const [k, v] of headers) {
        if (k.toLowerCase() === 'content-length') continue;
        uwsRes.writeHeader(k, v);
      }
    },

    // Step 31 — writing in pieces, which is what a stream does.
    //
    // The return value is back pressure: false means the socket has taken all it
    // will for now, and a writer that respects it stops until drain. A stream
    // piped into this does that automatically.
    //
    // Be precise about what ignoring it costs, because it is easy to overstate.
    // The client still receives every byte — uWS buffers the remainder itself.
    // What it costs is that buffer: the server holds the rest of the file in
    // memory instead of letting the socket meter it out. Measured here: a three
    // megabyte file to a rate-limited client arrives complete either way, so a
    // check on the bytes cannot tell the two apart. The difference is memory,
    // and this is the line that decides whose.
    write(chunk) {
      if (res.writableEnded || aborted) return false;
      let ok = true;
      uwsRes.cork(() => {
        res.sendHead();
        ok = uwsRes.write(chunk);
      });
      if (!ok) waitingForDrain = true;
      return ok;
    },

    end(body = '') {
      if (res.writableEnded || aborted) return res;
      res.writableEnded = true;
      uwsRes.cork(() => {
        res.sendHead();
        uwsRes.end(body);
      });
      for (const fn of finished) fn();
      return res;
    },

    // Enough of a writable stream for pipe() to work. A read stream asks for
    // these by name, and a missing one is a crash rather than a slow response.
    once(event, fn) { return res.on(event, fn); },
    emit() { return false; },
    destroy() { res.writableEnded = true; return res; },
    get writable() { return !res.writableEnded && !aborted; },

    // A logger asks to be told when the response is over, and a piped stream
    // asks to be told when it may write again. Both contracts are the
    // framework's rather than Node's, so both have to exist here.
    on(event, fn) {
      if (event === 'finish' || event === 'close') finished.push(fn);
      if (event === 'drain') drained.push(fn);
      return res;
    },
    removeListener() { return res; },
  };

  const finished = [];
  const drained = [];

  // uWS says the socket will take more by calling this. That is the other half
  // of back pressure: without it a paused stream stays paused for ever and the
  // download simply stops half way, with nothing reporting an error.
  uwsRes.onWritable(() => {
    if (waitingForDrain) {
      waitingForDrain = false;
      for (const fn of drained) fn();
    }
    return true;
  });

  // uWS refuses to let a handler return without either answering or saying it
  // knows the connection may vanish first. That is not a nuisance: node:http
  // lets you write to a socket nobody is listening to and simply drops it, and
  // uWS makes you acknowledge the case instead.
  //
  // Our handler is asynchronous, so it always returns before answering. Every
  // request therefore needs this, and the framework only found out because uWS
  // aborted the process rather than warning.
  uwsRes.onAborted(() => { aborted = true; res.writableEnded = true; });

  return res;
}

// uWS writes the status line itself, so it wants the text as well as the number.
// Only the ones this framework produces; anything else goes out as a bare code,
// which is legal.
const STATUS = {
  200: 'OK', 201: 'Created', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  413: 'Payload Too Large', 415: 'Unsupported Media Type',
  500: 'Internal Server Error',
};

/**
 * Start an application on uWebSockets.js.
 *
 * The signature matches app.listen so an application changes one word to move
 * between transports and nothing else.
 */
export function listen(app, port, callback) {
  const server = uWS.App();

  server.any('/*', (uwsRes, uwsReq) => {
    const method = uwsReq.getMethod().toUpperCase();
    const req = requestFrom(uwsReq, uwsRes, method);
    const res = responseFrom(uwsRes);

    app.handle(req, res);
  });

  server.listen(Number(port), (token) => {
    if (!token) throw new Error(`could not listen on port ${port}`);
    callback?.();
  });

  return server;
}
