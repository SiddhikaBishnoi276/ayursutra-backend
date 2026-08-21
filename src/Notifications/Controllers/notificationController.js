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

module.exports = {
  getNotificationLogs,
  retryNotification
};
