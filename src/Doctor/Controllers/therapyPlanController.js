const { createPlanForPatient } = require('../Services/therapyPlanService');

async function generatePlanHandler(req, res) {
  try {
    const { patientId } = req.params;
    const {
      package_id,
      packageId,
      auto_assign,
      autoAssign,
      start_date,
      startDate,
      preferred_start_time,
      preferredStartTime,
      therapist_id,
      therapistId,
      assigned_therapist_id,
      assignedTherapistId,
    } = req.body || {};
    const explicitPackageId = package_id || packageId || null;
    const explicitTherapistId = therapist_id || therapistId || assigned_therapist_id || assignedTherapistId || null;

    const result = await createPlanForPatient(req.user, patientId, explicitPackageId, {
      autoAssign: Boolean(auto_assign || autoAssign || !explicitPackageId),
      startDate: start_date || startDate || null,
      preferredStartTime: preferred_start_time || preferredStartTime || null,
      therapistId: explicitTherapistId,
    });
    res.status(201).json(result);
  } catch (err) {
    console.error('Error in generatePlanHandler:', err);
    const isConflict = err.message && (err.message.includes('already has an active') || err.message.includes('cannot be created'));
    res.status(isConflict ? 409 : 500).json({ error: err.message, message: err.message });
  }
}


module.exports = { generatePlanHandler };
