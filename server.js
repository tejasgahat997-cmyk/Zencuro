const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies from the forms' fetch() calls
app.use(express.json());

// Serve the /public folder (index.html, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// IMPORTANT: make "/" load public/index.html (remove any old "Welcome to Zencuro" route)
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------- Simple in-memory storage (resets on each deploy) -------
const db = {
  bookings: [],
  consultations: [],
  deliveries: [],
  tests: []
};

// ------- APIs used by your index.html (match the step-4 code) -------
app.post('/api/bookings', (req, res) => {
  const { name, phone, email = null, dateTime, serviceType, notes = null } = req.body;
  if (!name || !phone || !dateTime || !serviceType) return res.status(400).json({ error: 'Missing required fields' });
  const id = db.bookings.length + 1;
  const createdAt = new Date().toISOString();
  db.bookings.push({ id, name, phone, email, dateTime, serviceType, notes, createdAt });
  res.json({ success: true, id, createdAt });
});

app.post('/api/consultations', (req, res) => {
  const { name, phone, email = null, mode, preferredTime = null, notes = null } = req.body;
  if (!name || !phone || !mode) return res.status(400).json({ error: 'Missing required fields' });
  const id = db.consultations.length + 1;
  const createdAt = new Date().toISOString();
  db.consultations.push({ id, name, phone, email, mode, preferredTime, notes, createdAt });
  res.json({ success: true, id, createdAt });
});

app.post('/api/deliveries', (req, res) => {
  const { name, phone, address, items, notes = null } = req.body;
  if (!name || !phone || !address || !items) return res.status(400).json({ error: 'Missing required fields' });
  const id = db.deliveries.length + 1;
  const createdAt = new Date().toISOString();
  db.deliveries.push({ id, name, phone, address, items, notes, createdAt });
  res.json({ success: true, id, createdAt });
});

app.post('/api/tests', (req, res) => {
  const { name, phone, email = null, testType, preferredDate = null, notes = null } = req.body;
  if (!name || !phone || !testType) return res.status(400).json({ error: 'Missing required fields' });
  const id = db.tests.length + 1;
  const createdAt = new Date().toISOString();
  db.tests.push({ id, name, phone, email, testType, preferredDate, notes, createdAt });
  res.json({ success: true, id, createdAt });
});

// (Optional) quick viewer: open /admin?key=YOUR_KEY to see submissions
const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
app.get('/admin', (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(401).send('Unauthorized');
  res.send(`<pre>${JSON.stringify(db, null, 2)}</pre>`);
});

app.listen(PORT, () => console.log(`✅ Zencuro server running on port ${PORT}`));


