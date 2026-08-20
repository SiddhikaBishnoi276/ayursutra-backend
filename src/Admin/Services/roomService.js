const { pool } = require('../../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ROOM
// Maps payload (name, room_type, clinic_id, status) strictly to existing DB columns:
// - id (SERIAL PRIMARY KEY)
// - clinic_id (INT)
// - name (VARCHAR(100)) — if room_type is provided, appends it for rich categorization
// - status (VARCHAR(50)) — 'available' | 'occupied' | 'under_maintenance'
// ─────────────────────────────────────────────────────────────────────────────
const createRoom = async ({ name, room_type, clinic_id, status }) => {
  // Format room name if room_type category is provided
  let formattedName = name;
  if (room_type && room_type.trim() && !name.toLowerCase().includes(room_type.toLowerCase())) {
    formattedName = `${name} (${room_type.trim()})`;
  }

  const result = await pool.query(
    `INSERT INTO rooms (name, clinic_id, status)
     VALUES ($1, $2, $3)
     RETURNING id, name, clinic_id, status`,
    [formattedName, clinic_id, status || 'available']
  );
  return result.rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL ROOMS
// ─────────────────────────────────────────────────────────────────────────────
const getAllRooms = async (clinic_id) => {
  const params = [];
  let whereClause = '';

  if (clinic_id) {
    params.push(clinic_id);
    whereClause = `WHERE clinic_id = $1`;
  }

  const result = await pool.query(
    `SELECT id, name, clinic_id, status
     FROM rooms
     ${whereClause}
     ORDER BY id ASC`,
    params
  );

  return result.rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ROOM OCCUPANCY (Real-Time Detailed Tracking)
// Performs SQL JOINs across rooms, sessions, therapist users, and patient users:
// - Finds active sessions (where sessions.status = 'in_progress')
// - Fetches assigned therapist's Name, Phone & ID
// - Fetches assigned patient's Name & ID
// - Fetches session timing (scheduled date, scheduled time, actual start time, actual end time)
// - Dynamically computes live occupancy_status ('Available' | 'Occupied' | 'Maintenance')
// ─────────────────────────────────────────────────────────────────────────────
const getRoomOccupancy = async (clinic_id) => {
  const params = [];
  let whereClause = '';

  if (clinic_id) {
    params.push(clinic_id);
    whereClause = `WHERE r.clinic_id = $1`;
  }

  const result = await pool.query(
    `SELECT
       r.id,
       r.name,
       r.clinic_id,
       r.status AS stored_status,
       -- Active Session Data (NULL if room has no session in_progress)
       active_session.id                  AS active_session_id,
       active_session.patient_id,
       active_session.patient_name,
       active_session.therapist_id,
       active_session.therapist_name,
       active_session.therapist_phone,
       active_session.scheduled_date,
       active_session.scheduled_time,
       active_session.actual_start_time,
       active_session.actual_end_time,
       -- Live Dynamic Occupancy Status
       CASE
         WHEN r.status = 'under_maintenance' THEN 'Maintenance'
         WHEN active_session.id IS NOT NULL  THEN 'Occupied'
         ELSE 'Available'
       END AS occupancy_status
     FROM rooms r
     LEFT JOIN LATERAL (
       SELECT
         s.id,
         s.patient_id,
         pu.name AS patient_name,
         s.therapist_id,
         tu.name AS therapist_name,
         tu.phone AS therapist_phone,
         s.scheduled_date,
         s.scheduled_time,
         s.actual_start_time,
         s.actual_end_time
       FROM sessions s
       LEFT JOIN users tu ON tu.id = s.therapist_id
       LEFT JOIN users pu ON pu.id = s.patient_id
       WHERE s.room_id = r.id
         AND s.status = 'in_progress'
       LIMIT 1
     ) active_session ON TRUE
     ${whereClause}
     ORDER BY r.id ASC`,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    clinic_id: row.clinic_id,
    stored_status: row.stored_status,
    occupancy_status: row.occupancy_status,
    active_session: row.active_session_id
      ? {
          session_id: row.active_session_id,
          patient: {
            id: row.patient_id,
            name: row.patient_name || 'N/A',
          },
          assigned_therapist: {
            id: row.therapist_id,
            name: row.therapist_name || 'Unassigned',
            phone: row.therapist_phone || null,
          },
          timing: {
            scheduled_date: row.scheduled_date,
            scheduled_time: row.scheduled_time,
            actual_start_time: row.actual_start_time,
            actual_end_time: row.actual_end_time,
          },
        }
      : null,
  }));
};

module.exports = { createRoom, getAllRooms, getRoomOccupancy };
