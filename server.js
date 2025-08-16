// Zencuro full backend: static site + WebRTC signaling + chat + uploads + eRx + Stripe + tracking
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const Stripe = require('stripe');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// --- Security & body parsing ---
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// ensure uploads folder exists
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Simple health check ---
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Serve index.html for frontend routes ---
app.get(['/', '/booking', '/consultation', '/medicines', '/tests', '/call', '/doctor'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- In-memory data (replace with DB later) ---
const db = {
  bookings: [],
  consultations: [],
  deliveriesForm: [],
  tests: []
};

let prescriptions = {};           // { [patientId]: "text of prescription" }
const pharmacies = [
  { id: 1, name: 'City Pharmacy', address: 'Main Street 123' },
  { id: 2, name: 'HealthPlus Pharmacy', address: 'Park Avenue 456' },
  { id: 3, name: 'WellCare Pharmacy', address: 'Broadway 789' }
];

let deliveries = {};              // { [orderId]: { status, location: {lat,lng} } }

// --- File upload (patient reports during call) ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

// --- Booking / Consultation / Delivery / Tests basic APIs ---
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
  const id = db.deliveriesForm.length + 1;
  const createdAt = new Date().toISOString();
  db.deliveriesForm.push({ id, name, phone, address, items, notes, createdAt });
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

// --- Prescription APIs ---
app.post('/prescription/:patientId', (req, res) => {
  const { patientId } = req.params;
  const { prescription } = req.body;
  prescriptions[patientId] = prescription;
  io.emit('prescriptionUpdate', { patientId, prescription });
  res.json({ success: true });
});

app.get('/prescription/:patientId', (req, res) => {
  res.json({ prescription: prescriptions[req.params.patientId] || null });
});

// --- Pharmacies ---
app.get('/pharmacies', (_req, res) => res.json(pharmacies));

// --- Stripe Checkout ---
app.post('/order', async (req, res) => {
  const { patientId, pharmacyId, prescription } = req.body;
  if (!stripe) return res.status(500).json({ success: false, message: 'Stripe not configured' });

  try {
    const orderId = Date.now().toString(); // create client-visible order id for tracking

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Prescription for ${patientId} (Pharmacy #${pharmacyId})`,
            description: prescription
          },
          unit_amount: 2000 // $20 example
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${BASE_URL}/payment-success?orderId=${orderId}`,
      cancel_url: `${BASE_URL}/cancel.html`,
      metadata: { orderId, patientId, pharmacyId: String(pharmacyId) }
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ success: false, message: 'Payment failed' });
  }
});

// --- After successful payment: delivery + tracking ---
app.get('/payment-success', (req, res) => {
  const orderId = (req.query.orderId || Date.now()).toString();
  deliveries[orderId] = {
    status: 'Assigned to delivery agent',
    location: { lat: 28.6139, lng: 77.2090 }
  };

  res.send(`
    <h1>✅ Payment Successful</h1>
    <p>Your order is being prepared.</p>
    <button onclick="window.location.href='/track/${orderId}'">Track Delivery</button>
  `);
});

// --- Real-time tracking page with Google Maps ---
app.get('/track/:orderId', (req, res) => {
  const { orderId } = req.params;
  const delivery = deliveries[orderId];
  if (!delivery) return res.status(404).send('Order not found');

  res.send(`
    <h2>🚚 Delivery Tracking</h2>
    <p id="status">${delivery.status}</p>
    <div id="map" style="height:400px;width:100%;max-width:800px;"></div>

    <script src="/socket.io/socket.io.js"></script>
    <script src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}"></script>
    <script>
      const socket = io();
      const orderId = "${orderId}";
      socket.emit("join-delivery", orderId);

      let map, marker;
      function initMap() {
        map = new google.maps.Map(document.getElementById("map"), {
          zoom: 14,
          center: { lat: ${delivery.location.lat}, lng: ${delivery.location.lng} }
        });
        marker = new google.maps.Marker({
          position: { lat: ${delivery.location.lat}, lng: ${delivery.location.lng} },
          map,
          title: "Delivery Agent"
        });
      }
      initMap();

      socket.on("delivery-update", (data) => {
        document.getElementById("status").innerText = data.status;
        marker.setPosition(new google.maps.LatLng(data.location.lat, data.location.lng));
        map.setCenter(new google.maps.LatLng(data.location.lat, data.location.lng));
      });
    </script>
  `);
});

// --- Admin dump ---
app.get('/admin', (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(401).send('Unauthorized');
  res.send(`<pre>${JSON.stringify({ db, prescriptions, deliveries }, null, 2)}</pre>`);
});

// --- Socket.io: WebRTC signaling, chat, delivery rooms ---
io.on('connection', (socket) => {
  console.log("🔗 User connected:", socket.id);

  // WebRTC signaling
  socket.on("join", ({ room, role }) => {
    socket.join(room);
    console.log(`✅ ${role} joined room: ${room}`);
    socket.to(room).emit("chat", {
      message: `${role} joined the room`,
      name: "System",
      ts: Date.now(),
    });
  });

  socket.on("offer", ({ room, sdp }) => {
    socket.to(room).emit("offer", { from: socket.id, sdp });
  });

  socket.on("answer", ({ room, sdp }) => {
    socket.to(room).emit("answer", { from: socket.id, sdp });
  });

  socket.on("ice-candidate", ({ room, candidate }) => {
    socket.to(room).emit("ice-candidate", { from: socket.id, candidate });
  });

  // chat
  socket.on("chat", ({ room, message, name, ts }) => {
    io.to(room).emit("chat", { message, name, ts });
  });

  // delivery tracking
  socket.on('join-delivery', (orderId) => socket.join(orderId));

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

// --- Simulate delivery movement every 5s ---
setInterval(() => {
  Object.keys(deliveries).forEach((orderId) => {
    const d = deliveries[orderId];
    if (!d) return;
    if (d.status === '✅ Order Delivered!') return;

    d.location.lat += (Math.random() - 0.5) * 0.001;
    d.location.lng += (Math.random() - 0.5) * 0.001;

    if (Math.random() > 0.92) {
      d.status = '✅ Order Delivered!';
    } else {
      d.status = '🚚 Out for Delivery';
    }

    io.to(orderId).emit('delivery-update', d);
  });
}, 5000);

// --- Start server ---
server.listen(PORT, () => {
  console.log(`✅ Zencuro server running on ${BASE_URL}`);
});













