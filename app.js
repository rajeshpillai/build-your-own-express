// Step 24 — the same router, mounted under a prefix it knows nothing about.

import rocket, { Router } from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

// Written once. Every path here is relative to wherever it ends up hanging, and
// nothing in this router mentions /api.
const api = new Router();

api.get('/users', (req, res) => {
  res.json(['Ada', 'Grace']);
});

api.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, mountedAt: req.baseUrl });
});

// Mounted twice, to make the point that the router does not know where it is.
app.use('/api', (req, res, next) => api.handle(req, res, next));
app.use('/v2', (req, res, next) => api.handle(req, res, next));

app.get('/', (req, res) => {
  res.send('Home');
});

// Not mounted under anything. The prefix is optional, and this is the old form.
app.use((req, res, next) => {
  res.setHeader('X-Seen', req.path);
  next();
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
