// Step 4 — every verb, from one loop.
//
// The registration below is the same four lines seven times over, generated rather
// than written. Compare app.routes on boot with step 3's.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/', (req, res) => {
  res.end('Home');
});

// Chaining works because every generated method returns the app.
app
  .post('/users', (req, res) => {
    res.end('created a user');
  })
  .put('/users', (req, res) => {
    res.end('replaced a user');
  })
  .patch('/users', (req, res) => {
    res.end('updated a user');
  })
  .delete('/users', (req, res) => {
    res.end('deleted a user');
  });

// Same path, different verbs, different handlers. The table matches on both.
app.get('/users', (req, res) => {
  res.end('listed users');
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
  console.table(app.routes.map(({ method, path }) => ({ method, path })));
});
