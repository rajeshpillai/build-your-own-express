// Step 14 — the body is a stream, and it has not arrived yet.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/', (req, res) => {
  res.send('Home');
});

// Nothing has read the request, so there is nothing to find. This is not a bug
// and not a missing feature — the bytes are still on the wire, and `req` is a
// stream that nobody has listened to yet.
app.post('/sync', (req, res) => {
  res.json({ body: req.body ?? null, type: typeof req.body });
});

// By hand, which is what every framework does underneath its body parser.
// Chunks are Buffers. Concatenating them as strings would decode each chunk on
// its own, and a character split across two chunks would arrive broken.
app.post('/echo', (req, res) => {
  const chunks = [];

  req.on('data', (chunk) => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    res.send(Buffer.concat(chunks).toString('utf8'));
  });
});

// The stream is where the size of a request first becomes visible, and step 16
// is about what happens when nobody is counting.
app.post('/bytes', (req, res) => {
  let total = 0;

  req.on('data', (chunk) => {
    total += chunk.length;
  });

  req.on('end', () => {
    res.json({ bytes: total });
  });
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
