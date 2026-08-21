const express = require('express');
const router = express.Router();
const attachUser = require('../../Common/Middleware/attachUser');
const requireRole = require('../../Common/Middleware/requireRole');
const { listTherapistsHandler } = require('../Controllers/therapistController');

router.get('/', attachUser, requireRole(['doctor', 'solo_practitioner']), listTherapistsHandler);

module.exports = router;
