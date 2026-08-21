const bcrypt = require('bcryptjs');
const { pool, query } = require('../../config/db');

function generateMockPassword() {
  return Math.random().toString(36).slice(-6).toUpperCase();
}

async function addPatient(doctorUser, { name, age, gender, contact_number, contact, email, chief_complaint, chiefComplaint, diagnosis }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const phone = contact_number || contact;
    const complaint = chief_complaint || chiefComplaint || 'Clinical evaluation';
    const rawPassword = generateMockPassword();
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const userResult = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role, gender, clinic_id, created_by, is_active, credentials_sent_at)
       VALUES ($1, $2, $3, $4, 'patient', $5, $6, $7, true, NOW())
       RETURNING id, name, phone, email, gender`,
      [name, email || null, phone, passwordHash, gender || 'Female', doctorUser.clinic_id, doctorUser.id]
    );
    const newUser = userResult.rows[0];

    const patientResult = await client.query(
      `INSERT INTO patients (user_id, clinic_id, created_by, age, chief_complaint, diagnosis)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, age, chief_complaint, diagnosis, created_at`,
      [newUser.id, doctorUser.clinic_id, doctorUser.id, age || 35, complaint, diagnosis || null]
    );
    const pData = patientResult.rows[0];

    await client.query(
      `INSERT INTO credential_delivery_log (user_id, channel, status) VALUES ($1, 'sms', 'sent')`,
      [newUser.id]
    );

    await client.query('COMMIT');

    return {
      id: newUser.id,
      patient: {
        id: newUser.id,
        user_id: newUser.id,
        name: newUser.name,
        phone: newUser.phone,
        contact: newUser.phone,
        email: newUser.email,
        age: pData.age,
        gender: newUser.gender,
        chief_complaint: pData.chief_complaint,
        chiefComplaint: pData.chief_complaint,
        diagnosis: pData.diagnosis,
        status: 'new',
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
  const patientsQuery = `
    SELECT 
      u.id AS user_id,
      u.name,
      u.phone,
      u.email,
      u.gender,
      p.age,
      p.chief_complaint,
      p.diagnosis,
      p.created_at,
      pa.confirmed_dosha,
      tp.id AS plan_id,
      tp.status AS plan_status,
      tp.package_id,
      pkg.name AS package_name,
      COUNT(DISTINCT s.id) AS total_sessions,
      COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'completed') AS completed_sessions,
      (
        SELECT tps.stage_type 
        FROM therapy_plan_stages tps 
        WHERE tps.plan_id = tp.id AND tps.status IN ('in_progress', 'unlocked')
        ORDER BY tps.sequence_order ASC LIMIT 1
      ) AS current_stage_type,
      (
        SELECT ca.id 
        FROM complication_alerts ca
        JOIN session_observations so ON so.id = ca.session_observation_id
        JOIN sessions sess ON sess.id = so.session_id
        WHERE sess.patient_id = p.user_id AND ca.status = 'pending'
        LIMIT 1
      ) AS pending_alert_id,
      (
        SELECT so.complication_notes 
        FROM complication_alerts ca
        JOIN session_observations so ON so.id = ca.session_observation_id
        JOIN sessions sess ON sess.id = so.session_id
        WHERE sess.patient_id = p.user_id AND ca.status = 'pending'
        LIMIT 1
      ) AS alert_message
    FROM patients p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN LATERAL (
      SELECT confirmed_dosha 
      FROM prakriti_assessments 
      WHERE patient_id = p.user_id 
      ORDER BY assessed_at DESC LIMIT 1
    ) pa ON true
    LEFT JOIN LATERAL (
      SELECT id, package_id, status 
      FROM therapy_plans 
      WHERE patient_id = p.user_id 
      ORDER BY created_at DESC LIMIT 1
    ) tp ON true
    LEFT JOIN therapy_packages pkg ON pkg.id = tp.package_id
    LEFT JOIN sessions s ON s.patient_id = p.user_id
    WHERE p.clinic_id = $1
    GROUP BY u.id, u.name, u.phone, u.email, u.gender, p.user_id, p.age, p.chief_complaint, p.diagnosis, p.created_at, pa.confirmed_dosha, tp.id, tp.package_id, tp.status, pkg.name
    ORDER BY p.created_at DESC;
  `;

  const result = await query(patientsQuery, [clinicId]);

  return result.rows.map((row) => {
    let status = 'new';
    if (row.pending_alert_id) {
      status = 'flagged';
    } else if (row.plan_status === 'completed') {
      status = 'completed';
    } else if (row.plan_status === 'active') {
      status = 'in_progress';
    } else if (row.confirmed_dosha) {
      status = 'prakriti_confirmed';
    }

    const totalDays = parseInt(row.total_sessions || 0, 10) || 7;
    const currentDay = Math.min(totalDays, parseInt(row.completed_sessions || 0, 10) + 1);

    return {
      id: row.user_id,
      user_id: row.user_id,
      name: row.name,
      age: row.age,
      gender: row.gender,
      contact: row.phone,
      phone: row.phone,
      email: row.email,
      chiefComplaint: row.chief_complaint,
      chief_complaint: row.chief_complaint,
      diagnosis: row.diagnosis || row.chief_complaint || 'Prakriti Assessment Required',
      status,
      dominantPrakriti: row.confirmed_dosha || null,
      confirmed_dosha: row.confirmed_dosha || null,
      assignedPackageId: row.package_id || null,
      assignedPackageName: row.package_name || null,
      currentDay: status === 'in_progress' || status === 'flagged' ? currentDay : (status === 'completed' ? totalDays : null),
      currentStage: row.current_stage_type || (status === 'in_progress' ? 'Pradhanakarma' : null),
      totalDays: status === 'in_progress' || status === 'completed' || status === 'flagged' ? totalDays : null,
      onboardedDate: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      created_at: row.created_at,
      complicationAlert: row.pending_alert_id ? {
        severity: 'moderate',
        message: row.alert_message || 'Therapy observation flagged for review.',
        time: 'Recently',
      } : null,
    };
  });
}

module.exports = { addPatient, listPatients };
