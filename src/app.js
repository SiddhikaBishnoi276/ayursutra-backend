const express = require('express');
const cors = require('cors');
const authRoutes = require('./Login/Routes/authRoutes');
const adminResourceRoutes = require('./Admin/Routes/adminRoutes');
const doctorPatientRoutes = require('./Doctor/Routes/patientRoutes');
const doctorPrakritiRoutes = require('./Doctor/Routes/prakritiRoutes');
const doctorPackageRoutes = require('./Doctor/Routes/packageRoutes');
const doctorTherapyPlanRoutes = require('./Doctor/Routes/therapyPlanRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/clinics', adminResourceRoutes);
app.use('/api/doctor/patients', doctorPatientRoutes);
app.use('/api/doctor/prakriti', doctorPrakritiRoutes);
app.use('/api/doctor/therapy-packages', doctorPackageRoutes);
app.use('/api/doctor/patients', doctorTherapyPlanRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'AyurSutra Backend API running successfully' });
});

module.exports = app;