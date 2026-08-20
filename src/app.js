const express = require('express');
const cors = require('cors');
const authRoutes = require('./Login/Routes/authRoutes');
const adminResourceRoutes = require('./Admin/Routes/adminRoutes');

const therapistRoutes = require('./Therapist/Routes/therapistRoutes');
const sessionRoutes = require('./Therapist/Routes/sessionRoutes');
const errorHandler = require('./Common/Middleware/errorHandler');

const therapistRoutes = require('./Therapist/Routes/therapistRoutes');
const sessionRoutes = require('./Therapist/Routes/sessionRoutes');
const patientRoutes = require('./Patient/Routes/patientRoutes');
const errorHandler = require('./Common/Middleware/errorHandler');

// Admin Routes
const staffRoutes = require('./Admin/Routes/staffRoutes');
const roomRoutes = require('./Admin/Routes/roomRoutes');
const protocolRoutes = require('./Admin/Routes/protocolRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/clinics', adminResourceRoutes);

<<<<<<< HEAD
// Base Health Check
=======
// ── Health Check ──────────────────────────────────────────────────────────────
>>>>>>> 8e12d4e326360516b37f0bc6877d210b0d4dea8a
app.get('/', (req, res) => {
  res.json({ message: 'AyurSutra Backend API running successfully' });
});

<<<<<<< HEAD
// API Routes
app.use('/api/therapist', therapistRoutes);
app.use('/api/sessions', sessionRoutes);
<<<<<<< HEAD
=======
app.use('/api/patient', patientRoutes);
>>>>>>> e4526382ed65348e7d817f4462c4ba7fcdc15e96

// Centralized Error Handling Middleware
app.use(errorHandler);
=======
// ── Admin: Staff Management ───────────────────────────────────────────────────
app.use('/api/staff', staffRoutes);

// ── Admin: Room Management ───────────────────────────────────────────────────
app.use('/api/rooms', roomRoutes);

// ── Admin: Therapy Protocol & Package Management ──────────────────────────────
app.use('/api/protocols', protocolRoutes);
>>>>>>> 8e12d4e326360516b37f0bc6877d210b0d4dea8a

module.exports = app;