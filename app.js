// Step 23 — a router built on its own, then handed to the application.

import rocket, { Router } from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

// Built before there is anything to put it in. Nothing here mentions the
// application, which is what makes it a unit rather than a section of one.
const users = new Router();

users.get('/users', (req, res) => {
  res.json(['Ada', 'Grace']);
});

users.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

// A router is shaped like a layer, so it goes in the same way a layer does.
app.use((req, res, next) => users.handle(req, res, next));

// A second router. Requests the first one declined reach this one, which is what
// calling next on a miss buys.
const pages = new Router();

pages.get('/', (req, res) => {
  res.send('Home');
});

// Registered on the second router only. Reaching it proves the first one declined
// and called next, rather than the two tables having been merged somewhere.
pages.get('/about', (req, res) => {
  res.send('about this site');
});

app.use((req, res, next) => pages.handle(req, res, next));

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
