const express = require('express');
const router = express.Router();
const attachUser = require('../../Common/Middleware/attachUser');
const requireRole = require('../../Common/Middleware/requireRole');
const { generatePlanHandler } = require('../Controllers/therapyPlanController');

router.post('/:patientId/therapy-plan', attachUser, requireRole(['doctor', 'solo_practitioner']), generatePlanHandler);

module.exports = router;
