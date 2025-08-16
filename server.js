const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- API + static (keep your forms working) ---
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Root & SPA routes
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get(["/booking", "/consultation", "/medicines", "/tests"], (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
// Live consult page
app.get("/consult", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "call.html"));
});

// ---- Minimal in-memory storage for your existing forms ----
const db = { bookings: [], consultations: [], deliveries: [], tests: [] };

app.post("/api/bookings", (req, res) => {
  const { name, phone, email = null, dateTime, serviceType, notes = null } = req.body;
  if (!name || !phone || !dateTime || !serviceType) return res.status(400).json({ error: "Missing fields" });
  const id = db.bookings.length + 1, createdAt = new Date().toISOString();
  db.bookings.push({ id, name, phone, email, dateTime, serviceType, notes, createdAt });
  res.json({ success: true, id, createdAt });
});

app.post("/api/consultations", (req, res) => {
  const { name, phone, email = null, mode, preferredTime = null, notes = null } = req.body;
  if (!name || !phone || !mode) return res.status(400).json({ error: "Missing fields" });
  const id = db.consultations.length + 1, createdAt = new Date().toISOString();
  db.consultations.push({ id, name, phone, email, mode, preferredTime, notes, createdAt });
  res.json({ success: true, id, createdAt });
});

app.post("/api/deliveries", (req, res) => {
  const { name, phone, address, items, notes = null } = req.body;
  if (!name || !phone || !address || !items) return res.status(400).json({ error: "Missing fields" });
  const id = db.deliveries.length + 1, createdAt = new Date().toISOString();
  db.deliveries.push({ id, name, phone, address, items, notes, createdAt });
  res.json({ success: true, id, createdAt });
});

app.post("/api/tests", (req, res) => {
  const { name, phone, email = null, testType, preferredDate = null, notes = null } = req.body;
  if (!name || !phone || !testType) return res.status(400).json({ error: "Missing fields" });
  const id = db.tests.length + 1, createdAt = new Date().toISOString();
  db.tests.push({ id, name, phone, email, testType, preferredDate, notes, createdAt });
  res.json({ success: true, id, createdAt });
});

// ---- Socket.IO signaling + chat for WebRTC ----
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", socket.id);

    socket.on("signal", (data) => {
      // { to, signal }
      io.to(data.to).emit("signal", { from: socket.id, signal: data.signal });
    });

    socket.on("chat-message", (message) => {
      io.to(roomId).emit("chat-message", { user: socket.id, message, at: Date.now() });
    });

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-left", socket.id);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Zencuro running on ${PORT}`);
});







