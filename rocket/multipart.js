// Step 21.1 — a file upload, taken apart by hand.
//
// Every other body this framework parses is one value. A multipart body is several
// at once, each with its own headers, glued together by a separator the client
// chose and announced in the Content-Type. That separator is the whole format:
//
//   Content-Type: multipart/form-data; boundary=----X
//
//   ------X
//   Content-Disposition: form-data; name="note"
//
//   a field
//   ------X
//   Content-Disposition: form-data; name="doc"; filename="a.txt"
//   Content-Type: text/plain
//
//   <the bytes of the file>
//   ------X--
//
// Three things make this harder than it looks. The separator is data, not text, so
// searching for it has to happen on bytes. A file is arbitrary bytes, so decoding
// anything before the parts are split would corrupt it. And the last separator
// carries two extra dashes, which is the only signal that there is nothing more.

// The boundary is a parameter, and this is the first type in the course where a
// parameter carries meaning. Every other one has been safe to drop.
export function boundaryOf(contentType = '') {
  const match = /;\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!match) return null;
  return (match[1] ?? match[2]).trim();
}

// One part's headers, which are ordinary HTTP headers and parsed as such.
function headersOf(block) {
  const headers = {};
  for (const line of block.split('\r\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    headers[line.slice(0, colon).trim().toLowerCase()] =
      line.slice(colon + 1).trim();
  }
  return headers;
}

// name= and filename= out of a Content-Disposition. A part with a filename is a
// file; a part without one is a field. That is the only difference between them.
function dispositionOf(value = '') {
  const name = /;\s*name="([^"]*)"/i.exec(value);
  const filename = /;\s*filename="([^"]*)"/i.exec(value);
  return { name: name?.[1], filename: filename?.[1] };
}

// Step 21.2 — the filename is data, not a name.
//
// The client chooses this string. Nothing checks it. Three things go wrong if it
// is used as it arrives:
//
//   ../../etc/passwd    writes outside the folder that was meant
//   C:\Windows\x.dll    a Windows client sends backslashes, and POSIX basename
//                       does not treat those as separators
//   report.pdf\0.exe    a NUL ends the string for some consumers and not others
//
// This keeps the last segment after either separator, removes anything that is
// not printable, and rejects a name made only of dots. The result is safe to put
// on a disk. It is not the name to show a person: display needs escaping, which
// is a different job, so the original is kept alongside it.
export function safeFilename(name = '', fallback = 'upload') {
  const last = String(name).split(/[/\\]/).pop() ?? '';

  const cleaned = last
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')   // control characters, NUL included
    .replace(/^\.+/, '')                     // no dotfiles, and no bare ".."
    .trim();

  return cleaned === '' ? fallback : cleaned.slice(0, 255);
}

function limitExceeded(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Split a complete multipart body into fields and files.
 *
 * Buffered, not streamed, and that is a real limit rather than an oversight. The
 * whole body is in memory before this runs, so the ceiling from step 16 is also
 * the largest file this can accept. A production parser streams each part to disk
 * as it arrives and never holds more than a chunk — which is most of why step 28.1
 * hands the job to one that does.
 *
 * Step 21.2 — the counts. The step 16 ceiling bounds the whole body and says
 * nothing about how many parts are in it. A body well under that ceiling can
 * still carry ten thousand parts, and each one becomes an object and a Buffer.
 *
 * What these limits do and do not buy is worth being exact about. The body is
 * already in memory when this runs, so refusing here bounds what reaches a
 * handler and what is written to a disk. It does not bound what was allocated.
 * Only a parser that reads the stream as it arrives can do that. This one does
 * not, and step 28.1 is where that is handed to a parser that does.
 */
export function parse(body, boundary, {
  maxFiles = 10,
  maxFields = 100,
  maxFileSize = Infinity,
} = {}) {
  const sep = Buffer.from(`--${boundary}`);
  const fields = Object.create(null);
  const files = [];

  let at = body.indexOf(sep);
  if (at === -1) return { fields, files };

  while (at !== -1) {
    // Two dashes after the separator means the end, and nothing follows it.
    if (body.slice(at + sep.length, at + sep.length + 2).toString() === '--') break;

    const start = at + sep.length + 2;           // skip the trailing CRLF
    const next = body.indexOf(sep, start);
    if (next === -1) break;

    // The part ends two bytes before the next separator: the CRLF belongs to the
    // delimiter, not to the content. Off by those two and every file is corrupt
    // by two bytes, which no text file will ever show you.
    const raw = body.slice(start, next - 2);
    const blank = raw.indexOf('\r\n\r\n');
    if (blank === -1) { at = next; continue; }

    const headers = headersOf(raw.slice(0, blank).toString('utf8'));
    const content = raw.slice(blank + 4);
    const { name, filename } = dispositionOf(headers['content-disposition']);

    if (!name) { at = next; continue; }

    if (filename === undefined) {
      // A field. Decoded now, because a field is text by definition.
      if (Object.keys(fields).length >= maxFields && !(name in fields)) {
        throw limitExceeded('Too many fields', 'TOO_MANY_FIELDS');
      }
      fields[name] = content.toString('utf8');
    } else {
      if (files.length >= maxFiles) {
        throw limitExceeded('Too many files', 'TOO_MANY_FILES');
      }
      if (content.length > maxFileSize) {
        throw limitExceeded('File too large', 'FILE_TOO_LARGE');
      }

      files.push({
        field: name,
        // What goes on a disk, and what the client claimed. Both are kept
        // because they have different uses: one is safe to write, the other is
        // safe only after escaping. A single field named "filename" makes it
        // easy to forget which one is in hand.
        filename: safeFilename(filename),
        clientName: filename,
        type: headers['content-type'] ?? 'application/octet-stream',
        size: content.length,
        bytes: content,
      });
    }

    at = next;
  }

  return { fields, files };
}
