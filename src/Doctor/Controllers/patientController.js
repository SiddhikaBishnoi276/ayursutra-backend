const { addPatient, listPatients } = require('../Services/patientService');

async function addPatientHandler(req, res) {
  try {
    const { name, age, gender, contact_number, contact, email, chief_complaint, chiefComplaint, diagnosis } = req.body;
    const phone = contact_number || contact;
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and contact (or contact_number) are required' });
    }
    const result = await addPatient(req.user, {
      name,
      age: age ? parseInt(age, 10) : 35,
      gender: gender || 'Female',
      contact_number: phone,
      email,
      chief_complaint: chief_complaint || chiefComplaint || 'Clinical evaluation',
      diagnosis,
    });
    res.status(201).json(result);
  } catch (err) {
    console.error('Error in addPatientHandler:', err);
    res.status(err.message.includes('already registered') ? 409 : 500).json({ error: err.message });
  }
}

async function listPatientsHandler(req, res) {
  try {
    const patients = await listPatients(req.user.clinic_id);
    res.json(patients);
  } catch (err) {
    console.error('Error in listPatientsHandler:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { addPatientHandler, listPatientsHandler };
