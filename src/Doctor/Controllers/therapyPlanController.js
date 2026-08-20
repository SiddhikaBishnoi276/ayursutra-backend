const { createPlanForPatient } = require('../Services/therapyPlanService');

async function generatePlanHandler(req, res) {
  try {
    const { patientId } = req.params;
    const { package_id } = req.body;
    if (!package_id) {
      return res.status(400).json({ error: 'package_id is required' });
    }
    const result = await createPlanForPatient(req.user, patientId, package_id);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { generatePlanHandler };
