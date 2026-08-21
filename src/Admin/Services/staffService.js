const { pool } = require('../../config/db');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────────────────────────────────────────
// CREATE STAFF (Doctor or Therapist)
// Wrapped in a DB transaction: users → profile table → specializations
// ─────────────────────────────────────────────────────────────────────────────
const createStaff = async (data) => {
  const {
    name,
    email,
    phone,
    password,
    gender,
    role,
    clinic_id,
    created_by,
    // Doctor-specific
    qualification,
    registration_number,
    // Therapist-specific
    specializations = [], // array of therapy_type strings
  } = data;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // 2. Insert into users
    const userResult = await client.query(
      `INSERT INTO users
         (role, name, email, phone, password_hash, gender, clinic_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, role, name, email, phone, gender, clinic_id, is_active, created_at`,
      [role, name, email, phone, password_hash, gender || null, clinic_id, created_by || null]
    );

    const newUser = userResult.rows[0];

    // 3. Insert into role-specific profile table
    if (role === 'doctor') {
      await client.query(
        `INSERT INTO doctor_profiles (user_id, qualification, registration_number)
         VALUES ($1, $2, $3)`,
        [newUser.id, qualification || null, registration_number || null]
      );
    } else if (role === 'therapist') {
      await client.query(
        `INSERT INTO therapist_profiles (user_id) VALUES ($1)`,
        [newUser.id]
      );

      // 4. Insert specializations if provided
      if (specializations.length > 0) {
        const specValues = specializations
          .map((_, i) => `($1, $${i + 2})`)
          .join(', ');
        await client.query(
          `INSERT INTO therapist_specializations (therapist_id, therapy_type)
           VALUES ${specValues}`,
          [newUser.id, ...specializations]
        );
      }
    }

    await client.query('COMMIT');

    return newUser;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL STAFF
// Filters: role ('doctor' | 'therapist'), status ('Active' | 'Engaged' | 'Suspended')
// "Engaged" is derived: therapist has an in_progress session today
// ─────────────────────────────────────────────────────────────────────────────
const getAllStaff = async ({ role, status, clinic_id }) => {
  const conditions = [`u.role IN ('doctor', 'therapist')`];
  const params = [];

  if (clinic_id) {
    params.push(clinic_id);
    conditions.push(`u.clinic_id = $${params.length}`);
  }

  if (role && ['doctor', 'therapist'].includes(role)) {
    params.push(role);
    conditions.push(`u.role = $${params.length}`);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const query = `
    SELECT
      u.id,
      u.role,
      u.name,
      u.email,
      u.phone,
      u.gender,
      u.clinic_id,
      u.is_active,
      u.created_at,
      -- Doctor profile fields
      dp.qualification,
      dp.registration_number,
      -- Therapist specializations aggregated as array
      COALESCE(
        (
          SELECT array_agg(ts.therapy_type)
          FROM therapist_specializations ts
          WHERE ts.therapist_id = u.id
        ),
        '{}'
      ) AS specializations,
      -- Derive engagement: does this therapist have an in_progress session right now?
      EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.therapist_id = u.id
          AND s.status = 'in_progress'
      ) AS is_engaged
    FROM users u
    LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
    ${whereClause}
    ORDER BY u.created_at DESC
  `;

  const result = await pool.query(query, params);

  // Map to a clean status field
  const rows = result.rows.map((row) => {
    let computedStatus;
    if (!row.is_active) {
      computedStatus = 'Suspended';
    } else if (row.is_engaged && row.role === 'therapist') {
      computedStatus = 'Engaged';
    } else {
      computedStatus = 'Active';
    }

    return {
      id: `S-${row.id.substring(0, 6)}`,
      _raw_id: row.id,
      role: row.role,
      fullName: row.name,
      email: row.email,
      phone: row.phone,
      gender: row.gender,
      clinic_id: row.clinic_id,
      status: computedStatus,
      is_active: row.is_active,
      created_at: row.created_at,
      // Role-specific
      qualification: row.qualification || undefined,
      registrationNum: row.registration_number || undefined,
      specialization: row.specializations?.filter(Boolean).join(', ') || undefined,
    };
  });

  // Apply status filter after computing derived status
  if (status) {
    return rows.filter((r) => r.status === status);
  }

  return rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STAFF STATUS
// Allowed transitions: Active <-> Suspended
// Business rule: Cannot suspend a therapist who is currently Engaged (in_progress session)
// ─────────────────────────────────────────────────────────────────────────────
const updateStaffStatus = async (id, newStatus) => {
  // 1. Fetch current user
  const userResult = await pool.query(
    `SELECT id, role, is_active FROM users WHERE id = $1 AND role IN ('doctor', 'therapist')`,
    [id]
  );

  if (userResult.rows.length === 0) {
    const err = new Error('Staff member not found.');
    err.statusCode = 404;
    throw err;
  }

  const user = userResult.rows[0];

  // 2. Enforce business rule: cannot manually suspend an Engaged therapist
  if (newStatus === 'Suspended' && user.role === 'therapist') {
    const engagedCheck = await pool.query(
      `SELECT 1 FROM sessions WHERE therapist_id = $1 AND status = 'in_progress' LIMIT 1`,
      [id]
    );
    if (engagedCheck.rows.length > 0) {
      const err = new Error(
        'Cannot suspend a therapist who is currently engaged in an active session.'
      );
      err.statusCode = 409;
      throw err;
    }
  }

  // 3. Map status string to is_active boolean
  const isActive = newStatus === 'Active';

  const updated = await pool.query(
    `UPDATE users
     SET is_active = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, name, role, is_active, updated_at`,
    [isActive, id]
  );

  return {
    ...updated.rows[0],
    status: newStatus,
  };
};

module.exports = { createStaff, getAllStaff, updateStaffStatus };
