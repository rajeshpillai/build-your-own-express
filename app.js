// Step 9 — handlers stop calling writeHead.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/', (req, res) => {
  res.send('Home');
});

app.get('/users/:id', (req, res) => {
  res.send(`user ${req.params.id}`);
});

// Everything Node put on the response is still there, because our prototype
// inherits from it rather than replacing it.
app.get('/teapot', (req, res) => {
  res.statusCode = 418;
  res.send('short and stout');
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
