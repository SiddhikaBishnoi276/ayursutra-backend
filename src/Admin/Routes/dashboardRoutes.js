const express = require('express');
const router = express.Router();
const dashboardController = require('../Controllers/dashboardController');
const { protect } = require('../../Common/Middleware/authMiddleware');

router.get('/', protect, dashboardController.getDashboardStats);

module.exports = router;
