const express = require('express');
const cors = require('cors');

// Auth & Admin Routes
const authRoutes = require('./Login/Routes/authRoutes');
const adminResourceRoutes = require('./Admin/Routes/adminRoutes');
const staffRoutes = require('./Admin/Routes/staffRoutes');
const roomRoutes = require('./Admin/Routes/roomRoutes');
const protocolRoutes = require('./Admin/Routes/protocolRoutes');
const prakritiQuestionRoutes = require('./Admin/Routes/prakritiQuestionRoutes');
const dashboardRoutes = require('./Admin/Routes/dashboardRoutes');

// Notifications
const notificationRoutes = require('./Notifications/Routes/notificationRoutes');

// Therapist & Session Routes
const therapistRoutes = require('./Therapist/Routes/therapistRoutes');
const sessionRoutes = require('./Therapist/Routes/sessionRoutes');

// Patient Routes
const patientRoutes = require('./Patient/Routes/patientRoutes');

// Middleware
const errorHandler = require('./Common/Middleware/errorHandler');
const doctorPatientRoutes = require('./Doctor/Routes/patientRoutes');
const doctorPrakritiRoutes = require('./Doctor/Routes/prakritiRoutes');
const doctorPackageRoutes = require('./Doctor/Routes/packageRoutes');
const doctorTherapyPlanRoutes = require('./Doctor/Routes/therapyPlanRoutes');
const doctorTherapistRoutes = require('./Doctor/Routes/therapistRoutes');
const doctorProgressRoutes = require('./Doctor/Routes/progressRoutes');
const doctorDashboardRoutes = require('./Doctor/Routes/dashboardRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// ── Health Check ──────────────────────────────────────────────────────────────

// Auth & Admin
app.use('/api/auth', authRoutes);
app.use('/api/clinics', adminResourceRoutes);

// Doctor Endpoints
app.use('/api/doctor/patients', doctorPatientRoutes);
app.use('/api/doctor/patients', doctorTherapyPlanRoutes);
app.use('/api/doctor/patients', doctorProgressRoutes);
app.use('/api/doctor/prakriti', doctorPrakritiRoutes);
app.use('/api/doctor/therapy-packages', doctorPackageRoutes);
app.use('/api/doctor/packages', doctorPackageRoutes);
app.use('/api/doctor/therapists', doctorTherapistRoutes);
app.use('/api/doctor/dashboard', doctorDashboardRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'AyurSutra Backend API running successfully' });
});

// ── Auth & Admin Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/clinics', adminResourceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/protocols', protocolRoutes);
app.use('/api/prakriti-questions', prakritiQuestionRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

// ── Therapist & Session Routes ────────────────────────────────────────────────
app.use('/api/therapist', therapistRoutes);
app.use('/api/sessions', sessionRoutes);

// ── Patient Routes ────────────────────────────────────────────────────────────
app.use('/api/patient', patientRoutes);

// ── Centralized Error Handling Middleware ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;