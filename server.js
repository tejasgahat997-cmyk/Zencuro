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
require("dotenv").config();

// Stripe setup
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(bodyParser.json());

// ✅ Stripe Checkout Route
app.post("/create-checkout-session", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Sample Product", // change later to Zencuro products
            },
            unit_amount: 2000, // $20 in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://yourdomain.com/success",
      cancel_url: "https://yourdomain.com/cancel",
    });

    res.json({ id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Default route
app.get("/", (req, res) => {
  res.send("Zencuro backend running...");
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});









