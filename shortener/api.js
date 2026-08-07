// Step 27 — the same data, as an interface for programs rather than people.
//
// This router knows nothing about where it will hang. Every path in it is written
// as though it were at the root, which is what step 24 bought: mount it at /api,
// at /v2, or at both, and none of these lines change.
//
// It also knows nothing about pages. It never renders and never redirects. The two
// surfaces share a store and nothing else, and that is the point of the step: the
// same data is not the same interface.

import { Router } from '../rocket/index.js';
import * as store from './store.js';

export const api = new Router();

api.get('/links', async (req, res) => {
  res.json(await store.all());
});

// A program sends JSON, a form sends urlencoded, and the parser already handles
// both. This handler cannot tell which arrived, and does not need to.
api.post('/links', async (req, res) => {
  const target = req.body?.target;

  if (!target || !/^https?:\/\//.test(target)) {
    return res.status(400)
      .json({ error: 'a target starting with http is required' });
  }

  const link = await store.create(target);

  // 201, and a Location header naming the thing that was made. A browser form
  // wants a page back; a program wants to be told where its new resource lives.
  res.setHeader('Location', `${req.baseUrl}/links/${link.code}`);
  res.status(201).json(link);
});

api.get('/links/:code', async (req, res) => {
  const link = await store.lookup(req.params.code);

  if (!link) {
    return res.status(404).json({ error: 'no such link' });
  }

  res.json(link);
});
