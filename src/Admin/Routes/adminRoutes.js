const express = require('express');
const router = express.Router();
const attachUser = require('../../Common/Middleware/attachUser');
const { getResourcesHandler } = require('../Controllers/resourceController');

router.get('/:clinicId/resources', attachUser, getResourcesHandler);

module.exports = router;
