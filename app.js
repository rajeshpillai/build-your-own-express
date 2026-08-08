// Step 28.2 — the shortener gets a real interface, on a real engine.
//
// The adapter in engines.js has been sitting here unused since the shortener
// arrived: a form and a confirmation page needed nothing an engine provides. A
// page with a shared shell, a repeated row and a formatted count does, so the
// view engine changes from tiny to Handlebars and the templates become .hbs.
//
// Four lines below are the whole change. Everything that makes it a real
// interface — the layout, the partials, the helper — is in engines.js, because
// the framework's seam hands over one file and takes back one string and cannot
// carry any of it.
//
// This is the claim the whole course rests on, so it is tested rather than
// asserted. None of the four packages below knows this framework exists. They
// were written against Express, they are installed from npm unmodified, and they
// run here because the interface they expect is the one we built: three
// arguments, Node's own request and response underneath, and a next that means
// what it says.

import rocket, { Router } from './rocket/index.js';
import { hbs } from './engines.js';
import { serveStatic } from './rocket/static.js';
import { bodyParser, logger } from './rocket/middleware.js';
import { api } from './shortener/api.js';
import * as store from './shortener/store.js';

// Nothing of ours. These are the versions npm installs today.
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import multer from 'multer';

const app = rocket();
const port = process.env.PORT ?? 3000;

app.set('views', 'views');
app.set('view engine', hbs);

// Collected so a route can show what morgan wrote, rather than asking anybody to
// trust a line that scrolled past.
const logs = [];

// morgan needs the status, which does not exist until the response has finished,
// so it registers a listener and calls next straight away. That is the same shape
// our own logger has, and for the same reason.
app.use(morgan('tiny', { stream: { write: (line) => logs.push(line.trim()) } }));

// cors sets headers and calls next. There is nothing Express-specific in that,
// which is exactly why it works here.
app.use(cors());

// cookie-parser reads one header and attaches an object to the request, using the
// shared request surface the same way our own layers do.
app.use(cookieParser());

app.use(logger({ log: () => {} }));
app.use(serveStatic('public'));
app.use(bodyParser());

// multer is the one that could not have worked by accident. It reads the request
// stream itself, so it needs that stream unread — which is only true because
// bodyParser declines what it cannot parse rather than consuming every body. That
// change was made in step 21.1, before there was anything here to prove it on.
const upload = multer({ storage: multer.memoryStorage() });

app.post('/avatar', upload.single('avatar'), (req, res) => {
  res.json({
    filename: req.file?.originalname ?? null,
    size: req.file?.size ?? null,
    note: req.body?.note ?? null,
  });
});

// Mounted, so the API's own paths never mention /api. The router goes in
// directly now — no wrapper, because use learned to accept one in step 28.
app.use('/api', api);

// The old form, still accepted. Removing it would break every application that
// wrote the wrapper before step 28, and a framework that does that to its users
// over a convenience has its priorities the wrong way round.
app.use('/v2', (req, res, next) => api.handle(req, res, next));

// The pages, in their own router for the same reason the API is in one: it can be
// read on its own, and it says what it serves.
const pages = new Router();

pages.get('/', async (req, res) => {
  const links = await store.all();
  res.render('home.hbs', { title: 'Shorten a link', count: links.length, links });
});

pages.post('/links', async (req, res) => {
  const target = req.body?.target;

  // Step 28.2 — a refusal is a page, not a sentence.
  //
  // Sending the string put the visitor on a blank screen holding an error and
  // nothing else: no form, and no sight of what they typed. Rendering the same
  // page back with the message above it, and the value still in the box, is what
  // every form that respects its user does.
  //
  // The status stays 400. The alternative — redirecting to the form and carrying
  // the message in a session — avoids a re-post on refresh and needs somewhere to
  // keep the message, which this framework deliberately does not have.
  if (!target || !/^https?:\/\//.test(target)) {
    const links = await store.all();
    return res.status(400).render('home.hbs', {
      title: 'Shorten a link',
      count: links.length,
      links,
      error: 'That does not look like a link. It has to start with http.',
      target,
    });
  }

  const link = await store.create(target);
  res.render('made.hbs', { title: 'Made', ...link });
});

// Registered last, because a single token matches almost everything. Put this
// above the others and /links would be read as a code.
pages.get('/:code', async (req, res) => {
  const link = await store.visit(req.params.code);

  // A code that does not exist is an ordinary thing to type wrong, so it gets a
  // page rather than a line of text — with a way back to the form on it.
  if (!link) {
    return res.status(404).render('gone.hbs', {
      title: 'No such link',
      code: req.params.code,
    });
  }

  res.redirect(link.target);
});

// What the cookie parser and morgan collected, so the checks can read both back.
//
// These live on their own router, mounted before the pages one, and that is not
// a style choice. A layer runs before the application's own route table, so
// app.get here would lose to the pages router no matter where in this file it
// was written — and that router ends with a single-token route, which reads
// /whoami as readily as it reads a short code. Registration order decides it,
// and only between things registered the same way.
const diagnostics = new Router();
diagnostics.get('/whoami', (req, res) => {
  res.json({ cookies: req.cookies ?? null });
});
diagnostics.get('/logs', (req, res) => res.json({ lines: logs }));

app.use(diagnostics);
app.use(pages);

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
