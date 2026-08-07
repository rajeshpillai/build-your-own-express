// Step 21.2 — the same upload, with the filename treated as data.

import rocket from './rocket/index.js';
import { bodyParser, multipart } from './rocket/middleware.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.use(bodyParser());

// The numbers are the route's business, not the framework's. Three files, and a
// quarter of the body ceiling each, is small enough to show a refusal happening
// and arbitrary enough that nobody reads it as advice.
app.use(multipart({ maxFiles: 3, maxFields: 5, maxFileSize: 25 * 1024 }));

// Both names come back, so the difference can be seen rather than taken on
// trust. The first is safe to write to a disk. The second is what the client
// claimed, and it is safe only after escaping.
app.post('/upload', (req, res) => {
  res.json({
    fields: req.body ?? null,
    files: (req.files ?? []).map((f) => ({
      field: f.field,
      filename: f.filename,
      clientName: f.clientName,
      type: f.type,
      size: f.size,
    })),
  });
});

// Where the cleaned name matters. Joining a folder to a name the client chose is
// the whole of path traversal. The cleaning is the only thing between this line
// and any file the process can write.
app.post('/store', (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('no file');
  res.json({ wouldWriteTo: `uploads/${file.filename}` });
});

app.post('/echo-file', (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('no file');
  res.send(file.bytes);
});

app.post('/json', (req, res) => {
  res.json({ got: req.body });
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
