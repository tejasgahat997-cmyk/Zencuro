const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/book', (req, res) => {
  console.log('Booking received:', req.body);
  res.json({ success: true, message: 'Booking submitted successfully!' });
});

app.post('/consultation', (req, res) => {
  console.log('Consultation request received:', req.body);
  res.json({ success: true, message: 'Consultation request submitted!' });
});

app.post('/delivery', (req, res) => {
  console.log('Delivery request received:', req.body);
  res.json({ success: true, message: 'Delivery request submitted!' });
});

app.post('/test', (req, res) => {
  console.log('Lab test booking received:', req.body);
  res.json({ success: true, message: 'Lab test booking submitted!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

