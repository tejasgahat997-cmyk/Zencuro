// Import dependencies
const express = require("express");
const path = require("path");
require("dotenv").config();  // Load variables from .env

const app = express();

// Use the port from .env or fallback to 10000
const PORT = process.env.PORT || 10000;

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "public")));

// For all routes, send index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});











