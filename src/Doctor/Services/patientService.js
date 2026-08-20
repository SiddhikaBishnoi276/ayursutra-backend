const bcrypt = require('bcryptjs');
const { pool, query } = require('../../config/db');

function generateMockPassword() {
  return Math.random().toString(36).slice(-6).toUpperCase();
}

async function addPatient(doctorUser, { name, age, gender, contact_number, chief_complaint }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const rawPassword = generateMockPassword();
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const userResult = await client.query(
      `INSERT INTO users (name, phone, password_hash, role, gender, clinic_id, created_by, is_active, credentials_sent_at)
       VALUES ($1, $2, $3, 'patient', $4, $5, $6, true, NOW())
       RETURNING id, name, phone`,
      [name, contact_number, passwordHash, gender, doctorUser.clinic_id, doctorUser.id]
    );
    const newUser = userResult.rows[0];

    const patientResult = await client.query(
      `INSERT INTO patients (user_id, clinic_id, created_by, age, chief_complaint)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, age, chief_complaint, created_at`,
      [newUser.id, doctorUser.clinic_id, doctorUser.id, age, chief_complaint]
    );

    await client.query(
      `INSERT INTO credential_delivery_log (user_id, channel, status) VALUES ($1, 'sms', 'sent')`,
      [newUser.id]
    );

    await client.query('COMMIT');

    return {
      patient: {
        user_id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        age: patientResult.rows[0].age,
        chief_complaint: patientResult.rows[0].chief_complaint,
      },
      simulated_sms: {
        to: newUser.phone,
        message: `SMS sent to ${newUser.phone}: Login ID: ${newUser.phone}, Password: ${rawPassword} — ${newUser.name} can now log in to view their schedule`,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      throw new Error('This phone number is already registered');
    }
    throw err;
  } finally {
    client.release();
  }
}

async function listPatients(clinicId) {
  const result = await query(
    `SELECT u.id AS user_id, u.name, u.phone, u.gender, p.age, p.chief_complaint, p.created_at
     FROM patients p
     JOIN users u ON u.id = p.user_id
     WHERE p.clinic_id = $1
     ORDER BY p.created_at DESC`,
    [clinicId]
  );
  return result.rows;
}

module.exports = { addPatient, listPatients };
