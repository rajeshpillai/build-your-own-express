// Step 18 — next, implemented, and what it means to not call it.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.use((req, res, next) => {
  req.stamps = ['first'];
  next();
});

// Async middleware needs nothing special from the caller. The chain waits on it
// because it returns a promise, not because it was registered differently.
app.use(async (req, res, next) => {
  await new Promise((resolve) => setImmediate(resolve));
  req.stamps.push('second');
  next();
});

// The short circuit. This one answers and never calls next, so nothing after it
// runs — not the middleware below, and not the route. That is authentication,
// rate limiting and caching, all of which are the same shape.
app.use((req, res, next) => {
  if (req.path === '/locked') {
    res.status(401).send('Not for you');
    return;
  }

  next();
});

app.use((req, res, next) => {
  req.stamps.push('third');
  next();
});

// A middleware that throws. Nothing catches it in this file, and the process
// stays up because the chain routes it out through next.
app.use((req, res, next) => {
  if (req.path === '/boom') throw new Error('deliberate');
  next();
});

// The async version of the same failure, which is the one that would otherwise
// be an unhandled rejection rather than a response.
app.use(async (req, res, next) => {
  if (req.path === '/boom-async') throw new Error('deliberate, later');
  next();
});

app.get('/', (req, res) => {
  res.send('Home');
});

app.get('/stamps', (req, res) => {
  res.json({ stamps: req.stamps });
});

app.get('/locked', (req, res) => {
  res.send('you should never see this');
});

app.get('/boom', (req, res) => {
  res.send('nor this');
});

app.get('/boom-async', (req, res) => {
  res.send('nor this either');
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
