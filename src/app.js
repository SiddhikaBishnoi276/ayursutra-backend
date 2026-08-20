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

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/clinics', adminResourceRoutes);

// Base Health Check
app.get('/', (req, res) => {
  res.json({ message: 'AyurSutra Backend API running successfully' });
});

// API Routes
app.use('/api/therapist', therapistRoutes);
app.use('/api/sessions', sessionRoutes);
<<<<<<< HEAD
=======
app.use('/api/patient', patientRoutes);
>>>>>>> e4526382ed65348e7d817f4462c4ba7fcdc15e96

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;