const express = require('express');
const router = express.Router();
const notificationController = require('../Controllers/notificationController');
const { protect } = require('../../Common/Middleware/authMiddleware');

router.get('/my', protect, notificationController.getMyNotifications);
router.post('/register-token', protect, notificationController.registerDeviceToken);
router.post('/test-send', protect, notificationController.sendTestNotification);
router.get('/', protect, notificationController.getNotificationLogs);
router.patch('/:id/retry', protect, notificationController.retryNotification);

module.exports = router;
