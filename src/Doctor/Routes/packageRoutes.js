const express = require('express');
const router = express.Router();
const attachUser = require('../../Common/Middleware/attachUser');
const requireRole = require('../../Common/Middleware/requireRole');
const { listPackagesHandler } = require('../Controllers/packageController');

router.get('/', attachUser, requireRole(['doctor', 'solo_practitioner']), listPackagesHandler);

module.exports = router;
