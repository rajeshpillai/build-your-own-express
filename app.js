// Step 6 — the handler can finally see which user was asked for.

import rocket from './rocket/index.js';

const users = { 1: 'Ada', 2: 'Grace' };

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/users/:id', (req, res) => {
  res.end(users[req.params.id] ?? 'no such user');
});

// Two holes in one path. Both arrive named.
app.get('/users/:id/posts/:slug', (req, res) => {
  res.end(`user ${req.params.id}, post ${req.params.slug}`);
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
