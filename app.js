// Step 8 — two routes match, and the order decides.
//
// Swap the two /users registrations below and watch /users/me start returning the
// generic answer. The route file's order is part of what it means.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

// The literal comes first, so it wins for exactly one path.
app.get('/users/me', (req, res) => {
  res.end('the signed-in user');
});

// Everything else falls through to the pattern.
app.get('/users/:id', (req, res) => {
  res.end(`user ${req.params.id}`);
});

// Registration order only decides between routes that BOTH match. These two never
// collide, because their token counts differ.
app.get('/users/:id/posts', (req, res) => {
  res.end(`posts for ${req.params.id}`);
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
  console.table(app.routes.map(({ method, path }) => ({ method, path })));
});
