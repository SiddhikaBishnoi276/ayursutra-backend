const express = require('express');
const cors = require('cors');

// Auth & Admin Routes
const authRoutes = require('./Login/Routes/authRoutes');
const adminResourceRoutes = require('./Admin/Routes/adminRoutes');
const staffRoutes = require('./Admin/Routes/staffRoutes');
const roomRoutes = require('./Admin/Routes/roomRoutes');
const protocolRoutes = require('./Admin/Routes/protocolRoutes');
const prakritiQuestionRoutes = require('./Admin/Routes/prakritiQuestionRoutes');
const adminDashboardRoutes = require('./Admin/Routes/dashboardRoutes');

// Doctor Routes
const doctorPatientRoutes = require('./Doctor/Routes/patientRoutes');
const doctorPrakritiRoutes = require('./Doctor/Routes/prakritiRoutes');
const doctorPackageRoutes = require('./Doctor/Routes/packageRoutes');
const doctorTherapyPlanRoutes = require('./Doctor/Routes/therapyPlanRoutes');
const doctorTherapistRoutes = require('./Doctor/Routes/therapistRoutes');
const doctorProgressRoutes = require('./Doctor/Routes/progressRoutes');
const doctorDashboardRoutes = require('./Doctor/Routes/dashboardRoutes');

// Therapist & Session Routes
const therapistRoutes = require('./Therapist/Routes/therapistRoutes');
const sessionRoutes = require('./Therapist/Routes/sessionRoutes');

// Patient Routes
const patientRoutes = require('./Patient/Routes/patientRoutes');

// Notifications
const notificationRoutes = require('./Notifications/Routes/notificationRoutes');

// Middleware
const errorHandler = require('./Common/Middleware/errorHandler');

const app = express();

// ── CORS Configuration ────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev/testing while maintaining credentials
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  })
);

app.use(express.json());

// ── Health Check Endpoints ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'AyurSutra Backend API running successfully' });
});

const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date(),
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// ── API Route Mounts ──────────────────────────────────────────────────────────

// Auth & Admin Routes
app.use('/api/auth', authRoutes);
app.use('/api/clinics', adminResourceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/protocols', protocolRoutes);
app.use('/api/admin/packages', protocolRoutes);
app.use('/api/admin/protocols', protocolRoutes);
app.use('/api/prakriti-questions', prakritiQuestionRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);

// Doctor Routes
app.use('/api/doctor/patients', doctorPatientRoutes);
app.use('/api/doctor/patients', doctorTherapyPlanRoutes);
app.use('/api/doctor/patients', doctorProgressRoutes);
app.use('/api/doctor/prakriti', doctorPrakritiRoutes);
app.use('/api/doctor/therapy-packages', doctorPackageRoutes);
app.use('/api/doctor/packages', doctorPackageRoutes);
app.use('/api/doctor/therapists', doctorTherapistRoutes);
app.use('/api/doctor/dashboard', doctorDashboardRoutes);

// Therapist & Session Routes
app.use('/api/therapist', therapistRoutes);
app.use('/api/sessions', sessionRoutes);

// Patient Routes
app.use('/api/patient', patientRoutes);

// Notification Routes
app.use('/api/notifications', notificationRoutes);

// ── Centralized Error Handling Middleware ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;

// trigger nodemon