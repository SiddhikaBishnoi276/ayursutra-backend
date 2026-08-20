const express = require('express');
const cors = require('cors');

// Auth & Admin Routes
const authRoutes = require('./Login/Routes/authRoutes');
const adminResourceRoutes = require('./Admin/Routes/adminRoutes');
const staffRoutes = require('./Admin/Routes/staffRoutes');
const roomRoutes = require('./Admin/Routes/roomRoutes');
const protocolRoutes = require('./Admin/Routes/protocolRoutes');

// Therapist & Session Routes
const therapistRoutes = require('./Therapist/Routes/therapistRoutes');
const sessionRoutes = require('./Therapist/Routes/sessionRoutes');

// Patient Routes
const patientRoutes = require('./Patient/Routes/patientRoutes');

// Middleware
const errorHandler = require('./Common/Middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'AyurSutra Backend API running successfully' });
});

// ── Auth & Admin Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/clinics', adminResourceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/protocols', protocolRoutes);

// ── Therapist & Session Routes ────────────────────────────────────────────────
app.use('/api/therapist', therapistRoutes);
app.use('/api/sessions', sessionRoutes);

// ── Patient Routes ────────────────────────────────────────────────────────────
app.use('/api/patient', patientRoutes);

// ── Centralized Error Handling Middleware ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;