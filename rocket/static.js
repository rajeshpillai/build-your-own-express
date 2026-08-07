// Step 22 — serving files from a directory, written rather than imported.
//
// This is the first layer that touches the filesystem, and that changes what a
// mistake costs. A routing bug answers the wrong request. A path bug here hands a
// stranger any file the process can read.
//
// Four things have to be right, and only the first is obvious:
//
//   the path      a request controls it, so it cannot be trusted
//   the escape    ../../etc/passwd is one request away
//   the type      a browser will not run a script served as text/plain
//   the stream    a 2 GB file must not become a 2 GB buffer

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

// Extension to content type. Deliberately a small list rather than a dependency:
// an unknown type falls back to octet-stream, which browsers download instead of
// interpreting, and that is the safe direction to be wrong in.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export function serveStatic(root, { index = 'index.html' } = {}) {
  // Resolved once, at registration. Comparing against a relative path would
  // compare against wherever the process happens to be running from.
  const base = path.resolve(root);

  return async (req, res, next) => {
    // Only reads. A POST to a file path is not a request this layer understands,
    // so it passes rather than guessing.
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    // decodeURIComponent first: %2e%2e%2f is ../ wearing a hat, and a check that
    // runs before decoding is a check that can be walked straight past.
    let wanted;
    try {
      wanted = decodeURIComponent(req.path);
    } catch {
      // A path that is not valid encoding at all. Nothing to serve, and nothing
      // worth guessing at.
      return next();
    }

    // path.join normalises, so ../ collapses here rather than reaching the disk.
    const full = path.join(base, wanted);

    // The check that matters. join alone is not enough — join(base, '../x')
    // happily produces a path outside base. Comparing the resolved result against
    // the root is what actually confines it.
    //
    // The separator on the end matters too: without it, a sibling directory named
    // "publicX" would pass a startsWith test against "public".
    if (full !== base && !full.startsWith(base + path.sep)) {
      return next();
    }

    let stat;
    try {
      stat = await fsp.stat(full);
    } catch {
      // Missing, or unreadable. Either way this layer has nothing, so the request
      // carries on to the router and gets whatever it would have got.
      return next();
    }

    const file = stat.isDirectory() ? path.join(full, index) : full;
    if (stat.isDirectory()) {
      try {
        stat = await fsp.stat(file);
      } catch {
        return next();
      }
    }

    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] ??
        'application/octet-stream',
      'Content-Length': stat.size,
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    // Piped, not read. A read would hold the whole file in memory before a byte
    // went out; a pipe hands the socket what it can take and waits when it cannot,
    // which is back pressure and is the only reason this works for large files.
    fs.createReadStream(file).pipe(res);
  };
}
