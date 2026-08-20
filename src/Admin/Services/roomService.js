const { pool } = require('../../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// CREATE ROOM
// ─────────────────────────────────────────────────────────────────────────────
const createRoom = async ({ name, clinic_id, status }) => {
  const result = await pool.query(
    `INSERT INTO rooms (name, clinic_id, status)
     VALUES ($1, $2, $3)
     RETURNING id, name, clinic_id, status`,
    [name, clinic_id, status || 'available']
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
// GET ROOM OCCUPANCY (Real-Time)
// Joins rooms with any currently in_progress session to determine live status.
// Returns the stored room status PLUS a live computed occupancy_status and
// the linked session_id if the room is occupied.
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
       -- Live session data (NULL if no in_progress session)
       active_session.id        AS active_session_id,
       active_session.patient_id,
       active_session.therapist_id,
       active_session.scheduled_date,
       active_session.scheduled_time,
       -- Compute live occupancy status
       CASE
         WHEN r.status = 'under_maintenance'  THEN 'Maintenance'
         WHEN active_session.id IS NOT NULL   THEN 'Occupied'
         ELSE 'Available'
       END AS occupancy_status
     FROM rooms r
     LEFT JOIN LATERAL (
       SELECT s.id, s.patient_id, s.therapist_id, s.scheduled_date, s.scheduled_time
       FROM sessions s
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
          patient_id: row.patient_id,
          therapist_id: row.therapist_id,
          scheduled_date: row.scheduled_date,
          scheduled_time: row.scheduled_time,
        }
      : null,
  }));
};

module.exports = { createRoom, getAllRooms, getRoomOccupancy };
