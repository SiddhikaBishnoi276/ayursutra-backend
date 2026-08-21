const { query } = require('../../config/db');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findUserByRole(role) {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.gender, u.clinic_id, u.is_active, c.practitioner_mode 
     FROM users u 
     LEFT JOIN clinics c ON u.clinic_id = c.id 
     WHERE u.role = $1 AND u.is_active = true 
     ORDER BY u.created_at ASC 
     LIMIT 1`,
    [role]
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
    return null;
  }
  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.gender, u.clinic_id, u.is_active, c.practitioner_mode 
     FROM users u 
     LEFT JOIN clinics c ON u.clinic_id = c.id 
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function getClinicResources(clinicId) {
  const cid = parseInt(clinicId, 10);
  if (isNaN(cid)) {
    throw new Error('Invalid clinic ID');
  }

  // 1. Fetch active doctors for the clinic with registration number & qualification
  const doctorsResult = await query(
    `SELECT u.id, u.name AS full_name, u.gender, dp.registration_number AS registration_num, dp.qualification
     FROM users u
     LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
     WHERE u.clinic_id = $1 AND u.role = 'doctor' AND u.is_active = true
     ORDER BY u.name ASC`,
    [cid]
  );

  // 2. Fetch active therapists for the clinic with aggregated specializations
  const therapistsResult = await query(
    `SELECT u.id, u.name AS full_name, u.gender,
            COALESCE(
              ARRAY_REMOVE(ARRAY_AGG(ts.therapy_type), NULL),
              '{}'
            ) AS specializations
     FROM users u
     LEFT JOIN therapist_specializations ts ON u.id = ts.therapist_id
     WHERE u.clinic_id = $1 AND u.role = 'therapist' AND u.is_active = true
     GROUP BY u.id, u.name, u.gender
     ORDER BY u.name ASC`,
    [cid]
  );

  // 3. Fetch rooms for the clinic
  const roomsResult = await query(
    `SELECT id, clinic_id, name, status
     FROM rooms
     WHERE clinic_id = $1
     ORDER BY name ASC`,
    [cid]
  );

  return {
    doctors: doctorsResult.rows,
    therapists: therapistsResult.rows,
    rooms: roomsResult.rows,
  };
}

async function findUserByEmailOrPhone(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return null;
  }
  const clean = identifier.trim();
  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.role, u.gender, u.clinic_id, u.is_active, c.practitioner_mode 
     FROM users u 
     LEFT JOIN clinics c ON u.clinic_id = c.id 
     WHERE LOWER(u.email) = LOWER($1) OR u.phone = $1 
     LIMIT 1`,
    [clean]
  );
  return result.rows[0] || null;
}

module.exports = { findUserByRole, findUserById, findUserByEmailOrPhone, getClinicResources };
