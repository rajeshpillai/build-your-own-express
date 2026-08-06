// Step 13 — redirects, and the 404 nobody registered.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/', (req, res) => {
  res.send('Home');
});

// The old address still works, and says where it went.
app.get('/home', (req, res) => {
  res.redirect('/');
});

// Permanent has to be asked for, because browsers cache it hard.
app.get('/old-docs', (req, res) => {
  res.redirect('/docs', 301);
});

app.get('/docs', (req, res) => {
  res.send('the documentation');
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
