// The same framework and the same route as rocket.js, on the other transport.
// One option differs between these two files; that is the comparison.
import rocket from '../../rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3103;

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Ada' });
});

app.listen(port, { transport: 'uws' });
