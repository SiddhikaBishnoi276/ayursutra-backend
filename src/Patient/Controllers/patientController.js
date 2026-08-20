const { pool } = require('../../config/db');

/**
 * Classical Ayurvedic Diet Guidelines mapped by Panchakarma stage type
 */
const STAGE_DIET_GUIDELINES = {
  Poorvakarma: {
    stage: 'Poorvakarma',
    pathya: 'Warm water, lightly spiced soups, Khichdi, ghee-infused warm meals',
    apathya: 'Cold water, refrigerated items, heavy sweets, daytime sleep',
  },
  Pradhanakarma: {
    stage: 'Pradhanakarma',
    pathya: 'Warm water, Thin Rice Gruel (Peya), light steamed vegetables',
    apathya: 'Heavy dairy, cold drinks, fried/spicy food, raw salads',
  },
  Paschatkarma: {
    stage: 'Paschatkarma',
    pathya: 'Gradual diet progression: Peya (thin gruel) -> Vilepi (thick gruel) -> Yusha (lentil soup) -> Odana (cooked rice)',
    apathya: 'Instant heavy meals, irregular eating times, direct sun/wind exposure',
  },
};

const patientController = {
  /**
   * 1. GET /api/patient/dashboard/:patientId
   * Fetches the patient's active treatment summary, sequential timeline, stage-specific diet recommendations, and simulated reminder.
   */
  getPatientDashboard: async (req, res) => {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required.',
      });
    }

    // 1. Fetch patient profile, confirmed Prakriti, and active therapy plan details
    const patientQuery = `
      SELECT 
        p.user_id AS patient_id,
        u.name,
        u.gender,
        pa.confirmed_dosha,
        tp.id AS plan_id,
        tp.status AS plan_status,
        COALESCE(tp_pkg.name, 'Custom Therapy Plan') AS active_package
      FROM patients p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN (
        SELECT DISTINCT ON (patient_id) patient_id, confirmed_dosha 
        FROM prakriti_assessments 
        ORDER BY patient_id, assessed_at DESC
      ) pa ON p.user_id = pa.patient_id
      LEFT JOIN therapy_plans tp ON p.user_id = tp.patient_id AND tp.status = 'active'
      LEFT JOIN therapy_packages tp_pkg ON tp.package_id = tp_pkg.id
      WHERE p.user_id = $1;
    `;

    const patientRes = await pool.query(patientQuery, [patientId]);

    if (patientRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Patient with ID ${patientId} not found.`,
      });
    }

    const patientData = patientRes.rows[0];

    let sessionsTimeline = [];
    let currentStageType = 'Poorvakarma';

    // 2. If active plan exists, fetch all sessions across sequential stages
    if (patientData.plan_id) {
      const timelineQuery = `
        SELECT 
          s.id AS session_id,
          tps.stage_type,
          tps.sequence_order,
          tps.status AS stage_status,
          TO_CHAR(s.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
          s.scheduled_time::text AS scheduled_time,
          COALESCE(r.name, 'Unassigned') AS room_name,
          s.status AS session_status
        FROM sessions s
        JOIN therapy_plan_stages tps ON s.plan_stage_id = tps.id
        LEFT JOIN rooms r ON s.room_id = r.id
        WHERE tps.plan_id = $1
        ORDER BY tps.sequence_order ASC, s.scheduled_date ASC, s.scheduled_time ASC;
      `;

      const timelineRes = await pool.query(timelineQuery, [patientData.plan_id]);
      sessionsTimeline = timelineRes.rows;

      // Determine the current active / in_progress / unlocked stage
      const inProgressStage = sessionsTimeline.find((item) => item.stage_status === 'in_progress');
      const unlockedStage = sessionsTimeline.find((item) => item.stage_status === 'unlocked');

      if (inProgressStage) {
        currentStageType = inProgressStage.stage_type;
      } else if (unlockedStage) {
        currentStageType = unlockedStage.stage_type;
      } else if (sessionsTimeline.length > 0) {
        // If all completed or none unlocked yet, pick last or first
        const allCompleted = sessionsTimeline.every((item) => item.stage_status === 'complete');
        currentStageType = allCompleted
          ? sessionsTimeline[sessionsTimeline.length - 1].stage_type
          : sessionsTimeline[0].stage_type;
      }
    }

    // 3. Stage-specific Diet instructions
    const currentDietInstructions = STAGE_DIET_GUIDELINES[currentStageType] || {
      stage: currentStageType,
      pathya: 'Warm water, lightly cooked nourishing sattvic meals',
      apathya: 'Heavy, fried, oily, and cold foods',
    };

    // 4. Simulated Contextual Reminder
    let simulatedReminder = 'Your next detox session is scheduled for tomorrow. Maintain light fasting 2 hours prior.';
    const nextSession = sessionsTimeline.find(
      (s) => s.session_status === 'scheduled' || s.session_status === 'in_progress'
    );

    if (nextSession) {
      simulatedReminder = `Your next ${nextSession.stage_type} session is scheduled for ${nextSession.scheduled_date} at ${nextSession.scheduled_time}. Maintain light fasting 2 hours prior.`;
    } else if (sessionsTimeline.length > 0) {
      simulatedReminder = 'All sessions in your active protocol are completed. Please consult your Ayurvedic doctor for a follow-up assessment.';
    } else {
      simulatedReminder = 'No upcoming sessions scheduled. Please contact your clinic administrator.';
    }

    return res.status(200).json({
      patient_info: {
        patient_id: patientData.patient_id,
        name: patientData.name,
        gender: patientData.gender,
        confirmed_dosha: patientData.confirmed_dosha || 'Pending Assessment',
        active_package: patientData.active_package,
        plan_status: patientData.plan_status || 'inactive',
      },
      sessions_timeline: sessionsTimeline,
      current_diet_instructions: currentDietInstructions,
      simulated_reminder: simulatedReminder,
    });
  },

  /**
   * 2. POST /api/patient/feedback
   * Records the patient's post-session clinical feedback.
   */
  submitFeedback: async (req, res) => {
    const {
      session_id,
      patient_id,
      pain_scale = null,
      sleep_quality = null,
      energy_level = null,
      side_effects = '',
    } = req.body;

    if (!session_id || !patient_id) {
      return res.status(400).json({
        success: false,
        message: 'session_id and patient_id are required fields.',
      });
    }

    const parsedSessionId = parseInt(session_id, 10);
    if (isNaN(parsedSessionId)) {
      return res.status(400).json({
        success: false,
        message: 'session_id must be a valid integer.',
      });
    }

    const queryText = `
      INSERT INTO patient_feedback (
        session_id,
        patient_id,
        pain_scale,
        sleep_quality,
        energy_level,
        side_effects
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, submitted_at;
    `;

    const result = await pool.query(queryText, [
      parsedSessionId,
      patient_id,
      pain_scale !== null ? parseInt(pain_scale, 10) : null,
      sleep_quality !== null ? parseInt(sleep_quality, 10) : null,
      energy_level !== null ? parseInt(energy_level, 10) : null,
      side_effects || null,
    ]);

    const createdFeedback = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback_id: createdFeedback.id,
    });
  },
};

module.exports = patientController;
