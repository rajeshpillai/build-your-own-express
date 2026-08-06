// Step 3 — the same four answers as step 1, without the if/else chain.
//
// Compare this file with server.js at step-01. The routing has moved out of the
// application entirely, which is the whole trade a framework offers.

import rocket from './rocket/index.js';

const users = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Grace' },
];

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/', (req, res) => {
  res.end('Home');
});

app.get('/users', (req, res) => {
  res.end(JSON.stringify(users));
});

// Still one route per user. `/users/:id` needs pattern matching, which is step 5.
app.get('/users/1', (req, res) => {
  res.end(JSON.stringify(users[0]));
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
  console.table(app.routes.map(({ method, path }) => ({ method, path })));
});
