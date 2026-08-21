const express = require('express');
const router = express.Router();
const attachUser = require('../../Common/Middleware/attachUser');
const requireRole = require('../../Common/Middleware/requireRole');
const { listPackagesHandler, createPackageHandler } = require('../Controllers/packageController');

router.get('/', attachUser, requireRole(['doctor', 'solo_practitioner']), listPackagesHandler);
router.post('/', attachUser, requireRole(['doctor', 'solo_practitioner']), createPackageHandler);

module.exports = router;
