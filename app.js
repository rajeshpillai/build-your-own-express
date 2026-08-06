// Step 21 — the framework's own work, written as ordinary layers.

import rocket from './rocket/index.js';
import { logger, bodyParser } from './rocket/middleware.js';

const app = rocket();
const port = process.env.PORT ?? 3000;

// Collected so a route can show what was logged, rather than asking you to trust
// a line that scrolled past in a terminal.
const lines = [];

// Runs for every request, including the ones no route matches.
app.use(logger({ log: (line) => lines.push(line) }));

// Reading the body is now something this file asks for. Take it out and req.body
// is undefined again, which is the point: the framework stopped deciding.
app.use(bodyParser());

app.get('/', (req, res) => {
  res.send('Home');
});

app.post('/echo', (req, res) => {
  res.json({ got: req.body });
});

app.get('/log', (req, res) => {
  res.json({ lines });
});

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
