const { pool } = require('../config/db');

/**
 * Dispatch a notification.
 * Saves to DB and handles dedup via unique constraint on (related_session_id, recipient_id, type).
 * Fallback mechanism for FCM/SMS/WhatsApp is mocked.
 */
async function dispatchNotification({ recipientId, type, channel, content, relatedSessionId, title, data = {} }) {
  try {
    // 1. Write to DB (Atomic Deduplication)
    const query = `
      INSERT INTO notifications (recipient_id, type, channel, content, related_session_id, scheduled_at, title, data)
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
      RETURNING *;
    `;
    const values = [recipientId, type, channel, content, relatedSessionId, title, data];
    
    let notificationRecord;
    try {
      const res = await pool.query(query, values);
      notificationRecord = res.rows[0];
    } catch (err) {
      // 23505 is PostgreSQL's unique_violation error code
      if (err.code === '23505') {
        console.log(`[Notification Engine] Skipping duplicate notification: ${type} for recipient ${recipientId}, session ${relatedSessionId}`);
        return null;
      }
      throw err;
    }

    // 2. Dispatch via external services
    // Real implementation would use admin.messaging().send(payload) for FCM
    console.log(`[Notification Engine] Dispatched FCM push to ${recipientId}: "${title}"`);
    let deliveryStatus = 'fcm_sent';

    // Mock fallback mechanism
    const fcmSucceeded = Math.random() > 0.1; // 90% success rate mock
    if (!fcmSucceeded) {
      console.log(`[Notification Engine] FCM failed for ${recipientId}, falling back...`);
      if (channel === 'sms' || channel === 'both') {
        console.log(`[Notification Engine] MOCK SMS sent to ${recipientId}: "${content}"`);
        deliveryStatus = 'sms_fallback_sent';
      } else if (channel === 'whatsapp') {
        console.log(`[Notification Engine] MOCK WhatsApp sent to ${recipientId}: "${content}"`);
        deliveryStatus = 'whatsapp_fallback_sent';
      }
    }

    // 3. Update DB record with delivery status
    await pool.query(
      `UPDATE notifications SET sent_at = NOW(), delivery_status = $1 WHERE id = $2`,
      [deliveryStatus, notificationRecord.id]
    );

    return notificationRecord;
  } catch (error) {
    console.error(`[Notification Engine] Error dispatching notification:`, error.message);
    throw error;
  }
}

module.exports = {
  dispatchNotification,
};
