const express = require('express');
const cors = require('cors');
const authRoutes = require('./Login/Routes/authRoutes');
const adminResourceRoutes = require('./Admin/Routes/adminRoutes');

const therapistRoutes = require('./Therapist/Routes/therapistRoutes');
const sessionRoutes = require('./Therapist/Routes/sessionRoutes');
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

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;