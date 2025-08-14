const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Booking route
app.post('/book', (req, res) => {
    console.log('Booking data:', req.body);
    res.json({ message: 'Booking received successfully!', data: req.body });
});

// Consultation route
app.post('/consultation', (req, res) => {
    console.log('Consultation request:', req.body);
    res.json({ message: 'Consultation request received!', data: req.body });
});

// Delivery route
app.post('/delivery', (req, res) => {
    console.log('Delivery order:', req.body);
    res.json({ message: 'Delivery order received!', data: req.body });
});

// Test booking route
app.post('/test', (req, res) => {
    console.log('Test booking:', req.body);
    res.json({ message: 'Test booking received!', data: req.body });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
