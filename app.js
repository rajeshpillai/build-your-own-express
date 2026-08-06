// Step 10 — the same string, with and without an accent.
//
// At step 9 the second of these arrived truncated, silently. Run ./verify.sh at
// step-09 and then here to see the difference on the wire.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.get('/ascii', (req, res) => {
  res.send('cafe latte');          // 10 characters, 10 bytes
});

app.get('/utf8', (req, res) => {
  res.send('café latte');          // 10 characters, 11 bytes
});

app.get('/emoji', (req, res) => {
  res.send('coffee ☕');            // 8 characters, 10 bytes
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
