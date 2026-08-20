const express = require('express');
const cors = require('cors');

const therapistRoutes = require('./Therapist/Routes/therapistRoutes');
const sessionRoutes = require('./Therapist/Routes/sessionRoutes');
const errorHandler = require('./Common/Middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

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