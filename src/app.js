const express = require('express');
const cors = require('cors');

// Admin Routes
const staffRoutes = require('./Admin/Routes/staffRoutes');
const roomRoutes = require('./Admin/Routes/roomRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'AyurSutra Backend API running successfully' });
});

// ── Admin: Staff Management ───────────────────────────────────────────────────
app.use('/api/staff', staffRoutes);

// ── Admin: Room Management ───────────────────────────────────────────────────
app.use('/api/rooms', roomRoutes);

module.exports = app;