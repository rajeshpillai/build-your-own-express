// The framework this course built, with nothing registered that the benchmark
// does not need. Layers are opt-in here, so a fair comparison uses none.
import rocket from '../../rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3101;

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Ada' });
});

app.listen(port);
