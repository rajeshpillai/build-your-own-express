import rocket from './rocket/index.js';
const app = rocket();
app.get('/en', (req, res) => res.send('cafe latte'));
app.get('/fr', (req, res) => res.send('café latte'));
app.listen(3599);
