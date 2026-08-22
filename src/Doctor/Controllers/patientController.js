const { addPatient, listPatients } = require('../Services/patientService');

async function addPatientHandler(req, res) {
  try {
    const { pool } = require('../../config/db');
    const { name, email, contact, contact_number, diagnosis, chiefComplaint, chief_complaint, age, gender } = req.body;
    const phone = contact_number || contact;

    // Check email uniqueness
    if (email?.trim()) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email.trim()]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'A patient with this email already exists.' });
      }
    }

    // Check phone uniqueness
    if (phone?.trim()) {
      const phoneCheck = await pool.query(
        'SELECT id FROM users WHERE phone = $1 LIMIT 1',
        [phone.trim()]
      );
      if (phoneCheck.rows.length > 0) {
        return res.status(409).json({ error: 'A patient with this phone number already exists.' });
      }
    }

    const result = await addPatient(req.user, {
      name,
      age,
      gender,
      contact: phone,
      email: email?.trim().toLowerCase() || null,
      chief_complaint: chief_complaint || chiefComplaint || 'Clinical evaluation',
      diagnosis,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Error in addPatientHandler:', err);
    // Fallback for any unhandled database constraint violations
    if (err.code === '23505') {
      let field = 'email';
      if (err.detail?.includes('phone')) field = 'phone number';
      return res.status(409).json({ error: `A user with this ${field} already exists.` });
    }
    res.status(500).json({ error: err.message });
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
