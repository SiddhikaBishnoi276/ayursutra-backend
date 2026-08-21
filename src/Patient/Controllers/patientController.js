const patientService = require('../Services/patientService');
const { parseIntegerId, isValidUUID, getNormalizedParam } = require('../../Common/Utils/paramUtils');

/**
 * Patient View Controller
 * Handles Patient dashboard views, sequential treatment progress, diet & medication guidance, and feedback submissions.
 */
const patientController = {
  /**
   * 1. GET /api/patient/dashboard/:patientId
   * Fetches active treatment summary, timeline, dosha diet plan, medications, and contextual reminder with dual contracts.
   */
  getPatientDashboard: async (req, res) => {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required.',
      });
    }

    if (!isValidUUID(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format. Must be a valid UUID.',
      });
    }

    const dashboard = await patientService.getDashboardData(patientId);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: `Patient with ID ${patientId} not found.`,
      });
    }

    return res.status(200).json(dashboard);
  },

  /**
   * 2. POST /api/patient/feedback
   * Records the patient's post-session clinical feedback with flexible payload mapping.
   */
  submitFeedback: async (req, res) => {
    const rawSessionId = getNormalizedParam(req.body, 'session_id', 'sessionId', 'id');
    const patientId = getNormalizedParam(req.body, 'patient_id', 'patientId', 'userId', 'user_id');

    if (!rawSessionId || !patientId) {
      return res.status(400).json({
        success: false,
        message: 'session_id and patient_id are required fields.',
      });
    }

    const parsedSessionId = parseIntegerId(rawSessionId);
    if (parsedSessionId === null) {
      return res.status(400).json({
        success: false,
        message: 'session_id must be a valid integer or formatted string (e.g. 105 or SES-105).',
      });
    }

    if (!isValidUUID(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'patient_id must be a valid UUID.',
      });
    }

    const symptomImprovementScore = getNormalizedParam(
      req.body,
      'symptomImprovementScore',
      'symptom_improvement_score'
    );
    const rating = getNormalizedParam(req.body, 'rating');
    const overallExperience = getNormalizedParam(
      req.body,
      'overallExperience',
      'overall_experience',
      'comments',
      'notes'
    );

    // Dynamic fallback mappings as specified in requirements
    let painScale = getNormalizedParam(req.body, 'pain_scale', 'painScale');
    if (painScale === undefined && symptomImprovementScore !== undefined) {
      const parsedScore = parseInt(symptomImprovementScore, 10);
      painScale = !isNaN(parsedScore) ? Math.max(1, 10 - parsedScore) : 3;
    }

    let sleepQuality = getNormalizedParam(req.body, 'sleep_quality', 'sleepQuality');
    if (sleepQuality === undefined && rating !== undefined) {
      const parsedRating = parseInt(rating, 10);
      sleepQuality = !isNaN(parsedRating) ? Math.min(10, Math.max(1, parsedRating * 2)) : 8;
    }

    let energyLevel = getNormalizedParam(req.body, 'energy_level', 'energyLevel');
    if (energyLevel === undefined && rating !== undefined) {
      const parsedRating = parseInt(rating, 10);
      energyLevel = !isNaN(parsedRating) ? Math.min(10, Math.max(1, parsedRating * 2)) : 7;
    }

    const sideEffects =
      getNormalizedParam(req.body, 'side_effects', 'sideEffects') ||
      overallExperience ||
      'Normal recovery';

    const result = await patientService.submitFeedback({
      sessionId: parsedSessionId,
      patientId,
      painScale,
      sleepQuality,
      energyLevel,
      sideEffects,
    });

    return res.status(201).json(result);
  },
};

module.exports = patientController;
