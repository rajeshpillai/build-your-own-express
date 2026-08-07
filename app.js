// Step 28 — the same two surfaces, with the wrapper the API no longer needs.

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

// Mounted, so the API's own paths never mention /api. The router goes in
// directly now — no wrapper, because use learned to accept one in step 28.
app.use('/api', api);

// The old form, still accepted. Removing it would break every application that
// wrote the wrapper before step 28, and a framework that does that to its users
// over a convenience has its priorities the wrong way round.
app.use('/v2', (req, res, next) => api.handle(req, res, next));

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

app.use(pages);

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
