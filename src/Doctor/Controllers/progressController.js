const { getPatientProgress, recordVitals, logSessionObservation } = require('../Services/progressService');

async function getProgressHandler(req, res) {
  try {
    const { patientId } = req.params;
    const progress = await getPatientProgress(patientId, req.user.clinic_id);
    res.json(progress);
  } catch (err) {
    console.error('Error in getProgressHandler:', err);
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
}

async function recordVitalsHandler(req, res) {
  try {
    const { patientId } = req.params;
    const rawVitals = req.body.vitals || req.body;
    const type = req.body.type || 'baseline';
    if (!rawVitals || (typeof rawVitals === 'object' && Object.keys(rawVitals).length === 0)) {
      return res.status(400).json({ error: 'vitals object is required' });
    }
    const vitals = req.body.vitals || {
      bp: req.body.bp,
      pulse: req.body.pulse,
      temperature: req.body.temperature,
      weight: req.body.weight,
      spo2: req.body.spo2,
    };
    const result = await recordVitals(patientId, req.user, { vitals, type });
    res.status(201).json(result);
  } catch (err) {
    console.error('Error in recordVitalsHandler:', err);
    res.status(500).json({ error: err.message });
  }
}

async function logSessionHandler(req, res) {
  try {
    const { patientId } = req.params;
    const result = await logSessionObservation(patientId, req.user, req.body);
    res.status(201).json(result);
  } catch (err) {
    console.error('Error in logSessionHandler:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getProgressHandler, recordVitalsHandler, logSessionHandler };
