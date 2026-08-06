// Step 2 — the framework exists, and knows nothing yet.
//
// Every request gets the same answer. That is the point: the spine is in place,
// and every step from here hangs a capability off it.

import rocket from './rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
