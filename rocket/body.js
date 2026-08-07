// Step 15 — the request body, read once and parsed by what it says it is.
//
// Step 14 did this by hand in every handler. The reading part never varies, so it
// belongs here. The parsing part varies by exactly one thing: the Content-Type
// header the client sent.

// Step 16 — the ceiling. Express defaults to a hundred kilobytes and this matches
// it, because a default nobody sets is the number that actually runs in
// production. Step 25 makes it configurable through app.set.
export const LIMIT = 100 * 1024;

function tooLarge() {
  const error = new Error('Body too large');
  error.code = 'BODY_TOO_LARGE';
  return error;
}

// Collect the stream into a single Buffer. Concatenating Buffers rather than
// strings is the whole reason a multibyte character survives a chunk boundary.
//
// Step 16 — counting while collecting. Without this, the size of a request is
// decided by whoever sent it, and a process holds every byte of it in memory.
export function read(req, limit = LIMIT) {
  return new Promise((resolve, reject) => {
    // Fail before reading anything, when the client announced the size. This is
    // the cheap check and it catches the honest client.
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      reject(tooLarge());
      return;
    }

    // And count anyway, because Content-Length is a claim. A chunked request
    // sends none at all, and a dishonest one can send a number and then keep
    // going. The header is a hint; the only number that binds is the one counted
    // here as the bytes actually arrive.
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;

      if (total > limit) {
        // Pause rather than destroy. Destroying here kills the socket before the
        // 413 can be written, and the client is left with a dropped connection
        // and no idea which of its requests was wrong. The caller answers first
        // and stops the sender afterwards.
        req.pause();
        reject(tooLarge());
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// `application/json; charset=utf-8` is one type and one parameter. Only the type
// decides how to read the body, so the parameters are dropped here.
function mediaType(header) {
  return (header ?? '').split(';')[0].trim().toLowerCase();
}

// A urlencoded body is the same grammar as a query string, so it is the same
// parser. Repeated keys collapse to the last one, which is what Express does and
// is worth knowing rather than discovering.
function urlencoded(raw) {
  return Object.fromEntries(new URLSearchParams(raw));
}

// The types this parser claims. Anything else is somebody else's to read — a file
// upload, for instance, which arrives as multipart and belongs to a layer that
// understands boundaries.
//
// This exists because reading a body CONSUMES the stream. A parser that reads
// everything leaves nothing for the layer after it, and the failure is not a
// polite one: multer, handed an exhausted stream, simply errors.
export function handles(contentType) {
  const type = mediaType(contentType);
  return type === 'application/json'
    || type === 'application/x-www-form-urlencoded'
    || type.startsWith('text/');
}

// Returns the parsed body, or throws so the caller can answer 400. A body that
// claims to be JSON and is not is a client error, and crashing the server over
// it would be the framework's mistake rather than the client's.
export function parse(buffer, contentType) {
  if (buffer.length === 0) return undefined;

  const type = mediaType(contentType);

  if (type === 'application/json') {
    return JSON.parse(buffer.toString('utf8'));
  }

  if (type === 'application/x-www-form-urlencoded') {
    return urlencoded(buffer.toString('utf8'));
  }

  if (type.startsWith('text/')) {
    return buffer.toString('utf8');
  }

  // Anything else stays bytes. Guessing at an unknown type would be a framework
  // deciding it knows better than the header it was given.
  return buffer;
}
