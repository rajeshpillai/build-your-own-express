// The floor: node:http with the routing written by hand, which is what step 1
// looked like. Nothing here is reusable, and that is the point of measuring it.
import http from 'node:http';

const port = process.env.PORT ?? 3100;

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url.startsWith('/users/')) {
    const id = req.url.slice('/users/'.length);
    const body = JSON.stringify({ id, name: 'Ada' });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }
  res.writeHead(404, { 'Content-Length': 0 });
  res.end();
}).listen(port);
