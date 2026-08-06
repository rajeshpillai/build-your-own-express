// Step 7 — query strings, and the path that routes without them.

import rocket from './rocket/index.js';

const users = [
  { id: '1', name: 'Ada', role: 'admin' },
  { id: '2', name: 'Grace', role: 'user' },
];

const app = rocket();
const port = process.env.PORT ?? 3000;

// The query never reaches the router, so this one route serves every filter.
app.get('/users', (req, res) => {
  const { role, sort } = req.query;
  let found = role ? users.filter((u) => u.role === role) : users;
  if (sort === 'name') {
    found = [...found].sort((a, b) => a.name.localeCompare(b.name));
  }
  res.end(found.map((u) => u.name).join(','));
});

// Params and query on the same request, from different halves of the url.
app.get('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.end('no such user');
  res.end(req.query.field ? String(user[req.query.field]) : user.name);
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
