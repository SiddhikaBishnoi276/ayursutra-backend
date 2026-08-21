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
   * Records the patient's post-session clinical feedback with flexible payload mapping and fallbacks.
   */
  submitFeedback: async (req, res) => {
    const {
      sessionId,
      session_id,
      patientId,
      patient_id,
      rating,
      symptomImprovementScore,
      symptom_improvement_score,
      overallExperience,
      overall_experience,
      comments,
      notes,
      pain_scale,
      painScale,
      sleep_quality,
      sleepQuality,
      energy_level,
      energyLevel,
      side_effects,
      sideEffects,
    } = req.body;

    const rawSessionId = sessionId || session_id || req.body.id;
    const cleanPatientId = patientId || patient_id || req.body.userId || req.body.user_id;

    if (!rawSessionId || !cleanPatientId) {
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

    if (!isValidUUID(cleanPatientId)) {
      return res.status(400).json({
        success: false,
        message: 'patient_id must be a valid UUID.',
      });
    }

    const effectiveImprovementScore =
      symptomImprovementScore !== undefined ? symptomImprovementScore : symptom_improvement_score;
    const rawPain = pain_scale !== undefined ? pain_scale : painScale;
    const rawSleep = sleep_quality !== undefined ? sleep_quality : sleepQuality;
    const rawEnergy = energy_level !== undefined ? energy_level : energyLevel;
    const rawSideEffects = side_effects !== undefined ? side_effects : sideEffects;

    const parsedImprovement =
      effectiveImprovementScore !== undefined ? parseInt(effectiveImprovementScore, 10) : NaN;
    const parsedRating = rating !== undefined ? parseInt(rating, 10) : NaN;

    const dbPainScale =
      rawPain !== undefined
        ? parseInt(rawPain, 10)
        : !isNaN(parsedImprovement)
        ? Math.max(1, 10 - parsedImprovement)
        : 3;

    const dbSleepQuality =
      rawSleep !== undefined
        ? parseInt(rawSleep, 10)
        : !isNaN(parsedRating)
        ? Math.min(10, Math.max(1, parsedRating * 2))
        : 8;

    const dbEnergyLevel =
      rawEnergy !== undefined
        ? parseInt(rawEnergy, 10)
        : !isNaN(parsedRating)
        ? Math.min(10, Math.max(1, parsedRating * 2))
        : 7;

    const dbSideEffects =
      rawSideEffects ||
      comments ||
      overallExperience ||
      overall_experience ||
      notes ||
      'Normal post-therapy recovery';

    const result = await patientService.submitFeedback({
      sessionId: parsedSessionId,
      patientId: cleanPatientId,
      painScale: dbPainScale,
      sleepQuality: dbSleepQuality,
      energyLevel: dbEnergyLevel,
      sideEffects: dbSideEffects,
    });

    return res.status(201).json(result);
  },
};

module.exports = patientController;
