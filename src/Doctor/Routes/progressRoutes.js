const express = require('express');
const router = express.Router();
const attachUser = require('../../Common/Middleware/attachUser');
const requireRole = require('../../Common/Middleware/requireRole');
const {
  getProgressHandler,
  recordVitalsHandler,
  logSessionHandler,
} = require('../Controllers/progressController');

// All endpoints require Doctor/Solo Practitioner role
router.get('/:patientId/progress', attachUser, requireRole(['doctor', 'solo_practitioner']), getProgressHandler);
router.post('/:patientId/vitals', attachUser, requireRole(['doctor', 'solo_practitioner']), recordVitalsHandler);
router.post('/:patientId/session-log', attachUser, requireRole(['doctor', 'solo_practitioner']), logSessionHandler);

module.exports = router;
