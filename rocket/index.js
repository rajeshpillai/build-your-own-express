// The public face of the framework. An application is created by calling rocket(),
// never with `new` — see application.js for why that matters.

import { createApplication } from './application.js';
import { Router } from './router.js';

export default function rocket() {
  return createApplication();
}

// Step 23 — a router you can create on its own, before you have an application to
// put it in. This is the whole public surface change: one more export.
export { Router };
