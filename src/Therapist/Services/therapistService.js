const { pool } = require('../../config/db');

/**
 * Standard Classical Ayurvedic Prep Materials by Stage Type
 */
const DEFAULT_STAGE_MATERIALS = {
  Poorvakarma: [
    {
      name: 'Medicated Ghee / Taila',
      quantityRequired: '50ml',
      quantity_required: '50ml',
      inStock: 500,
      in_stock: 500,
    },
    {
      name: 'Herbal Kwatha',
      quantityRequired: '100ml',
      quantity_required: '100ml',
      inStock: 300,
      in_stock: 300,
    },
  ],
  Pradhanakarma: [
    {
      name: 'Classical Karma Formulation (Virechana/Vamana)',
      quantityRequired: '1 dose',
      quantity_required: '1 dose',
      inStock: 150,
      in_stock: 150,
    },
    {
      name: 'Saindhava Lavana & Honey',
      quantityRequired: '20g',
      quantity_required: '20g',
      inStock: 200,
      in_stock: 200,
    },
  ],
  Paschatkarma: [
    {
      name: 'Medicated Peya Gruel Mix',
      quantityRequired: '200ml',
      quantity_required: '200ml',
      inStock: 400,
      in_stock: 400,
    },
    {
      name: 'Samsarjana Herbal Digestive Churna',
      quantityRequired: '10g',
      quantity_required: '10g',
      inStock: 250,
      in_stock: 250,
    },
  ],
};

const DEFAULT_PRE_INSTRUCTIONS = {
  Poorvakarma: 'Ensure patient is lightly fasted (2 hrs prior).',
  Pradhanakarma: 'Ensure patient is completely fasting and baseline vitals monitored.',
  Paschatkarma: 'Begin Samsarjana Krama gradual diet regimen and avoid direct wind.',
};

/**
 * Therapist Service Layer
 * Enforces business logic, DB querying, ACID transactions, and dual contracts.
 */
