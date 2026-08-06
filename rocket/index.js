// The public face of the framework. An application is created by calling rocket(),
// never with `new` — see application.js for why that matters.

import { createApplication } from './application.js';

export default function rocket() {
  return createApplication();
}
