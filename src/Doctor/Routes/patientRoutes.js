const express = require('express');
const router = express.Router();
const attachUser = require('../../Common/Middleware/attachUser');
const requireRole = require('../../Common/Middleware/requireRole');
const { addPatientHandler, listPatientsHandler } = require('../Controllers/patientController');

router.post('/', attachUser, requireRole(['doctor', 'solo_practitioner']), addPatientHandler);
router.get('/', attachUser, requireRole(['doctor', 'solo_practitioner']), listPatientsHandler);

module.exports = router;
