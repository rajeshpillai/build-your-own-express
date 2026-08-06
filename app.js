// Step 5 — one route, many users.
//
// Compare this with step 3, where every user needed its own registration. The
// handler still cannot see WHICH user was asked for — that is step 6.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/', (req, res) => {
  res.end('Home');
});

app.get('/users', (req, res) => {
  res.end('listed users');
});

// One registration. Any user.
app.get('/users/:id', (req, res) => {
  res.end('one user');
});

app.get('/users/:id/edit', (req, res) => {
  res.end('editing a user');
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
  console.table(app.routes.map(({ method, path }) => ({ method, path })));
});
