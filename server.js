const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const multer = require("multer");
const path = require("path");
const bodyParser = require("body-parser");
const stripe = require("stripe")("sk_test_yourStripeKeyHere"); // replace with your key
const cors = require("cors");

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// 📂 Upload storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// 📂 Patient uploads document
app.post("/upload", upload.single("document"), (req, res) => {
  res.json({ file: `/uploads/${req.file.filename}` });
});

// 📄 Doctor writes prescription
let prescription = "";
app.post("/prescription", (req, res) => {
  prescription = req.body.text;
  res.json({ success: true });
});
app.get("/prescription", (req, res) => {
  res.json({ text: prescription });
});

// 🏥 Pharmacy list
const pharmacies = [
  { id: 1, name: "City Pharmacy", location: "Main Road" },
  { id: 2, name: "HealthPlus", location: "Market Street" },
  { id: 3, name: "MediCare", location: "Near Bus Stand" }
];
app.get("/pharmacies", (req, res) => res.json(pharmacies));

// 💳 Payment (Stripe)
app.post("/checkout", async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: req.body.items,
    mode: "payment",
    success_url: "http://localhost:3000/success",
    cancel_url: "http://localhost:3000/cancel"
  });
  res.json({ url: session.url });
});

// 📞 Socket for chat (already video call in place)
io.on("connection", socket => {
  console.log("User connected");

  socket.on("chatMessage", msg => {
    io.emit("chatMessage", msg);
  });

  socket.on("disconnect", () => console.log("User disconnected"));
});

server.listen(3000, () => console.log("Server running on port 3000"));








