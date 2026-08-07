// Step 27 — two surfaces over one store: pages for people, JSON for programs.

import rocket, { Router } from './rocket/index.js';
import { tiny } from './rocket/view.js';
import { serveStatic } from './rocket/static.js';
import { bodyParser, logger } from './rocket/middleware.js';
import { api } from './shortener/api.js';
import * as store from './shortener/store.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.set('views', 'views');
app.set('view engine', tiny);

app.use(logger({ log: () => {} }));
app.use(serveStatic('public'));
app.use(bodyParser());

// Mounted, so the API's own paths never mention /api. Mounting it twice would
// work and change nothing inside it.
app.use('/api', (req, res, next) => api.handle(req, res, next));

// The pages, in their own router for the same reason the API is in one: it can be
// read on its own, and it says what it serves.
const pages = new Router();

pages.get('/', async (req, res) => {
  const links = await store.all();
  res.render('home.html', { title: 'Shorten a link', count: links.length });
});

pages.post('/links', async (req, res) => {
  const target = req.body?.target;

  if (!target || !/^https?:\/\//.test(target)) {
    return res.status(400).send('a target starting with http is required');
  }

  const link = await store.create(target);
  res.render('made.html', link);
});

// Registered last, because a single token matches almost everything. Put this
// above the others and /links would be read as a code.
pages.get('/:code', async (req, res) => {
  const link = await store.visit(req.params.code);

  if (!link) {
    return res.status(404).send('no such link');
  }

  res.redirect(link.target);
});

app.use((req, res, next) => pages.handle(req, res, next));

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