const therapistService = {
  /**
   * 1. Get daily queue for therapist with dual contracts and preparation metadata.
   */
  getQueue: async (therapistId, options = {}) => {
    let queryText = `
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
        s.status,
        s.therapist_id,
        COALESCE(therapist_user.name, 'Assigned Therapist') AS therapist_name,
        pkg_stage.pre_instructions AS pkg_pre_instructions
      FROM sessions s
      JOIN patients p ON s.patient_id = p.user_id
      JOIN users patient_user ON p.user_id = patient_user.id
      LEFT JOIN rooms r ON s.room_id = r.id
      JOIN therapy_plan_stages tps ON s.plan_stage_id = tps.id
      LEFT JOIN therapy_package_stages pkg_stage ON tps.package_stage_id = pkg_stage.id
      LEFT JOIN users therapist_user ON s.therapist_id = therapist_user.id
      WHERE s.therapist_id = $1 
        AND s.status IN ('scheduled', 'in_progress')
    `;

    const queryParams = [therapistId];

    if (options.date) {
      queryParams.push(options.date);
      queryText += ` AND s.scheduled_date = $${queryParams.length}`;
    }

    queryText += ` ORDER BY s.scheduled_date ASC, s.scheduled_time ASC, tps.sequence_order ASC;`;

    const result = await pool.query(queryText, queryParams);

    return result.rows.map((row) => {
      const stageKey = row.stage_type || 'Poorvakarma';
      const materials = DEFAULT_STAGE_MATERIALS[stageKey] || DEFAULT_STAGE_MATERIALS.Poorvakarma;
      const preInstructions =
        row.pkg_pre_instructions ||
        DEFAULT_PRE_INSTRUCTIONS[stageKey] ||
        DEFAULT_PRE_INSTRUCTIONS.Poorvakarma;

      return {
        id: String(row.session_id),
        sessionId: row.session_id,
        session_id: row.session_id,
        patientId: row.patient_id,
        patient_id: row.patient_id,
        patientName: row.patient_name,
        patient_name: row.patient_name,
        patientGender: row.patient_gender,
        patient_gender: row.patient_gender,
        stageCategory: row.stage_type,
        stage_type: row.stage_type,
        stageName: row.stage_type,
        stageStatus: row.stage_status,
        stage_status: row.stage_status,
        roomName: row.room_name,
        room_name: row.room_name,
        scheduledDate: row.scheduled_date,
        scheduled_date: row.scheduled_date,
        scheduledTime: row.scheduled_time,
        scheduled_time: row.scheduled_time,
        startTime: row.scheduled_time,
        status: row.status,
        therapistId: row.therapist_id,
        therapist_id: row.therapist_id,
        therapistName: row.therapist_name,
        therapist_name: row.therapist_name,
        materials,
        preInstructions,
        pre_instructions: preInstructions,
      };
    });
  },

  /**
   * 2. Start active therapy session (status: in_progress).
   */
  startSession: async (parsedSessionId) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const sessionQuery = `
        SELECT id, plan_stage_id, status 
        FROM sessions 
        WHERE id = $1
        FOR UPDATE;
      `;
      const sessionRes = await client.query(sessionQuery, [parsedSessionId]);

      if (sessionRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 404,
          data: {
            success: false,
            message: `Session with ID ${parsedSessionId} not found.`,
          },
        };
      }

      const currentSession = sessionRes.rows[0];

      if (currentSession.status === 'in_progress') {
        await client.query('ROLLBACK');
        return {
          statusCode: 200,
          data: {
            success: true,
            message: 'Session is already in_progress',
            sessionId: parsedSessionId,
            session_id: parsedSessionId,
            status: 'in_progress',
          },
        };
      }

      if (currentSession.status === 'completed') {
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          data: {
            success: false,
            message: 'Cannot start a session that is already completed.',
          },
        };
      }

      const updateSessionQuery = `
        UPDATE sessions 
        SET status = 'in_progress', actual_start_time = CURRENT_TIMESTAMP 
        WHERE id = $1
        RETURNING id, status, actual_start_time;
      `;
      const updateRes = await client.query(updateSessionQuery, [parsedSessionId]);
      const updatedRow = updateRes.rows[0];

      const updateStageQuery = `
        UPDATE therapy_plan_stages 
        SET status = 'in_progress' 
        WHERE id = $1;
      `;
      await client.query(updateStageQuery, [currentSession.plan_stage_id]);

      await client.query('COMMIT');

      return {
        statusCode: 200,
        data: {
          success: true,
          message: 'Session marked in_progress',
          sessionId: parsedSessionId,
          session_id: parsedSessionId,
          status: 'in_progress',
          actualStartTime: updatedRow.actual_start_time,
          actual_start_time: updatedRow.actual_start_time,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * 3. Complete therapy session & handle progression or complication alerts.
   */
  completeSession: async (parsedSessionId, payload) => {
    const {
      therapistId,
      dosageGiven = '',
      patientResponse = 'normal',
      vitals = {},
      complicationNotes = '',
      hasComplication = false,
    } = payload;

    const normalizedResponse = String(patientResponse).toLowerCase().trim();
    if (!['normal', 'abnormal'].includes(normalizedResponse)) {
      return {
        statusCode: 400,
        data: {
          success: false,
          message: "patient_response must be either 'normal' or 'abnormal'.",
        },
      };
    }

    const isComplication =
      normalizedResponse === 'abnormal' ||
      hasComplication === true ||
      hasComplication === 'true' ||
      (typeof complicationNotes === 'string' && complicationNotes.trim().length > 0);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

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
        return {
          statusCode: 404,
          data: {
            success: false,
            message: `Session with ID ${parsedSessionId} not found or incomplete therapy plan linkage.`,
          },
        };
      }

      const sessionContext = contextRes.rows[0];
      const recordedBy = therapistId || sessionContext.therapist_id || null;

      // Upsert into session_observations
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
        dosageGiven,
        normalizedResponse,
        typeof vitals === 'object' ? JSON.stringify(vitals) : vitals || '{}',
        complicationNotes || null,
        recordedBy,
      ]);

      const observationId = obsRes.rows[0].id;

      if (isComplication) {
        // Update session status to completed
        const updateSessionQuery = `
          UPDATE sessions 
          SET status = 'completed', actual_end_time = CURRENT_TIMESTAMP 
          WHERE id = $1;
        `;
        await client.query(updateSessionQuery, [parsedSessionId]);

        // Insert alert into complication_alerts
        const alertQuery = `
          INSERT INTO complication_alerts (
            session_observation_id,
            doctor_id,
            status
          )
          VALUES ($1, $2, 'pending')
          RETURNING id;
        `;
        const alertRes = await client.query(alertQuery, [
          observationId,
          sessionContext.doctor_id,
        ]);
        const alertId = alertRes.rows[0].id;

        await client.query('COMMIT');

        return {
          statusCode: 200,
          data: {
            success: true,
            status: 'FLAGGED',
            stageUnlocked: false,
            stage_unlocked: false,
            alertGenerated: true,
            alert_generated: true,
            alertId,
            alert_id: alertId,
            sessionId: parsedSessionId,
            session_id: parsedSessionId,
            message: 'Complication recorded. Doctor alerted and next stage progression paused.',
          },
        };
      }

      // Normal Success Flow
      const updateSessionQuery = `
        UPDATE sessions 
        SET status = 'completed', actual_end_time = CURRENT_TIMESTAMP 
        WHERE id = $1;
      `;
      await client.query(updateSessionQuery, [parsedSessionId]);

      // Complete current stage
      const updateCurrentStageQuery = `
        UPDATE therapy_plan_stages 
        SET status = 'complete' 
        WHERE id = $1;
      `;
      await client.query(updateCurrentStageQuery, [sessionContext.plan_stage_id]);

      // Find next sequential stage
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
      let nextStageId = null;

      if (nextStageRes.rows.length > 0) {
        nextStageId = nextStageRes.rows[0].id;
        const unlockStageQuery = `
          UPDATE therapy_plan_stages 
          SET status = 'unlocked' 
          WHERE id = $1;
        `;
        await client.query(unlockStageQuery, [nextStageId]);
        nextStageUnlocked = true;
      }

      await client.query('COMMIT');

      return {
        statusCode: 200,
        data: {
          success: true,
          status: 'COMPLETED',
          stageUnlocked: nextStageUnlocked,
          stage_unlocked: nextStageUnlocked,
          nextStageId,
          next_stage_id: nextStageId,
          alertGenerated: false,
          alert_generated: false,
          sessionId: parsedSessionId,
          session_id: parsedSessionId,
          message: 'Session completed successfully. Next sequential stage unlocked.',
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * 4. Emergency Pause Session.
   */
  pauseSession: async (parsedSessionId, payload = {}) => {
    const {
      therapistId,
      reason = 'Emergency session pause triggered by therapist',
      vitals = {},
      dosageGiven = '',
    } = payload;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const contextQuery = `
        SELECT 
          s.id AS session_id,
          s.status AS session_status,
          s.plan_stage_id,
          s.therapist_id,
          tps.plan_id,
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
        return {
          statusCode: 404,
          data: {
            success: false,
            message: `Session with ID ${parsedSessionId} not found.`,
          },
        };
      }

      const sessionContext = contextRes.rows[0];
      const recordedBy = therapistId || sessionContext.therapist_id || null;

      // Upsert observation with abnormal status & reason
      const observationQuery = `
        INSERT INTO session_observations (
          session_id,
          dosage_given,
          patient_response,
          vitals,
          complication_notes,
          recorded_by
        )
        VALUES ($1, $2, 'abnormal', $3, $4, $5)
        ON CONFLICT (session_id) 
        DO UPDATE SET
          patient_response = 'abnormal',
          vitals = EXCLUDED.vitals,
          complication_notes = EXCLUDED.complication_notes,
          recorded_by = EXCLUDED.recorded_by,
          recorded_at = CURRENT_TIMESTAMP
        RETURNING id;
      `;

      const obsRes = await client.query(observationQuery, [
        parsedSessionId,
        dosageGiven,
        typeof vitals === 'object' ? JSON.stringify(vitals) : vitals || '{}',
        reason,
        recordedBy,
      ]);

      const observationId = obsRes.rows[0].id;

      // Create doctor alert
      const alertQuery = `
        INSERT INTO complication_alerts (
          session_observation_id,
          doctor_id,
          status
        )
        VALUES ($1, $2, 'pending')
        RETURNING id;
      `;
      const alertRes = await client.query(alertQuery, [
        observationId,
        sessionContext.doctor_id,
      ]);
      const alertId = alertRes.rows[0].id;

      await client.query('COMMIT');

      return {
        statusCode: 200,
        data: {
          success: true,
          message: 'Emergency pause triggered successfully. Treating doctor alerted.',
          sessionId: parsedSessionId,
          session_id: parsedSessionId,
          status: 'PAUSED',
          alertGenerated: true,
          alert_generated: true,
          alertId,
          alert_id: alertId,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * 5. Shift Handover / Session Reassignment.
   */
  shiftHandover: async ({
    sourceTherapistId,
    targetTherapistId,
    sessionIds,
    date,
    notes,
  }) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify target therapist exists and is a therapist
      const therapistCheck = await client.query(
        `SELECT id, name, role FROM users WHERE id = $1 AND role = 'therapist' AND is_active = true`,
        [targetTherapistId]
      );

      if (therapistCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          data: {
            success: false,
            message: 'Target therapist not found or is inactive/invalid role.',
          },
        };
      }

      const targetTherapist = therapistCheck.rows[0];

      let updateQuery;
      let queryParams;

      if (Array.isArray(sessionIds) && sessionIds.length > 0) {
        updateQuery = `
          UPDATE sessions 
          SET therapist_id = $1 
          WHERE id = ANY($2) AND status IN ('scheduled', 'in_progress')
          RETURNING id, status, TO_CHAR(scheduled_date, 'YYYY-MM-DD') AS scheduled_date, scheduled_time::text AS scheduled_time, patient_id;
        `;
        queryParams = [targetTherapistId, sessionIds];
      } else if (sourceTherapistId) {
        updateQuery = `
          UPDATE sessions 
          SET therapist_id = $1 
          WHERE therapist_id = $2 
            AND status IN ('scheduled', 'in_progress')
            ${date ? 'AND scheduled_date = $3' : 'AND scheduled_date >= CURRENT_DATE'}
          RETURNING id, status, TO_CHAR(scheduled_date, 'YYYY-MM-DD') AS scheduled_date, scheduled_time::text AS scheduled_time, patient_id;
        `;
        queryParams = date ? [targetTherapistId, sourceTherapistId, date] : [targetTherapistId, sourceTherapistId];
      } else {
        await client.query('ROLLBACK');
        return {
          statusCode: 400,
          data: {
            success: false,
            message: 'Either sourceTherapistId or sessionIds must be provided for shift handover.',
          },
        };
      }

      const updateRes = await client.query(updateQuery, queryParams);
      await client.query('COMMIT');

      const reassignedSessions = updateRes.rows.map((row) => ({
        id: String(row.id),
        sessionId: row.id,
        session_id: row.id,
        status: row.status,
        scheduledDate: row.scheduled_date,
        scheduled_date: row.scheduled_date,
        scheduledTime: row.scheduled_time,
        scheduled_time: row.scheduled_time,
        patientId: row.patient_id,
        patient_id: row.patient_id,
        therapistId: targetTherapistId,
        therapist_id: targetTherapistId,
        therapistName: targetTherapist.name,
        therapist_name: targetTherapist.name,
      }));

      return {
        statusCode: 200,
        data: {
          success: true,
          message: 'Shift handover completed successfully.',
          reassignedCount: reassignedSessions.length,
          reassigned_count: reassignedSessions.length,
          sourceTherapistId: sourceTherapistId || null,
          source_therapist_id: sourceTherapistId || null,
          targetTherapistId,
          target_therapist_id: targetTherapistId,
          targetTherapistName: targetTherapist.name,
          target_therapist_name: targetTherapist.name,
          notes: notes || null,
          reassignedSessions,
          reassigned_sessions: reassignedSessions,
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * 6. Availability Tracking - Get therapist availability schedule.
   */
  getAvailability: async (therapistId, filters = {}) => {
    let queryText = `
      SELECT 
        id,
        therapist_id,
        TO_CHAR(date, 'YYYY-MM-DD') AS date,
        start_time::text AS start_time,
        end_time::text AS end_time,
        status
      FROM therapist_availability
      WHERE therapist_id = $1
    `;
    const params = [therapistId];

    if (filters.date) {
      params.push(filters.date);
      queryText += ` AND date = $${params.length}`;
    } else if (filters.startDate && filters.endDate) {
      params.push(filters.startDate, filters.endDate);
      queryText += ` AND date BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    queryText += ` ORDER BY date ASC, start_time ASC;`;

    const res = await pool.query(queryText, params);

    return res.rows.map((row) => ({
      id: row.id,
      therapistId: row.therapist_id,
      therapist_id: row.therapist_id,
      date: row.date,
      startTime: row.start_time,
      start_time: row.start_time,
      endTime: row.end_time,
      end_time: row.end_time,
      status: row.status,
    }));
  },

  /**
   * 7. Availability Tracking - Create or update availability entry.
   */
  createAvailability: async ({ therapistId, date, startTime, endTime, status = 'available' }) => {
    const normalizedStatus = String(status).toLowerCase().trim();
    if (!['available', 'leave'].includes(normalizedStatus)) {
      return {
        statusCode: 400,
        data: {
          success: false,
          message: "status must be either 'available' or 'leave'.",
        },
      };
    }

    const queryText = `
      INSERT INTO therapist_availability (therapist_id, date, start_time, end_time, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, therapist_id, TO_CHAR(date, 'YYYY-MM-DD') AS date, start_time::text, end_time::text, status;
    `;

    const res = await pool.query(queryText, [
      therapistId,
      date,
      startTime,
      endTime,
      normalizedStatus,
    ]);

    const row = res.rows[0];

    return {
      statusCode: 201,
      data: {
        success: true,
        message: 'Availability record created successfully',
        data: {
          id: row.id,
          therapistId: row.therapist_id,
          therapist_id: row.therapist_id,
          date: row.date,
          startTime: row.start_time,
          start_time: row.start_time,
          endTime: row.end_time,
          end_time: row.end_time,
          status: row.status,
        },
      },
    };
  },

  /**
   * 8. Availability Tracking - Update availability entry by ID.
   */
  updateAvailability: async (availabilityId, payload) => {
    const fields = [];
    const values = [];

    if (payload.date) {
      values.push(payload.date);
      fields.push(`date = $${values.length}`);
    }
    if (payload.startTime) {
      values.push(payload.startTime);
      fields.push(`start_time = $${values.length}`);
    }
    if (payload.endTime) {
      values.push(payload.endTime);
      fields.push(`end_time = $${values.length}`);
    }
    if (payload.status) {
      const normalizedStatus = String(payload.status).toLowerCase().trim();
      if (!['available', 'leave'].includes(normalizedStatus)) {
        return {
          statusCode: 400,
          data: {
            success: false,
            message: "status must be either 'available' or 'leave'.",
          },
        };
      }
      values.push(normalizedStatus);
      fields.push(`status = $${values.length}`);
    }

    if (fields.length === 0) {
      return {
        statusCode: 400,
        data: {
          success: false,
          message: 'No update fields provided.',
        },
      };
    }

    values.push(availabilityId);
    const queryText = `
      UPDATE therapist_availability 
      SET ${fields.join(', ')} 
      WHERE id = $${values.length}
      RETURNING id, therapist_id, TO_CHAR(date, 'YYYY-MM-DD') AS date, start_time::text, end_time::text, status;
    `;

    const res = await pool.query(queryText, values);

    if (res.rows.length === 0) {
      return {
        statusCode: 404,
        data: {
          success: false,
          message: `Availability record with ID ${availabilityId} not found.`,
        },
      };
    }

    const row = res.rows[0];

    return {
      statusCode: 200,
      data: {
        success: true,
        message: 'Availability record updated successfully',
        data: {
          id: row.id,
          therapistId: row.therapist_id,
          therapist_id: row.therapist_id,
          date: row.date,
          startTime: row.start_time,
          start_time: row.start_time,
          endTime: row.end_time,
          end_time: row.end_time,
          status: row.status,
        },
      },
    };
  },

  /**
   * 9. Availability Tracking - Delete availability entry by ID.
   */
  deleteAvailability: async (availabilityId) => {
    const queryText = `
      DELETE FROM therapist_availability 
      WHERE id = $1 
      RETURNING id;
    `;
    const res = await pool.query(queryText, [availabilityId]);

    if (res.rows.length === 0) {
      return {
        statusCode: 404,
        data: {
          success: false,
          message: `Availability record with ID ${availabilityId} not found.`,
        },
      };
    }

    return {
      statusCode: 200,
      data: {
        success: true,
        message: 'Availability record deleted successfully',
        availabilityId,
        availability_id: availabilityId,
      },
    };
  },
};

module.exports = therapistService;
