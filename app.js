// Step 11 — one method, four kinds of body.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/text', (req, res) => {
  res.send('plain words');
});

app.get('/html', (req, res) => {
  res.send('<h1>a heading</h1>');
});

app.get('/json', (req, res) => {
  res.send({ id: 1, name: 'Ada' });
});

app.get('/bytes', (req, res) => {
  res.send(Buffer.from([0x52, 0x6f, 0x63, 0x6b, 0x65, 0x74]));
});

// A type set by hand wins. The guess is a default, not a policy.
app.get('/csv', (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send('id,name\n1,Ada');
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
