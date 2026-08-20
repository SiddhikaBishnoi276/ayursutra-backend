const express = require('express');
const cors = require('cors');
const authRoutes = require('./Login/Routes/authRoutes');
const adminResourceRoutes = require('./Admin/Routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/clinics', adminResourceRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'AyurSutra Backend API running successfully' });
});

module.exports = app;