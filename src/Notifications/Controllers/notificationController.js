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
const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit, offset, unreadOnly } = req.query;
    const logs = await notificationService.getUserNotifications(userId, { limit, offset, unreadOnly: unreadOnly === 'true' });
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updated = await notificationService.markAsRead(id, userId);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await notificationService.markAllAsRead(userId);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

const registerDeviceToken = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });
    
    await notificationService.registerDeviceToken(userId, token);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

const testSendNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, body, type, data } = req.body;
    
    const record = await notificationService.createAndSendNotification({
      userId,
      type: type || 'test_notification',
      title: title || 'Test Notification',
      body: body || 'This is a test notification from AyurSutra.',
      data: data || {}
    });
    
    res.status(200).json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotificationLogs,
  retryNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  testSendNotification
};
