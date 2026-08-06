// Step 20 — error middleware, and why four arguments mean something.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.use((req, res, next) => {
  req.id = 'req-1';
  next();
});

// Failures, one synchronous and one not. Neither is caught here.
app.use((req, res, next) => {
  if (req.path === '/boom') throw new Error('deliberate');
  next();
});

app.use(async (req, res, next) => {
  if (req.path === '/boom-async') throw new Error('deliberate, later');
  next();
});

// Passing an error on by hand, which is what a middleware does when it detects a
// problem rather than suffers one.
app.use((req, res, next) => {
  if (req.path === '/rejected') {
    const error = new Error('not allowed');
    error.status = 403;
    next(error);
    return;
  }

  next();
});

app.get('/', (req, res) => {
  res.send('Home');
});

// A route layer that throws reaches the same error handlers as an app-level one.
app.get('/route-boom', (req, res) => {
  throw new Error('from a handler');
});

// FOUR arguments. That is the entire declaration — nothing registers this as an
// error handler except its own shape, and the framework reads it off the
// function.
app.use((err, req, res, next) => {
  if (!err.status) {
    // Not this one's problem. Passing it on reaches the next error handler, the
    // same way next() reaches the next ordinary middleware.
    next(err);
    return;
  }

  res.status(err.status).json({ error: err.message, request: req.id });
});

// The last resort, and the one that decides what a stranger is allowed to see.
app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Something failed', request: req.id });
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
