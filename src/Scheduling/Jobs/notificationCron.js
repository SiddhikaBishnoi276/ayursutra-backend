const cron = require('node-cron');
const { pool } = require('../../config/db');
const { createAndSendNotification } = require('../../Notifications/Services/notificationService');

let isCronRunning = false;

const startNotificationCron = () => {
  if (isCronRunning) {
    console.log('Notification cron is already running, skipping registration.');
    return;
  }

  isCronRunning = true;
  console.log('Registering Notification Cron Jobs (runs every 15 minutes)...');

  cron.schedule('*/15 * * * *', async () => {
    try {
      console.log('Running scheduled notification checks...');
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // 1. T-24h Upcoming Session Reminder
        // Find sessions scheduled between 23h45m and 24h15m from now where reminder_sent = false
        const remindersQuery = `
          SELECT s.id, s.patient_id, s.scheduled_time, s.scheduled_date, r.name as room_name, tps.stage_type
          FROM sessions s
          LEFT JOIN rooms r ON s.room_id = r.id
          LEFT JOIN therapy_plan_stages tps ON s.plan_stage_id = tps.id
          WHERE s.status = 'scheduled' 
            AND s.reminder_sent = false
            AND (s.scheduled_date + s.scheduled_start_time) BETWEEN NOW() + INTERVAL '23 hours 45 minutes' AND NOW() + INTERVAL '24 hours 15 minutes'
          FOR UPDATE SKIP LOCKED;
        `;
        const remindersRes = await client.query(remindersQuery);
        
        for (const session of remindersRes.rows) {
          await createAndSendNotification({
            userId: session.patient_id,
            type: 'reminder',
            title: 'Upcoming Therapy Reminder ⏰',
            body: `Kal aapka ${session.stage_type} session ${session.scheduled_time || session.scheduled_date} ko ${session.room_name || 'clinic'} me scheduled hai. Please samay par pahuchein.`,
            data: { type: 'reminder', sessionId: session.id, route: '/patient/dashboard' },
            relatedSessionId: session.id,
          }).catch(err => console.error('Cron push failed:', err.message));
          
          await client.query('UPDATE sessions SET reminder_sent = true WHERE id = $1', [session.id]);
        }

        // 2. T-2h Pre-Care Preparation
        const preCareQuery = `
          SELECT s.id, s.patient_id, tps.package_stage_id, ps.pre_instructions
          FROM sessions s
          LEFT JOIN therapy_plan_stages tps ON s.plan_stage_id = tps.id
          LEFT JOIN therapy_package_stages ps ON tps.package_stage_id = ps.id
          WHERE s.status = 'scheduled' 
            AND s.preinstruction_sent = false
            AND (s.scheduled_date + s.scheduled_start_time) BETWEEN NOW() + INTERVAL '1 hour 45 minutes' AND NOW() + INTERVAL '2 hours 15 minutes'
          FOR UPDATE SKIP LOCKED;
        `;
        const preCareRes = await client.query(preCareQuery);

        for (const session of preCareRes.rows) {
          const preInstructions = session.pre_instructions || "Kripya 2 ghante pehle halka aahar lein aur chamber me aane se pehle bladder empty karein.";
          
          await createAndSendNotification({
            userId: session.patient_id,
            type: 'pre_instruction',
            title: 'Pre-Therapy Instructions 📋',
            body: preInstructions,
            data: { type: 'pre_instruction', sessionId: session.id, route: '/patient/dashboard' },
            relatedSessionId: session.id,
          }).catch(err => console.error('Cron push failed:', err.message));
          
          await client.query('UPDATE sessions SET preinstruction_sent = true WHERE id = $1', [session.id]);
        }

        // 3. T+30m Feedback Request
        const feedbackQuery = `
          SELECT s.id, s.patient_id
          FROM sessions s
          WHERE s.status = 'completed'
            AND s.feedback_sent = false
            AND s.actual_end_time BETWEEN NOW() - INTERVAL '60 minutes' AND NOW() - INTERVAL '30 minutes'
          FOR UPDATE SKIP LOCKED;
        `;
        const feedbackRes = await client.query(feedbackQuery);

        for (const session of feedbackRes.rows) {
          await createAndSendNotification({
            userId: session.patient_id,
            type: 'feedback_request',
            title: 'How was your therapy session? ⭐',
            body: "Kripya aaj ke session ka apna pain aur energy experience rate karein.",
            data: { type: 'reminder', sessionId: session.id, route: '/patient/feedback' },
            relatedSessionId: session.id,
          }).catch(err => console.error('Cron push failed:', err.message));
          
          await client.query('UPDATE sessions SET feedback_sent = true WHERE id = $1', [session.id]);
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in notification cron:', err);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Cron scheduling error:', err);
    }
  });
};

module.exports = { startNotificationCron };
