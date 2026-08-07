// Step 26 — a URL shortener, built on the framework rather than beside it.

import rocket from './rocket/index.js';
import { tiny } from './rocket/view.js';
import { serveStatic } from './rocket/static.js';
import { bodyParser, logger } from './rocket/middleware.js';
import * as store from './shortener/store.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.set('views', 'views');
app.set('view engine', tiny);

app.use(logger({ log: () => {} }));
app.use(serveStatic('public'));
app.use(bodyParser());

app.get('/', async (req, res) => {
  const links = await store.all();
  res.render('home.html', { title: 'Shorten a link', count: links.length });
});

// The form posts here. A form sends urlencoded, which the parser already handles,
// so nothing in this handler knows how the body arrived.
app.post('/links', async (req, res) => {
  const target = req.body?.target;

  if (!target || !/^https?:\/\//.test(target)) {
    return res.status(400).send('a target starting with http is required');
  }

  const link = await store.create(target);
  res.render('made.html', link);
});

// The whole point of the thing. A code in the path, a lookup, and a redirect —
// which is res.redirect from step 13, finally used for what it is for.
app.get('/:code', async (req, res) => {
  const link = await store.visit(req.params.code);

  if (!link) {
    return res.status(404).send('no such link');
  }

  res.redirect(link.target);
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
