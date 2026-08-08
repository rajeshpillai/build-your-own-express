// The framework this course built, with nothing registered that the benchmark
// does not need. Layers are opt-in here, so a fair comparison uses none.
import rocket from '../../rocket/index.js';

const app = rocket();
const port = process.env.PORT ?? 3101;

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Ada' });
});

const server = app.listen(port);

// bench/profile.mjs asks for a clean exit, because --cpu-prof writes the profile
// when the process ends normally and a killed one leaves nothing behind.
if (process.env.BENCH_EXIT_MS) {
  const ms = Number(process.env.BENCH_EXIT_MS);
  setTimeout(() => { server.close(); process.exit(0); }, ms).unref();
}
