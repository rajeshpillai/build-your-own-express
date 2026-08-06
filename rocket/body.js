// Step 15 — the request body, read once and parsed by what it says it is.
//
// Step 14 did this by hand in every handler. The reading part never varies, so it
// belongs here. The parsing part varies by exactly one thing: the Content-Type
// header the client sent.

// Collect the stream into a single Buffer. Concatenating Buffers rather than
// strings is the whole reason a multibyte character survives a chunk boundary.
export function read(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
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
