// Step 19 — middleware on one route, and a guard that actually guards.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

// A guard. It refuses by answering and not calling next, which is the same shape
// as the app-level short circuit in step 18 — and until this step, the same shape
// that route-level middleware silently ignored.
const authenticate = (req, res, next) => {
  if (req.headers['x-key'] !== 'open-sesame') {
    res.status(401).send('Not for you');
    return;
  }

  next();
};

// A second one, to show that layers compose and that order is theirs to decide.
const stamp = (req, res, next) => {
  req.seen = 'stamped';
  next();
};

app.get('/', (req, res) => {
  res.send('Home');
});

// One layer, the way every route in the course has been registered so far. This
// still works and takes the identical code path.
app.get('/open', (req, res) => {
  res.send('anyone can read this');
});

// The guarded route. Without the fix in this step, the handler below would run
// for an unauthenticated request and answer 200 after the guard had already sent
// a 401 — two responses into one socket.
app.get('/secret', authenticate, (req, res) => {
  res.send('the secret');
});

// Layers run left to right, and only the ones on this route.
app.get('/both', authenticate, stamp, (req, res) => {
  res.json({ seen: req.seen });
});

// A route whose layers all call next and none of which answers. The path matched
// and nothing handled it, so it falls through rather than hanging.
app.get('/declined', (req, res, next) => {
  next();
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
