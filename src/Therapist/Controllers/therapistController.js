const { pool } = require('../../config/db');

/**
 * Therapist View Controller
 * Handles Therapist daily queue, starting sessions, and core clinical progression engine.
 */
const therapistController = {
  /**
   * 1. GET /api/therapist/queue/:therapistId
   * Fetches daily active/pending sessions assigned to the therapist.
   */
  getTherapistQueue: async (req, res) => {
    const { therapistId } = req.params;

    if (!therapistId) {
      return res.status(400).json({
        success: false,
        message: 'Therapist ID is required.',
      });
    }

    const queryText = `
      SELECT 
        s.id AS session_id,
        s.patient_id,
        patient_user.name AS patient_name,
        patient_user.gender AS patient_gender,
        tps.stage_type,
        tps.status AS stage_status,
        COALESCE(r.name, 'Unassigned') AS room_name,
        TO_CHAR(s.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
        s.scheduled_time::text AS scheduled_time,
        s.status
      FROM sessions s
      JOIN patients p ON s.patient_id = p.user_id
      JOIN users patient_user ON p.user_id = patient_user.id
      LEFT JOIN rooms r ON s.room_id = r.id
      JOIN therapy_plan_stages tps ON s.plan_stage_id = tps.id
      WHERE s.therapist_id = $1 
        AND s.status IN ('scheduled', 'in_progress')
      ORDER BY s.scheduled_date ASC, s.scheduled_time ASC, tps.sequence_order ASC;
    `;

    const result = await pool.query(queryText, [therapistId]);

    return res.status(200).json(result.rows);
  },

  /**
   * 2. PATCH /api/sessions/:sessionId/start
   * Moves a session from 'scheduled' to 'in_progress' and updates the parent stage status.
   */
  startSession: async (req, res) => {
    const { sessionId } = req.params;
    const parsedSessionId = parseInt(sessionId, 10);

    if (isNaN(parsedSessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID provided.',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Check if session exists and is scheduled
      const sessionQuery = `
        SELECT id, plan_stage_id, status 
        FROM sessions 
        WHERE id = $1
        FOR UPDATE;
      `;
      const sessionRes = await client.query(sessionQuery, [parsedSessionId]);

      if (sessionRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: `Session with ID ${parsedSessionId} not found.`,
        });
      }

      const currentSession = sessionRes.rows[0];

      if (currentSession.status === 'in_progress') {
        await client.query('ROLLBACK');
        return res.status(200).json({
          success: true,
          message: 'Session is already in_progress',
          session_id: parsedSessionId,
          status: 'in_progress',
        });
      }

      if (currentSession.status === 'completed') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Cannot start a session that is already completed.',
        });
      }

      // 2. Update session to 'in_progress' and record actual_start_time
      const updateSessionQuery = `
        UPDATE sessions 
        SET status = 'in_progress', actual_start_time = CURRENT_TIMESTAMP 
        WHERE id = $1
        RETURNING id, status, actual_start_time;
      `;
      await client.query(updateSessionQuery, [parsedSessionId]);

      // 3. Update the parent therapy plan stage status to 'in_progress'
      const updateStageQuery = `
        UPDATE therapy_plan_stages 
        SET status = 'in_progress' 
        WHERE id = $1;
      `;
      await client.query(updateStageQuery, [currentSession.plan_stage_id]);

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Session marked in_progress',
        session_id: parsedSessionId,
        status: 'in_progress',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * 3. POST /api/sessions/:sessionId/complete (Core Progression Engine)
   * Submits clinical observation and executes sequential stage-locking / doctor alert logic within a single transaction.
   */
  completeSession: async (req, res) => {
    const { sessionId } = req.params;
    const parsedSessionId = parseInt(sessionId, 10);

    if (isNaN(parsedSessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID provided.',
      });
    }

    const {
      therapist_id,
      dosage_given = '',
      patient_response = 'normal',
      vitals = {},
      complication_notes = '',
      has_complication = false,
    } = req.body;

    const normalizedResponse = patient_response.toLowerCase().trim();
    if (!['normal', 'abnormal'].includes(normalizedResponse)) {
      return res.status(400).json({
        success: false,
        message: "patient_response must be either 'normal' or 'abnormal'.",
      });
    }

    const isComplication =
      normalizedResponse === 'abnormal' ||
      has_complication === true ||
      has_complication === 'true' ||
      (typeof complication_notes === 'string' && complication_notes.trim().length > 0);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Step B Context Lookup: Fetch parent stage, plan, and treating doctor
      const contextQuery = `
        SELECT 
          s.id AS session_id,
          s.status AS session_status,
          s.plan_stage_id,
          s.therapist_id,
          tps.plan_id,
          tps.sequence_order,
          tp.doctor_id
        FROM sessions s
        JOIN therapy_plan_stages tps ON s.plan_stage_id = tps.id
        JOIN therapy_plans tp ON tps.plan_id = tp.id
        WHERE s.id = $1
        FOR UPDATE;
      `;
      const contextRes = await client.query(contextQuery, [parsedSessionId]);

      if (contextRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: `Session with ID ${parsedSessionId} not found or incomplete therapy plan linkage.`,
        });
      }

      const sessionContext = contextRes.rows[0];
      const recordedBy = therapist_id || sessionContext.therapist_id || null;

      // Step A: Insert record into session_observations
      const observationQuery = `
        INSERT INTO session_observations (
          session_id,
          dosage_given,
          patient_response,
          vitals,
          complication_notes,
          recorded_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (session_id) 
        DO UPDATE SET
          dosage_given = EXCLUDED.dosage_given,
          patient_response = EXCLUDED.patient_response,
          vitals = EXCLUDED.vitals,
          complication_notes = EXCLUDED.complication_notes,
          recorded_by = EXCLUDED.recorded_by,
          recorded_at = CURRENT_TIMESTAMP
        RETURNING id;
      `;

      const obsRes = await client.query(observationQuery, [
        parsedSessionId,
        dosage_given,
        normalizedResponse,
        JSON.stringify(vitals || {}),
        complication_notes || null,
        recordedBy,
      ]);

      const observationId = obsRes.rows[0].id;

      // Step C (Branch 1 - Complication / Abnormal Response)
      if (isComplication) {
        // 1. Update session status to completed and set actual_end_time
        const updateSessionQuery = `
          UPDATE sessions 
          SET status = 'completed', actual_end_time = CURRENT_TIMESTAMP 
          WHERE id = $1;
        `;
        await client.query(updateSessionQuery, [parsedSessionId]);

        // 2. Insert alert into complication_alerts for treating doctor
        const alertQuery = `
          INSERT INTO complication_alerts (
            session_observation_id,
            doctor_id,
            status
          )
          VALUES ($1, $2, 'pending')
          RETURNING id;
        `;
        await client.query(alertQuery, [
          observationId,
          sessionContext.doctor_id,
        ]);

        // 3. DO NOT unlock next stage. Keep subsequent stages 'locked'.
        await client.query('COMMIT');

        return res.status(200).json({
          status: 'FLAGGED',
          stage_unlocked: false,
          alert_generated: true,
          message: 'Complication recorded. Doctor alerted and next stage progression paused.',
        });
      }

      // Step D (Branch 2 - Normal Success Flow)
      // 1. Update session status to completed and set actual_end_time
      const updateSessionQuery = `
        UPDATE sessions 
        SET status = 'completed', actual_end_time = CURRENT_TIMESTAMP 
        WHERE id = $1;
      `;
      await client.query(updateSessionQuery, [parsedSessionId]);

      // 2. Update current therapy plan stage to 'complete'
      const updateCurrentStageQuery = `
        UPDATE therapy_plan_stages 
        SET status = 'complete' 
        WHERE id = $1;
      `;
      await client.query(updateCurrentStageQuery, [sessionContext.plan_stage_id]);

      // 3. Query for the next sequential stage in the therapy plan
      const nextStageQuery = `
        SELECT id 
        FROM therapy_plan_stages 
        WHERE plan_id = $1 AND sequence_order = $2;
      `;
      const nextStageRes = await client.query(nextStageQuery, [
        sessionContext.plan_id,
        sessionContext.sequence_order + 1,
      ]);

      let nextStageUnlocked = false;

      // 4. If next stage exists, unlock it
      if (nextStageRes.rows.length > 0) {
        const nextStageId = nextStageRes.rows[0].id;
        const unlockStageQuery = `
          UPDATE therapy_plan_stages 
          SET status = 'unlocked' 
          WHERE id = $1;
        `;
        await client.query(unlockStageQuery, [nextStageId]);
        nextStageUnlocked = true;
      }

      await client.query('COMMIT');

      return res.status(200).json({
        status: 'COMPLETED',
        stage_unlocked: true,
        alert_generated: false,
        message: 'Session completed successfully. Next sequential stage unlocked.',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = therapistController;
