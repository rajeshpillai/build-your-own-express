// Step 22 — files from a directory, and the request that tries to escape it.

import rocket from './rocket/index.js';
import { serveStatic } from './rocket/static.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

// Registered before the routes, so a file wins over a handler on the same path.
// Swap the two and the route wins instead — the order is yours to choose.
app.use(serveStatic('public'));

app.get('/', (req, res) => {
  res.send('this route never runs, because public/index.html exists');
});

app.get('/hello', (req, res) => {
  res.send('a route, not a file');
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
