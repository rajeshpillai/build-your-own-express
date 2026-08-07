// Express, out of the box. No extra middleware, for the same reason rocket has
// none: this measures routing and the response path, not a configuration.
import express from 'express';

const app = express();
const port = process.env.PORT ?? 3102;

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Ada' });
});

app.listen(port);
