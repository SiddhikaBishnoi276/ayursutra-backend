const { pool } = require('../../config/db');

const { messaging } = require('../../config/firebaseAdmin');

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

const registerDeviceToken = async (userId, token) => {
  await pool.query(
    `INSERT INTO user_device_tokens (user_id, token, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (token) DO UPDATE SET user_id = $1, updated_at = NOW()`,
    [userId, token]
  );
  return { success: true };
};

const getTokensByUserId = async (userId) => {
  const res = await pool.query(
    `SELECT token FROM user_device_tokens WHERE user_id = $1`,
    [userId]
  );
  return res.rows.map(r => r.token);
};

const sendNotificationToUser = async (userId, { title, body, data }) => {
  try {
    const tokens = await getTokensByUserId(userId);
    if (!tokens || tokens.length === 0) return { success: false, message: 'No device tokens' };
    
    const message = {
      notification: { title: title || 'AyurSutra Alert', body: body || '' },
      data: data || {},
      tokens
    };
    
    const response = await messaging.sendEachForMulticast(message);
    return { success: true, response };
  } catch (err) {
    console.error('Error in sendNotificationToUser:', err);
    return { success: false, error: err.message };
  }
};

const createAndSendNotification = async ({ userId, type, title, body, data, relatedSessionId, channel = 'push' }) => {
  // 1. Insert into notifications table
  let dbResult;
  try {
    dbResult = await pool.query(
      `INSERT INTO notifications (recipient_id, type, channel, title, content, data, related_session_id, delivery_status, sent_at, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sent', NOW(), false)
       RETURNING *`,
      [userId, type || 'operational_alert', channel, title || '', body || '', data || {}, relatedSessionId || null]
    );
  } catch (dbErr) {
    console.error('Failed to insert notification into DB:', dbErr);
    throw dbErr;
  }
  
  const record = dbResult.rows[0];

  // 2. Dispatch via FCM (wrapped in try-catch so it does not fail the DB insertion)
  if (channel === 'push') {
    try {
      await sendNotificationToUser(userId, { title, body, data });
    } catch (pushErr) {
      console.error('FCM push dispatch failed but DB log succeeded:', pushErr);
    }
  }

  return record;
};

const getUserNotifications = async (userId, { limit = 50, offset = 0, unreadOnly = false } = {}) => {
  let queryText = `
    SELECT id, recipient_id, type, channel, title, content, data, related_session_id, delivery_status, sent_at, is_read, read_at
    FROM notifications
    WHERE recipient_id = $1
  `;
  const queryParams = [userId];

  if (unreadOnly) {
    queryText += ` AND is_read = false`;
  }
  
  queryText += ` ORDER BY COALESCE(sent_at, scheduled_at, id::text::timestamp) DESC LIMIT $2 OFFSET $3`;
  queryParams.push(limit, offset);

  const result = await pool.query(queryText, queryParams);
  
  return result.rows.map(row => ({
    id: row.id,
    type: row.type,
    channel: row.channel,
    title: row.title,
    message: row.content,
    data: row.data,
    related_session_id: row.related_session_id,
    is_read: row.is_read,
    time: row.sent_at || new Date().toISOString(),
  }));
};

const markAsRead = async (notificationId, userId) => {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE id = $1 AND recipient_id = $2
     RETURNING *`,
    [notificationId, userId]
  );
  return result.rows[0];
};

const markAllAsRead = async (userId) => {
  await pool.query(
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE recipient_id = $1 AND is_read = false`,
    [userId]
  );
  return { success: true };
};

module.exports = {
  getNotificationLogs,
  retryNotification,
  registerDeviceToken,
  getTokensByUserId,
  sendNotificationToUser,
  createAndSendNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead
};
