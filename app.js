// Step 12 — status and json, in one expression.

import rocket from './rocket/index.js';

const users = { 1: { id: '1', name: 'Ada' } };

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/users/:id', (req, res) => {
  const user = users[req.params.id];
  if (!user) {
    return res.status(404).json({ error: 'no such user' });
  }
  res.json(user);
});

// json says what it means. send would have guessed text/plain for both of these.
app.get('/empty', (req, res) => {
  res.json([]);
});

app.get('/digits', (req, res) => {
  res.json('12345');
});

app.get('/created', (req, res) => {
  res.status(201).send('made it');
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
