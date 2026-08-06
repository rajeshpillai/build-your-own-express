// Step 10 — Content-Length counts bytes, not characters.
//
// The previous step sent body.length. For "cafe latte" that is 10, and 10 bytes go
// out, and everything is fine. For "café latte" it is still 10, because JavaScript
// counts characters — but the body is 11 bytes, because é is two of them in UTF-8.
//
// The client is told to read 10 and reads 10. The last byte is never sent, the
// response arrives as "café latt", nothing errors, and no test written in English
// will ever notice.

import http from 'node:http';

// An object whose OWN prototype is Node's response prototype. Anything we put here
// is found before Node's version, and anything we do not define still resolves to
// Node's — writeHead, end, setHeader and the rest all keep working untouched.
export const response = Object.create(http.ServerResponse.prototype);

response.send = function send(body) {
  this.writeHead(this.statusCode || 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    // Buffer.byteLength, never body.length. It asks how many bytes this string
    // becomes in the encoding it will be sent in, which is the only question the
    // header is asking.
    'Content-Length': Buffer.byteLength(body),
  });
  this.end(body);
};
