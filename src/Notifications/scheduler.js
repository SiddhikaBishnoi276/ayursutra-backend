const cron = require('node-cron');
const { pool } = require('../config/db');
const { NOTIFICATION_TYPES } = require('./constants');
const { dispatchNotification } = require('./notificationService');

/**
 * Helper to run a query and notify if not already dispatched.
 */
async function checkAndNotify({ query, notification_type, onMatch, getNotificationPayload }) {
  try {
    const res = await pool.query(query);
    for (const row of res.rows) {
      const payload = getNotificationPayload(row);
      // dispatchNotification handles the deduplication atomically
      const dispatched = await dispatchNotification({
        recipientId: payload.recipientId,
        type: notification_type,
        channel: payload.channel || 'both',
        content: payload.content,
        relatedSessionId: payload.relatedSessionId,
        title: payload.title,
      });

      if (dispatched && onMatch) {
        await onMatch(row);
      }
    }
  } catch (err) {
    console.error(`[Scheduler] Error in checkAndNotify for ${notification_type}:`, err.message);
  }
}

function startScheduler() {
  console.log('[Scheduler] Starting node-cron scheduler...');
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    // 1. T-24h Reminder
    await checkAndNotify({
      query: `SELECT * FROM sessions WHERE status = 'scheduled' 
              AND (scheduled_date + scheduled_start_time) BETWEEN NOW() + INTERVAL '23 hours 55 minutes' AND NOW() + INTERVAL '24 hours 5 minutes'`,
      notification_type: NOTIFICATION_TYPES.REMINDER_24H,
      getNotificationPayload: (session) => ({
        recipientId: session.patient_id,
        relatedSessionId: session.id,
        title: 'Session Reminder (24h)',
        content: `Reminder: You have a session in 24 hours.`,
      })
    });

    // 2. T-2h Reminder
    await checkAndNotify({
      query: `SELECT * FROM sessions WHERE status = 'scheduled' 
              AND (scheduled_date + scheduled_start_time) BETWEEN NOW() + INTERVAL '1 hour 55 minutes' AND NOW() + INTERVAL '2 hours 5 minutes'`,
      notification_type: NOTIFICATION_TYPES.REMINDER_2H,
      getNotificationPayload: (session) => ({
        recipientId: session.patient_id,
        relatedSessionId: session.id,
        title: 'Session Reminder (2h)',
        content: `Reminder: You have a session in 2 hours.`,
      })
    });

    // 3. T-10m Reminder
    await checkAndNotify({
      query: `SELECT * FROM sessions WHERE status = 'scheduled' 
              AND (scheduled_date + scheduled_start_time) BETWEEN NOW() + INTERVAL '5 minutes' AND NOW() + INTERVAL '15 minutes'`,
      notification_type: NOTIFICATION_TYPES.REMINDER_10M,
      getNotificationPayload: (session) => ({
        recipientId: session.patient_id,
        relatedSessionId: session.id,
        title: 'Session Starting Soon (10m)',
        content: `Reminder: Your session starts in 10 minutes.`,
      })
    });

    // 4. No-Show Detection (scheduled time passed + 20min, still scheduled)
    await checkAndNotify({
      query: `SELECT * FROM sessions WHERE status = 'scheduled' 
              AND (scheduled_date + scheduled_start_time) < NOW() - INTERVAL '20 minutes'`,
      notification_type: NOTIFICATION_TYPES.NO_SHOW,
      getNotificationPayload: (session) => ({
        recipientId: session.patient_id,
        relatedSessionId: session.id,
        title: 'Session Missed',
        content: `You appear to have missed your session.`,
      }),
      onMatch: async (session) => {
        await pool.query(`UPDATE sessions SET status = 'no_show' WHERE id = $1`, [session.id]);
        console.log(`[Scheduler] Marked session ${session.id} as no_show.`);
        // Note: Could also emit an event here to notify Doctor/Therapist
      }
    });

    // 5. Feedback Request (session completed 30-60 min ago, no feedback yet)
    await checkAndNotify({
      query: `SELECT s.* FROM sessions s
              LEFT JOIN patient_feedbacks pf ON pf.session_id = s.id
              WHERE s.status = 'completed'
              AND s.actual_end_time BETWEEN NOW() - INTERVAL '60 minutes' AND NOW() - INTERVAL '30 minutes'
              AND pf.id IS NULL`,
      notification_type: NOTIFICATION_TYPES.FEEDBACK_REQUEST,
      getNotificationPayload: (session) => ({
        recipientId: session.patient_id,
        relatedSessionId: session.id,
        title: 'How was your session?',
        content: `Please leave feedback for your recent session.`,
      })
    });

    // 6. Treatment Dropout Flag (active plan, no session activity in 24h)
    await checkAndNotify({
      query: `SELECT tp.* FROM therapy_plans tp
              WHERE tp.status = 'IN_PROGRESS'
              AND NOT EXISTS (
                SELECT 1 FROM sessions s WHERE s.plan_id = tp.id
                AND s.updated_at > NOW() - INTERVAL '24 hours'
              )`,
      notification_type: NOTIFICATION_TYPES.PLAN_PAUSED,
      getNotificationPayload: (plan) => ({
        recipientId: plan.patient_id,
        relatedSessionId: null,
        title: 'Therapy Plan Paused',
        content: `Your therapy plan has been paused due to inactivity.`,
      }),
      onMatch: async (plan) => {
        await pool.query(`UPDATE therapy_plans SET status = 'PAUSED' WHERE id = $1`, [plan.id]);
        console.log(`[Scheduler] Marked plan ${plan.id} as PAUSED.`);
      }
    });

  });
}

module.exports = {
  startScheduler,
};
