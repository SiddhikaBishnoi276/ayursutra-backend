const express = require('express');
const router = express.Router();
const attachUser = require('../../Common/Middleware/attachUser');
const requireRole = require('../../Common/Middleware/requireRole');
const { getDashboardStatsHandler } = require('../Controllers/dashboardController');

router.get('/stats', attachUser, requireRole(['doctor', 'solo_practitioner']), getDashboardStatsHandler);

module.exports = router;
