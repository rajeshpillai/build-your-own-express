// Step 17 — the middleware stack, and what next is for.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

// Middleware runs in registration order, before any route. This one stamps the
// request, and every handler below can read what it wrote.
app.use((req, res, next) => {
  req.stamps = ['first'];
  next();
});

// The second one appends, which is how you can tell the order is real rather
// than incidental.
app.use((req, res, next) => {
  req.stamps.push('second');
  next();
});

// Middleware sees every request, including the ones no route will match. That is
// the property a logger depends on and a route handler cannot provide.
app.use((req, res, next) => {
  res.setHeader('X-Rocket-Stamps', req.stamps.join(','));
  next();
});

app.get('/', (req, res) => {
  res.send('Home');
});

// A handler reads what middleware wrote as an ordinary value. Nothing here knows
// how it arrived, which is the point of the shared request object.
app.get('/stamps', (req, res) => {
  res.json({ stamps: req.stamps });
});

// The registration order is the meaning, so it is worth being able to print it.
app.get('/stack', (req, res) => {
  res.json({ middleware: app.stack.length, routes: app.routes.length });
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
