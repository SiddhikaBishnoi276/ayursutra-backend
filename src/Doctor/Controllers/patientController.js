const { addPatient, listPatients } = require('../Services/patientService');

async function addPatientHandler(req, res) {
  try {
    const { name, age, gender, contact_number, chief_complaint } = req.body;
    if (!name || !contact_number) {
      return res.status(400).json({ error: 'name and contact_number are required' });
    }
    const result = await addPatient(req.user, { name, age, gender, contact_number, chief_complaint });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.message.includes('already registered') ? 409 : 500).json({ error: err.message });
  }
}

async function listPatientsHandler(req, res) {
  try {
    const patients = await listPatients(req.user.clinic_id);
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { addPatientHandler, listPatientsHandler };
