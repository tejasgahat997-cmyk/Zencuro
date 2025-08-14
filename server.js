const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// Security & basics
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: '*' }));

// Rate limiting
app.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));

// Serve static files (front-end)
app.use(express.static(path.join(__dirname, 'public')));

// Database (safe start even if DATABASE_URL missing)
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  initDb().catch(err => {
    console.error('DB init error:', err);
    // keep server running; endpoints will still error if DB unavailable
  });
} else {
  console.warn('⚠️ No DATABASE_URL set — API will return errors until DB is configured in Render.');
}

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        date_time TIMESTAMPTZ NOT NULL,
        service_type TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS consultations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        mode TEXT NOT NULL,
        preferred_time TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS deliveries (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        items TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS tests (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        test_type TEXT NOT NULL,
        preferred_date TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('✅ Tables ensured');
  } finally {
    client.release();
  }
}

function needDb(res) {
  if (!pool) {
    return res.status(500).json({ error: 'Database not configured. Ask admin to set DATABASE_URL in Render.' });
  }
  return null;
}

// Public API
app.post('/api/bookings', async (req, res) => {
  if (needDb(res)) return;
  const { name, phone, email = null, dateTime, serviceType, notes = null } = req.body;
  if (!name || !phone || !dateTime || !serviceType) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const q = `INSERT INTO bookings (name, phone, email, date_time, service_type, notes)
               VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`;
    const { rows } = await pool.query(q, [name.trim(), phone.trim(), email, dateTime, serviceType.trim(), notes]);
    res.json({ success: true, id: rows[0].id, createdAt: rows[0].created_at });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to save booking' }); }
});

app.post('/api/consultations', async (req, res) => {
  if (needDb(res)) return;
  const { name, phone, email = null, mode, preferredTime = null, notes = null } = req.body;
  if (!name || !phone || !mode) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const q = `INSERT INTO consultations (name, phone, email, mode, preferred_time, notes)
               VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`;
    const { rows } = await pool.query(q, [name.trim(), phone.trim(), email, mode.trim(), preferredTime, notes]);
    res.json({ success: true, id: rows[0].id, createdAt: rows[0].created_at });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to save consultation' }); }
});

app.post('/api/deliveries', async (req, res) => {
  if (needDb(res)) return;
  const { name, phone, address, items, notes = null } = req.body;
  if (!name || !phone || !address || !items) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const q = `INSERT INTO deliveries (name, phone, address, items, notes)
               VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`;
    const { rows } = await pool.query(q, [name.trim(), phone.trim(), address.trim(), JSON.stringify(items), notes]);
    res.json({ success: true, id: rows[0].id, createdAt: rows[0].created_at });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to save delivery' }); }
});

app.post('/api/tests', async (req, res) => {
  if (needDb(res)) return;
  const { name, phone, email = null, testType, preferredDate = null, notes = null } = req.body;
  if (!name || !phone || !testType) return res.status(400).json({ error: 'Missing required fields' });
  try {
    const q = `INSERT INTO tests (name, phone, email, test_type, preferred_date, notes)
               VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`;
    const { rows } = await pool.query(q, [name.trim(), phone.trim(), email, testType.trim(), preferredDate, notes]);
    res.json({ success: true, id: rows[0].id, createdAt: rows[0].created_at });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to save test booking' }); }
});

// Simple admin (read-only) with header x-admin-key
function checkAdmin(req, res, next) {
  const key = req.header('x-admin-key');
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
app.get('/api/admin/bookings', checkAdmin, async (_req, res) => {
  if (needDb(res)) return;
  const { rows } = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 200');
  res.json(rows);
});
app.get('/api/admin/consultations', checkAdmin, async (_req, res) => {
  if (needDb(res)) return;
  const { rows } = await pool.query('SELECT * FROM consultations ORDER BY created_at DESC LIMIT 200');
  res.json(rows);
});
app.get('/api/admin/deliveries', checkAdmin, async (_req, res) => {
  if (needDb(res)) return;
  const { rows } = await pool.query('SELECT * FROM deliveries ORDER BY created_at DESC LIMIT 200');
  res.json(rows);
});
app.get('/api/admin/tests', checkAdmin, async (_req, res) => {
  if (needDb(res)) return;
  const { rows } = await pool.query('SELECT * FROM tests ORDER BY created_at DESC LIMIT 200');
  res.json(rows);
});

// Health & root
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Zencuro server running on port ${PORT}`));



