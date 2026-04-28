require('dotenv').config({ path: '.env.local' });
const express = require('express');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', require('./routes/pages'));
app.use('/api/members', require('./routes/api/members'));
app.use('/api/slots', require('./routes/api/slots'));
app.use('/api/periods', require('./routes/api/periods'));
app.use('/api/completions', require('./routes/api/completions'));
app.use('/api/notify', require('./routes/api/notify'));
app.use('/api/cron', require('./routes/api/cron'));

app.use((req, res) => res.status(404).send('Not found'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OFD Scheduler running on http://localhost:${PORT}`));
