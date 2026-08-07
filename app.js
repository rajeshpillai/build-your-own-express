// Step 21.1 — a file upload, taken apart by the framework itself.

import rocket from './rocket/index.js';
import { bodyParser, multipart } from './rocket/middleware.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

// Both registered. Each declines what is not its own, which is the only reason
// two body layers can sit side by side at all.
app.use(bodyParser());
app.use(multipart());

app.post('/upload', (req, res) => {
  res.json({
    fields: req.body ?? null,
    files: (req.files ?? []).map((f) => ({
      field: f.field,
      filename: f.filename,
      type: f.type,
      size: f.size,
    })),
  });
});

// The bytes really are the bytes. A file that arrives corrupt by two bytes still
// has the right length, so length alone would not catch it.
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
