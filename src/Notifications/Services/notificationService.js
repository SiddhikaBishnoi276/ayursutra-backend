const { pool } = require('../../config/db');

const getNotificationLogs = async () => {
  const result = await pool.query(
    `SELECT 
      n.id, 
      u.name AS recipient_name, 
      u.role AS recipient_role, 
      n.channel, 
      n.content AS message, 
      n.delivery_status AS status,
      COALESCE(n.sent_at, n.scheduled_at, NOW()) AS timestamp
     FROM notifications n
     JOIN users u ON n.recipient_id = u.id
     ORDER BY n.id DESC`
  );

  return result.rows.map(row => ({
    id: `NL-${row.id.toString().padStart(2, '0')}`,
    recipientName: row.recipient_name,
    recipientRole: row.recipient_role,
    channel: row.channel === 'sms' ? 'SMS' : row.channel === 'whatsapp' ? 'WhatsApp' : 'Push',
    message: row.message,
    status: row.status === 'failed' ? 'Failed' : row.status === 'sent' ? 'Sent' : 'Pending',
    timestamp: row.timestamp,
    _raw_id: row.id
  }));
};

const retryNotification = async (rawId) => {
  const result = await pool.query(
    `UPDATE notifications 
     SET delivery_status = 'pending', sent_at = NULL
     WHERE id = $1
     RETURNING *`,
    [rawId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Notification not found');
  }

  // Fetch updated notification with recipient info
  const updatedLog = await pool.query(
    `SELECT 
      n.id, 
      u.name AS recipient_name, 
      u.role AS recipient_role, 
      n.channel, 
      n.content AS message, 
      n.delivery_status AS status,
      COALESCE(n.sent_at, n.scheduled_at, NOW()) AS timestamp
     FROM notifications n
     JOIN users u ON n.recipient_id = u.id
     WHERE n.id = $1`,
     [rawId]
  );

  const row = updatedLog.rows[0];
  return {
    id: `NL-${row.id.toString().padStart(2, '0')}`,
    recipientName: row.recipient_name,
    recipientRole: row.recipient_role,
    channel: row.channel === 'sms' ? 'SMS' : row.channel === 'whatsapp' ? 'WhatsApp' : 'Push',
    message: row.message,
    status: row.status === 'failed' ? 'Failed' : row.status === 'sent' ? 'Sent' : 'Pending',
    timestamp: row.timestamp,
    _raw_id: row.id
  };
};

module.exports = {
  getNotificationLogs,
  retryNotification
};
