// Step 1 — a server, and everything you do by hand.
//
// There is no framework here. This is Node on its own, answering four requests.
// Every awkward line below is a job Express does for you, and each one becomes a
// step in this course.

import http from 'node:http';

const users = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Grace' },
];

const server = http.createServer((req, res) => {
  // ONE function receives every request. Method and path are just strings on `req`,
  // and telling them apart is our problem.

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Home');
    return; // Forget this `return` and the next branch runs too.
  }

  if (req.method === 'GET' && req.url === '/users') {
    const body = JSON.stringify(users);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      // Byte length, not string length. The difference is a bug, and it has
      // its own step later on.
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  // A path with a value in the middle of it. There is no `req.params`, so we split
  // the string ourselves and hope the shape is what we expected.
  if (req.method === 'GET' && req.url.startsWith('/users/')) {
    const id = req.url.slice('/users/'.length);
    const user = users.find((u) => u.id === id);

    if (!user) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No such user');
      return;
    }

    const body = JSON.stringify(user);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  // Nothing matched. Without this the socket stays open and the client waits
  // until it gives up.
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const port = process.env.PORT ?? 3000;

server.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
