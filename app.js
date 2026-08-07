// Step 25.1 — the same routes, running on engines somebody else wrote.

import rocket from './rocket/index.js';
import { tiny } from './rocket/view.js';
import { hbs, ejsRender } from './engines.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

// Three engines and the template each one reads. Handlebars shares tiny's double
// braces, so one file serves both; EJS has its own syntax and its own file.
// Nothing below this table knows which was chosen.
const ENGINES = {
  tiny: { render: tiny, ext: 'html' },
  hbs: { render: hbs, ext: 'html' },
  ejs: { render: ejsRender, ext: 'ejs' },
};

const chosen = ENGINES[process.env.ENGINE ?? 'tiny'];
if (!chosen) throw new Error('ENGINE must be tiny, hbs or ejs');

// The one line that changes. Everything under it is the step 25 file.
app.set('views', 'views');
app.set('view engine', chosen.render);

app.get('/page', (req, res) => {
  res.render(`page.${chosen.ext}`, { title: 'A page', author: { name: 'Ada' } });
});

// All three escape by default, which is a property worth checking rather than
// assuming. An engine that did not would be a hole with a pleasant syntax.
app.get('/unsafe', (req, res) => {
  res.render(`danger.${chosen.ext}`, { danger: '<script>alert(1)</script>' });
});

// Which engine is actually running, so a check can prove the swap happened
// rather than trusting the variable it was asked to set.
app.get('/engine', (req, res) => {
  res.json({ engine: process.env.ENGINE ?? 'tiny' });
});

app.get('/settings', (req, res) => {
  res.json({ views: app.get('views') });
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
