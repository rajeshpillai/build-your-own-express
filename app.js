// Step 15 — the body is parsed by what it says it is.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/', (req, res) => {
  res.send('Home');
});

// No stream handling anywhere in this file any more. The handler reads req.body
// the way it reads req.params, because by the time it runs, both are values.
app.post('/json', (req, res) => {
  res.json({ got: req.body, type: typeof req.body });
});

// The same handler shape for a form post. What changed is one header, and the
// framework read that header rather than being told which parser to use.
app.post('/form', (req, res) => {
  res.json(req.body);
});

// text/* stays a string. There is nothing to parse and pretending otherwise
// would lose information the client took the trouble to send.
app.post('/text', (req, res) => {
  res.json({ body: req.body, type: typeof req.body });
});

// An unknown type stays bytes. A framework that guessed here would be deciding
// it knows better than the header it was handed.
app.post('/bytes', (req, res) => {
  res.json({ bytes: req.body.length, isBuffer: Buffer.isBuffer(req.body) });
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
