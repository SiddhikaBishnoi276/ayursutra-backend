const therapistService = require('../Services/therapistService');
const { parseIntegerId, isValidUUID, getNormalizedParam } = require('../../Common/Utils/paramUtils');

/**
 * Therapist View Controller
 * Handles Therapist daily queue, session lifecycle progression, emergency pause, shift handover, and availability tracking.
 */
const therapistController = {
  /**
   * 1. GET /api/therapist/queue/:therapistId
   * Fetches daily active/pending sessions assigned to the therapist with rich preparation metadata and dual contracts.
   */
  getTherapistQueue: async (req, res) => {
    const { therapistId } = req.params;

    if (!therapistId) {
      return res.status(400).json({
        success: false,
        message: 'Therapist ID is required.',
      });
    }

    if (!isValidUUID(therapistId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid therapist ID format. Must be a valid UUID.',
      });
    }

    const date = getNormalizedParam(req.query, 'date', 'scheduledDate', 'scheduled_date');
    const queue = await therapistService.getQueue(therapistId, { date });

    return res.status(200).json(queue);
  },

  /**
   * 2. PATCH /api/sessions/:sessionId/start
   * Moves a session from 'scheduled' to 'in_progress' and updates the parent stage status.
   */
  startSession: async (req, res) => {
    const { sessionId } = req.params;
    const parsedSessionId = parseIntegerId(sessionId);

    if (parsedSessionId === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID provided. Must be an integer.',
      });
    }

    const result = await therapistService.startSession(parsedSessionId);
    return res.status(result.statusCode).json(result.data);
  },

  /**
   * 3. POST /api/sessions/:sessionId/complete (Core Progression Engine)
   * Submits clinical observation and executes sequential stage-locking / doctor alert logic within a single transaction.
   */
  completeSession: async (req, res) => {
    const { sessionId } = req.params;
    const parsedSessionId = parseIntegerId(sessionId);

    if (parsedSessionId === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID provided. Must be an integer.',
      });
    }

    const therapistId = getNormalizedParam(req.body, 'therapistId', 'therapist_id', 'recordedBy', 'recorded_by');
    if (therapistId && !isValidUUID(therapistId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid therapist ID format. Must be a valid UUID.',
      });
    }

    const dosageGiven = getNormalizedParam(req.body, 'dosageGiven', 'dosage_given') || '';
    const patientResponse = getNormalizedParam(req.body, 'patientResponse', 'patient_response') || 'normal';
    const vitals = getNormalizedParam(req.body, 'vitals') || {};
    const complicationNotes = getNormalizedParam(req.body, 'complicationNotes', 'complication_notes') || '';
    const hasComplication = getNormalizedParam(req.body, 'hasComplication', 'has_complication') || false;

    const result = await therapistService.completeSession(parsedSessionId, {
      therapistId,
      dosageGiven,
      patientResponse,
      vitals,
      complicationNotes,
      hasComplication,
    });

    return res.status(result.statusCode).json(result.data);
  },

  /**
   * 4. POST / PATCH /api/sessions/:sessionId/pause (Emergency Pause Endpoint)
   * Immediately flags session, logs abnormal observation, triggers doctor alert, and keeps subsequent stages locked.
   */
  pauseSession: async (req, res) => {
    const { sessionId } = req.params;
    const parsedSessionId = parseIntegerId(sessionId);

    if (parsedSessionId === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID provided. Must be an integer.',
      });
    }

    const therapistId = getNormalizedParam(req.body, 'therapistId', 'therapist_id');
    if (therapistId && !isValidUUID(therapistId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid therapist ID format. Must be a valid UUID.',
      });
    }

    const reason =
      getNormalizedParam(req.body, 'reason', 'complicationNotes', 'complication_notes', 'notes') ||
      'Emergency session pause triggered by therapist';
    const vitals = getNormalizedParam(req.body, 'vitals') || {};
    const dosageGiven = getNormalizedParam(req.body, 'dosageGiven', 'dosage_given') || '';

    const result = await therapistService.pauseSession(parsedSessionId, {
      therapistId,
      reason,
      vitals,
      dosageGiven,
    });

    return res.status(result.statusCode).json(result.data);
  },

  /**
   * 5. POST /api/therapist/shift-handover or POST /api/therapist/handover or POST /api/sessions/:sessionId/handover
   * Handles reassigning scheduled/pending session(s) from one therapist to another.
   */
  shiftHandover: async (req, res) => {
    const targetTherapistId = getNormalizedParam(
      req.body,
      'targetTherapistId',
      'target_therapist_id',
      'toTherapistId',
      'to_therapist_id'
    );
    const sourceTherapistId = getNormalizedParam(
      req.body,
      'sourceTherapistId',
      'source_therapist_id',
      'fromTherapistId',
      'from_therapist_id'
    );
    let sessionIds = getNormalizedParam(req.body, 'sessionIds', 'session_ids');
    const date = getNormalizedParam(req.body, 'date', 'scheduledDate', 'scheduled_date');
    const notes = getNormalizedParam(req.body, 'notes', 'handoverNotes', 'handover_notes', 'reason');

    if (req.params.sessionId) {
      const parsed = parseIntegerId(req.params.sessionId);
      if (parsed === null) {
        return res.status(400).json({
          success: false,
          message: 'Invalid session ID provided. Must be an integer.',
        });
      }
      sessionIds = [parsed];
    } else if (Array.isArray(sessionIds)) {
      sessionIds = sessionIds.map((id) => parseIntegerId(id)).filter((id) => id !== null);
    }

    if (!targetTherapistId || !isValidUUID(targetTherapistId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid target therapist ID (UUID) is required for shift handover.',
      });
    }

    if (sourceTherapistId && !isValidUUID(sourceTherapistId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid source therapist ID format. Must be a valid UUID.',
      });
    }

    const result = await therapistService.shiftHandover({
      sourceTherapistId,
      targetTherapistId,
      sessionIds,
      date,
      notes,
    });

    return res.status(result.statusCode).json(result.data);
  },

  /**
   * 6. GET /api/therapist/availability/:therapistId
   * Retrieves availability records for a therapist.
   */
  getTherapistAvailability: async (req, res) => {
    const { therapistId } = req.params;

    if (!therapistId || !isValidUUID(therapistId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid therapist ID (UUID) is required.',
      });
    }

    const date = getNormalizedParam(req.query, 'date');
    const startDate = getNormalizedParam(req.query, 'startDate', 'start_date');
    const endDate = getNormalizedParam(req.query, 'endDate', 'end_date');

    const availability = await therapistService.getAvailability(therapistId, {
      date,
      startDate,
      endDate,
    });

    return res.status(200).json(availability);
  },

  /**
   * 7. POST /api/therapist/availability
   * Creates an availability record for a therapist.
   */
  createAvailability: async (req, res) => {
    const therapistId =
      getNormalizedParam(req.body, 'therapistId', 'therapist_id') || req.params.therapistId;
    const date = getNormalizedParam(req.body, 'date');
    const startTime = getNormalizedParam(req.body, 'startTime', 'start_time');
    const endTime = getNormalizedParam(req.body, 'endTime', 'end_time');
    const status = getNormalizedParam(req.body, 'status') || 'available';

    if (!therapistId || !isValidUUID(therapistId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid therapist ID (UUID) is required.',
      });
    }

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'date, startTime, and endTime are required.',
      });
    }

    const result = await therapistService.createAvailability({
      therapistId,
      date,
      startTime,
      endTime,
      status,
    });

    return res.status(result.statusCode).json(result.data);
  },

  /**
   * 8. PUT / PATCH /api/therapist/availability/:availabilityId
   * Updates an existing availability record.
   */
  updateAvailability: async (req, res) => {
    const { availabilityId } = req.params;
    const parsedId = parseIntegerId(availabilityId);

    if (parsedId === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid availability ID. Must be an integer.',
      });
    }

    const date = getNormalizedParam(req.body, 'date');
    const startTime = getNormalizedParam(req.body, 'startTime', 'start_time');
    const endTime = getNormalizedParam(req.body, 'endTime', 'end_time');
    const status = getNormalizedParam(req.body, 'status');

    const result = await therapistService.updateAvailability(parsedId, {
      date,
      startTime,
      endTime,
      status,
    });

    return res.status(result.statusCode).json(result.data);
  },

  /**
   * 9. DELETE /api/therapist/availability/:availabilityId
   * Deletes an availability record.
   */
  deleteAvailability: async (req, res) => {
    const { availabilityId } = req.params;
    const parsedId = parseIntegerId(availabilityId);

    if (parsedId === null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid availability ID. Must be an integer.',
      });
    }

    const result = await therapistService.deleteAvailability(parsedId);
    return res.status(result.statusCode).json(result.data);
  },
};

module.exports = therapistController;
