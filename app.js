// Step 25 — a page, rendered with an engine the application chose.

import rocket, { Router } from './rocket/index.js';
import { tiny } from './rocket/view.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

// Two settings, and the framework has no opinion about either. Swap tiny for any
// function taking a source and some values, and nothing else changes.
app.set('views', 'views');
app.set('view engine', tiny);

app.get('/page', (req, res) => {
  res.render('page.html', { title: 'A page', author: { name: 'Ada' } });
});

// Escaping is the default. This one hands the template something that would be a
// script tag if it were written out as it arrived.
app.get('/unsafe', (req, res) => {
  res.render('page.html', { title: '<script>alert(1)</script>', author: {} });
});

// A setting read back, using the same name that registers a route.
app.get('/settings', (req, res) => {
  res.json({ views: app.get('views') });
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
