require('dotenv').config();
const app = require('./app');
const { pool } = require('./config/db');
const { initFirebase } = require('./config/firebase');
const { registerListeners } = require('./Notifications/notificationListeners');
const { startScheduler } = require('./Notifications/scheduler');

initFirebase();

// Initialize Notification Engine
registerListeners();
startScheduler();

const PORT = process.env.PORT || 5000;

// Verify Database Connection before listening
pool.query('SELECT NOW()')
  .then((res) => {
    console.log('Database connected successfully at:', res.rows[0].now);
    app.listen(PORT, () => {
      console.log(`AyurSutra backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
  });