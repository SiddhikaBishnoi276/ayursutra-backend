const { pool, query } = require('../../config/db');
const {
  normalizeTimeString,
  isTimeRangeWithin,
  getDayOfWeek,
} = require('../../Common/Utils/timeUtils');

/**
 * Checks if a therapist is available on a given date and time range using the 2-layer availability model + session overlap check.
 *
 * Layer 1 (Specific Date Override): Checks therapist_availability for date overrides/leaves/custom hours.
 * Layer 2 (Default Weekly Shift): Falls back to therapist_weekly_shifts for day_of_week working hours.
 * Layer 3 (Session Conflict): Checks sessions table for overlapping active (non-cancelled) bookings.
 *
 * @param {object} dbClient - PostgreSQL client or pool
 * @param {string} therapistId - UUID of the therapist
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} startTime - 'HH:MM:SS'
 * @param {string} endTime - 'HH:MM:SS'
 * @param {number|null} excludeSessionId - Optional session ID to exclude (for rescheduling)
 * @returns {Promise<{ available: boolean, reason?: string, layer?: string }>}
 */
async function checkTherapistAvailability(dbClient, therapistId, dateStr, startTime, endTime, excludeSessionId = null) {
  const runner = dbClient || pool;
  const start = normalizeTimeString(startTime);
  const end = normalizeTimeString(endTime);

  // 1. Layer 1: Check Specific Date Override (therapist_availability)
  const overrideRes = await runner.query(
    `SELECT id, therapist_id, date, start_time, end_time, status, is_available, reason
     FROM therapist_availability
     WHERE therapist_id = $1 AND date = $2
     ORDER BY id DESC LIMIT 1`,
    [therapistId, dateStr]
  );

  const override = overrideRes.rows[0];

  if (override) {
    // Check if marked as leave / not available
    if (override.is_available === false || override.status === 'leave') {
      return {
        available: false,
        layer: 'override',
        reason: override.reason || `Therapist is on leave on ${dateStr}`,
      };
    }

    // If custom hours are specified in the override
    if (override.start_time && override.end_time) {
      const withinOverride = isTimeRangeWithin(start, end, override.start_time, override.end_time);
      if (!withinOverride) {
        return {
          available: false,
          layer: 'override',
          reason: `Requested time (${start} - ${end}) is outside therapist custom override hours (${override.start_time} - ${override.end_time}) on ${dateStr}`,
        };
      }
    }
  } else {
    // 2. Layer 2: Fallback to Recurring Weekly Shift (therapist_weekly_shifts)
    const dayOfWeek = getDayOfWeek(dateStr); // 0=Sunday to 6=Saturday

    const shiftRes = await runner.query(
      `SELECT id, therapist_id, day_of_week, start_time, end_time, is_working
       FROM therapist_weekly_shifts
       WHERE therapist_id = $1 AND day_of_week = $2`,
      [therapistId, dayOfWeek]
    );

    const shift = shiftRes.rows[0];

    // If explicit shift row exists, check is_working and shift times
    // If no row exists yet, fallback to default clinic operating hours (Mon-Sat 08:00 - 18:00)
    const isWorking = shift ? shift.is_working : (dayOfWeek !== 0);
    const shiftStart = shift?.start_time || '08:00:00';
    const shiftEnd = shift?.end_time || '18:00:00';

    if (!isWorking) {
      return {
        available: false,
        layer: 'weekly_shift',
        reason: `Therapist is not scheduled to work on day ${dayOfWeek} (day off)`,
      };
    }

    const withinShift = isTimeRangeWithin(start, end, shiftStart, shiftEnd);
    if (!withinShift) {
      return {
        available: false,
        layer: 'weekly_shift',
        reason: `Requested time (${start} - ${end}) is outside therapist working hours (${shiftStart} - ${shiftEnd})`,
      };
    }
  }

  // 3. Layer 3: Overlap Conflict Check in sessions table
  // Overlap Formula: (new_start < existing_end) AND (new_end > existing_start)
  const conflictRes = await runner.query(
    `SELECT id, scheduled_start_time, scheduled_end_time, scheduled_time, status
     FROM sessions
     WHERE therapist_id = $1
       AND scheduled_date = $2
       AND status != 'cancelled'
       AND (
         (COALESCE(scheduled_start_time, scheduled_time) < $4::TIME
          AND COALESCE(scheduled_end_time, (scheduled_time + INTERVAL '60 minutes')::TIME) > $3::TIME)
         OR scheduled_time = $3::TIME
       )
       AND ($5::int IS NULL OR id != $5)
     LIMIT 1`,
    [therapistId, dateStr, start, end, excludeSessionId]
  );

  if (conflictRes.rows.length > 0) {
    const conflict = conflictRes.rows[0];
    return {
      available: false,
      layer: 'conflict',
      reason: `Therapist has an overlapping session (ID: ${conflict.id}) scheduled from ${conflict.scheduled_start_time || conflict.scheduled_time} to ${conflict.scheduled_end_time}`,
    };
  }

  return { available: true };
}

