const notificationService = require('../Services/notificationService');

const getNotificationLogs = async (req, res, next) => {
  try {
    const logs = await notificationService.getNotificationLogs();
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

const retryNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    // id is something like "NL-01", so extract the number part
    const rawId = parseInt(id.replace('NL-', ''), 10);
    
    if (isNaN(rawId)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }

    const updatedLog = await notificationService.retryNotification(rawId);
    res.status(200).json({ success: true, data: updatedLog });
  } catch (err) {
    if (err.message === 'Notification not found') {
      return res.status(404).json({ success: false, message: err.message });
    }
    next(err);
  }
};

const registerDeviceToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.id; // from protect middleware

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    await notificationService.registerDeviceToken(userId, token);
    res.status(200).json({ success: true, message: 'Device token registered successfully' });
  } catch (err) {
    next(err);
  }
};

const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notifications = await notificationService.getMyNotifications(userId);
    res.status(200).json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
};

const sendTestNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, body } = req.body;
    
    const { pool } = require('../../config/db');
    const result = await pool.query(
      `SELECT token FROM user_device_tokens WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No registered device token found for user' });
    }

    const deviceToken = result.rows[0].token;

    // Check Firebase admin
    try {
      const { getApps } = require('firebase-admin/app');
      const { getMessaging } = require('firebase-admin/messaging');
      
      if (!getApps().length) {
        return res.status(501).json({ success: false, message: 'Firebase Admin SDK is installed but not initialized with service account.' });
      }

      const message = {
        notification: {
          title: title || 'Test Notification',
          body: body || 'This is a test notification from AyurSutra Backend',
        },
        token: deviceToken,
      };

      const response = await getMessaging().send(message);
      res.status(200).json({ success: true, message: 'Test notification sent successfully', messageId: response });
    } catch (firebaseErr) {
      if (firebaseErr.code === 'MODULE_NOT_FOUND') {
        return res.status(501).json({ 
          success: false, 
          message: 'Firebase Admin SDK (firebase-admin) is not installed in the backend. Please install it and initialize with service account.' 
        });
      }
      throw firebaseErr;
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotificationLogs,
  retryNotification,
  registerDeviceToken,
  getMyNotifications,
  sendTestNotification
};
