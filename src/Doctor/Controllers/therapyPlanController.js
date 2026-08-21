const { createPlanForPatient } = require('../Services/therapyPlanService');

async function generatePlanHandler(req, res) {
  try {
    const { patientId } = req.params;
    const { package_id, packageId, auto_assign, autoAssign } = req.body || {};
    const explicitPackageId = package_id || packageId || null;

    const result = await createPlanForPatient(req.user, patientId, explicitPackageId, {
      autoAssign: Boolean(auto_assign || autoAssign || !explicitPackageId),
    });
    res.status(201).json(result);
  } catch (err) {
    console.error('Error in generatePlanHandler:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { generatePlanHandler };