/**
 * Checks if a room has any overlapping active sessions.
 *
 * @param {object} dbClient - PostgreSQL client or pool
 * @param {number} roomId - ID of the room
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} startTime - 'HH:MM:SS'
 * @param {string} endTime - 'HH:MM:SS'
 * @param {number|null} excludeSessionId - Optional session ID to exclude
 * @returns {Promise<{ available: boolean, reason?: string }>}
 */
async function checkRoomAvailability(dbClient, roomId, dateStr, startTime, endTime, excludeSessionId = null) {
  const runner = dbClient || pool;
  const start = normalizeTimeString(startTime);
  const end = normalizeTimeString(endTime);

  const conflictRes = await runner.query(
    `SELECT id, scheduled_start_time, scheduled_end_time, scheduled_time, status
     FROM sessions
     WHERE room_id = $1
       AND scheduled_date = $2
       AND status != 'cancelled'
       AND (
         (COALESCE(scheduled_start_time, scheduled_time) < $4::TIME
          AND COALESCE(scheduled_end_time, (scheduled_time + INTERVAL '60 minutes')::TIME) > $3::TIME)
         OR scheduled_time = $3::TIME
       )
       AND ($5::int IS NULL OR id != $5)
     LIMIT 1`,
    [roomId, dateStr, start, end, excludeSessionId]
  );

  if (conflictRes.rows.length > 0) {
    const conflict = conflictRes.rows[0];
    return {
      available: false,
      reason: `Room has an overlapping session (ID: ${conflict.id}) scheduled from ${conflict.scheduled_start_time} to ${conflict.scheduled_end_time}`,
    };
  }

  return { available: true };
}

/**
 * Finds an available room in a clinic for the given date and time range.
 *
 * @param {object} dbClient 
 * @param {number} clinicId 
 * @param {string} dateStr 
 * @param {string} startTime 
 * @param {string} endTime 
 * @param {number|null} excludeSessionId 
 * @returns {Promise<number>} roomId
 */
async function findAvailableRoom(dbClient, clinicId, dateStr, startTime, endTime, excludeSessionId = null) {
  const runner = dbClient || pool;

  const roomsRes = await runner.query(
    `SELECT id, name FROM rooms WHERE clinic_id = $1 AND status = 'available' ORDER BY id ASC`,
    [clinicId]
  );

  const rooms = roomsRes.rows;
  if (rooms.length === 0) {
    throw new Error('No active rooms found in this clinic');
  }

  for (const room of rooms) {
    const roomCheck = await checkRoomAvailability(runner, room.id, dateStr, startTime, endTime, excludeSessionId);
    if (roomCheck.available) {
      return room.id;
    }
  }

  throw new Error(`All rooms are double-booked / unavailable on ${dateStr} between ${startTime} and ${endTime}`);
}

/**
 * Upserts a weekly shift for a therapist.
 */
async function setTherapistWeeklyShift(dbClient, therapistId, dayOfWeek, startTime, endTime, isWorking = true) {
  const runner = dbClient || pool;
  const start = normalizeTimeString(startTime);
  const end = normalizeTimeString(endTime);

  const res = await runner.query(
    `INSERT INTO therapist_weekly_shifts (therapist_id, day_of_week, start_time, end_time, is_working, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (therapist_id, day_of_week) 
     DO UPDATE SET 
       start_time = EXCLUDED.start_time,
       end_time = EXCLUDED.end_time,
       is_working = EXCLUDED.is_working,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [therapistId, dayOfWeek, start, end, isWorking]
  );

  return res.rows[0];
}

/**
 * Adds an availability override / leave for a therapist on a specific date.
 */
async function addTherapistOverride(dbClient, therapistId, dateStr, overrideData) {
  const runner = dbClient || pool;
  const {
    start_time = null,
    end_time = null,
    is_available = false,
    status = is_available ? 'available' : 'leave',
    reason = null,
  } = overrideData;

  const normalizedStart = start_time ? normalizeTimeString(start_time) : null;
  const normalizedEnd = end_time ? normalizeTimeString(end_time) : null;

  const res = await runner.query(
    `INSERT INTO therapist_availability (therapist_id, date, start_time, end_time, is_available, status, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [therapistId, dateStr, normalizedStart, normalizedEnd, is_available, status, reason]
  );

  return res.rows[0];
}

module.exports = {
  checkTherapistAvailability,
  checkRoomAvailability,
  findAvailableRoom,
  setTherapistWeeklyShift,
  addTherapistOverride,
};
