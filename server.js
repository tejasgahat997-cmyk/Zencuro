// Load environment variables
require("dotenv").config();

const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const multer = require("multer");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");
const Stripe = require("stripe");

// ✅ Stripe setup (secret key comes from .env or Render env vars)
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ----------------------
// Stripe Checkout Route
// ----------------------
app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Sample Product", // 👉 Replace with your product name
            },
            unit_amount: 2000, // $20 (amount is in cents)
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://yourdomain.com/success", // 👉 Replace with your success page
      cancel_url: "https://yourdomain.com/cancel",   // 👉 Replace with your cancel page
    });

    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// Example default route
// ----------------------
app.get("/", (req, res) => {
  res.send("Zencuro server is running 🚀");
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});










