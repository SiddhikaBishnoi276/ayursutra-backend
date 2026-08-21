const { pool, query } = require('../../config/db');
const { addDays, formatDate } = require('../../Common/Utils/dateUtils');
const {
  normalizeTimeString,
  addMinutesToTime,
} = require('../../Common/Utils/timeUtils');
const {
  checkTherapistAvailability,
  checkRoomAvailability,
} = require('./availabilityService');

/**
 * Maps a confirmed Prakriti dosha string to its classical primary Panchakarma therapy.
 */
function mapDoshaToTherapyType(confirmedDosha) {
  if (!confirmedDosha) return 'Virechana';
  const lower = String(confirmedDosha).toLowerCase();
  if (lower.includes('vata')) return 'Basti';
  if (lower.includes('pitta')) return 'Virechana';
  if (lower.includes('kapha')) return 'Vamana';
  if (lower.includes('rakta')) return 'Raktamokshana';
  if (lower.includes('nasya') || lower.includes('shiro')) return 'Nasya';
  return 'Virechana';
}

/**
 * Resolves explicit package or dynamically auto-assigns package matching patient's confirmed Prakriti.
 */
async function resolvePackageForPatient(clinicId, patientId, explicitPackageId) {
  if (explicitPackageId) {
    const pkgResult = await query(
      'SELECT * FROM therapy_packages WHERE id = $1 AND clinic_id = $2 AND is_active = true',
      [explicitPackageId, clinicId]
    );
    const pkg = pkgResult.rows[0];
    if (!pkg) throw new Error('Therapy package not found for this clinic');
    return {
      pkg,
      autoAssigned: false,
      confirmedDosha: null,
      reason: `Manually selected by doctor: ${pkg.name}`,
    };
  }

  // Look up patient's confirmed dosha from latest prakriti assessment
  const assessmentRes = await query(
    `SELECT confirmed_dosha FROM prakriti_assessments WHERE patient_id = $1 ORDER BY assessed_at DESC LIMIT 1`,
    [patientId]
  );
  const confirmedDosha = assessmentRes.rows[0]?.confirmed_dosha || null;
  const targetTherapyType = mapDoshaToTherapyType(confirmedDosha);

  // 1. Try to find active package with exact therapy_type
  const matchedPkgRes = await query(
    `SELECT p.* FROM therapy_packages p
     LEFT JOIN users creator ON creator.id = p.created_by
     WHERE p.clinic_id = $1 AND p.is_active = true AND p.therapy_type = $2
     ORDER BY (creator.role IN ('clinic_admin', 'solo_practitioner') OR p.created_by IS NULL) DESC, p.id ASC
     LIMIT 1`,
    [clinicId, targetTherapyType]
  );

  let pkg = matchedPkgRes.rows[0];

  // 2. Fallback: Any active standard package in this clinic
  if (!pkg) {
    const fallbackPkgRes = await query(
      `SELECT p.* FROM therapy_packages p
       LEFT JOIN users creator ON creator.id = p.created_by
       WHERE p.clinic_id = $1 AND p.is_active = true
       ORDER BY (creator.role IN ('clinic_admin', 'solo_practitioner') OR p.created_by IS NULL) DESC, p.id ASC
       LIMIT 1`,
      [clinicId]
    );
    pkg = fallbackPkgRes.rows[0];
  }

  if (!pkg) {
    throw new Error('No active therapy package available in this clinic for auto-assignment');
  }

  const reason = confirmedDosha
    ? `Auto-assigned based on ${confirmedDosha} Prakriti (Classical ${targetTherapyType} protocol)`
    : `Auto-assigned standard default clinic protocol (${pkg.therapy_type})`;

  return {
    pkg,
    autoAssigned: true,
    confirmedDosha,
    reason,
  };
}

/**
 * Generates an end-to-end sequential therapy plan with stage-specific durations,
 * 2-layer therapist availability validation, and room overlap checks.
 */
async function generateTherapyPlan(doctorUser, patientId, packageId, options = {}) {
  const defaultCandidateSlots = ['10:00:00', '11:30:00', '14:00:00', '15:30:00', '09:00:00', '16:30:00'];
  const preferredSlot = options.preferredStartTime ? normalizeTimeString(options.preferredStartTime) : '10:00:00';
  const candidateSlots = [preferredSlot, ...defaultCandidateSlots.filter(s => s !== preferredSlot)];

  const resolved = await resolvePackageForPatient(doctorUser.clinic_id, patientId, packageId);
  const pkg = resolved.pkg;

  const stagesResult = await query(
    'SELECT * FROM therapy_package_stages WHERE package_id = $1 ORDER BY sequence_order ASC',
    [pkg.id]
  );
  const stages = stagesResult.rows;
  if (stages.length === 0) throw new Error('This package has no stages defined');

  // Filter 1: Specialization match (continuity - same primary therapist for the plan)
  const specMatch = await query(
    `SELECT u.id, u.name FROM users u
     JOIN therapist_specializations ts ON ts.therapist_id = u.id
     WHERE u.clinic_id = $1 AND u.role = 'therapist' AND u.is_active = true AND ts.therapy_type = $2
     LIMIT 1`,
    [doctorUser.clinic_id, pkg.therapy_type]
  );
  let primaryTherapist = specMatch.rows[0];

  // Fallback: any active therapist in the clinic
  if (!primaryTherapist) {
    const fallback = await query(
      `SELECT id, name FROM users WHERE clinic_id = $1 AND role = 'therapist' AND is_active = true LIMIT 1`,
      [doctorUser.clinic_id]
    );
    primaryTherapist = fallback.rows[0];
  }
  if (!primaryTherapist) throw new Error('No active therapist available in this clinic');

  // Fetch all active clinic therapists for fallback
  const allTherapistsRes = await query(
    `SELECT id, name FROM users WHERE clinic_id = $1 AND role = 'therapist' AND is_active = true ORDER BY (id = $2) DESC`,
    [doctorUser.clinic_id, primaryTherapist.id]
  );
  const clinicTherapists = allTherapistsRes.rows;

  const roomsResult = await query(
    `SELECT id, name FROM rooms WHERE clinic_id = $1 AND status = 'available' ORDER BY id ASC`,
    [doctorUser.clinic_id]
  );
  const rooms = roomsResult.rows;
  if (rooms.length === 0) throw new Error('No available rooms in this clinic');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const startDate = options.startDate ? new Date(options.startDate) : new Date();
    const planResult = await client.query(
      `INSERT INTO therapy_plans (patient_id, package_id, doctor_id, status, start_date)
       VALUES ($1, $2, $3, 'active', $4) RETURNING id`,
      [patientId, packageId, doctorUser.id, formatDate(startDate)]
    );
    const planId = planResult.rows[0].id;

    const scheduleOutput = [];
    let roomCursor = 0;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageDurationMinutes = stage.session_duration_minutes || 60;
      let sessionDate = addDays(startDate, stage.day_offset);

      const stageResult = await client.query(
        `INSERT INTO therapy_plan_stages
           (plan_id, package_stage_id, stage_type, sequence_order, scheduled_start_date, duration_days, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          planId,
          stage.id,
          stage.stage_type,
          stage.sequence_order,
          formatDate(sessionDate),
          stage.duration_days,
          i === 0 ? 'unlocked' : 'locked',
        ]
      );
      const planStageId = stageResult.rows[0].id;

      const stageSessions = [];
      let scheduledCount = 0;
      let dateAttempts = 0;

      while (scheduledCount < stage.duration_days && dateAttempts < 30) {
        dateAttempts++;
        const sessionDateStr = formatDate(sessionDate);

        let bookedSlot = null;

        // Try candidate slots and therapists
        slotLoop: for (const slotStart of candidateSlots) {
          const slotEnd = addMinutesToTime(slotStart, stageDurationMinutes);

          for (const therapistCandidate of clinicTherapists) {
            const therapistCheck = await checkTherapistAvailability(
              client,
              therapistCandidate.id,
              sessionDateStr,
              slotStart,
              slotEnd
            );

            if (!therapistCheck.available) {
              continue;
            }

            // Check rooms for this slot
            for (let r = 0; r < rooms.length; r++) {
              const idx = (roomCursor + r) % rooms.length;
              const candidateRoomId = rooms[idx].id;

              const roomCheck = await checkRoomAvailability(
                client,
                candidateRoomId,
                sessionDateStr,
                slotStart,
                slotEnd
              );

              if (roomCheck.available) {
                roomCursor = idx + 1;
                bookedSlot = {
                  therapist: therapistCandidate,
                  roomId: candidateRoomId,
                  startTime: slotStart,
                  endTime: slotEnd,
                  dateStr: sessionDateStr,
                };
                break slotLoop;
              }
            }
          }
        }

        if (!bookedSlot) {
          // Advance past non-working day or fully occupied day to next available date
          sessionDate = addDays(sessionDate, 1);
          continue;
        }

        const sessionResult = await client.query(
          `INSERT INTO sessions 
             (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, scheduled_start_time, scheduled_end_time, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
           RETURNING id, scheduled_date, scheduled_time, scheduled_start_time, scheduled_end_time`,
          [
            planStageId,
            patientId,
            bookedSlot.therapist.id,
            bookedSlot.roomId,
            bookedSlot.dateStr,
            bookedSlot.startTime,
            bookedSlot.startTime,
            bookedSlot.endTime,
          ]
        );

        stageSessions.push({
          session_id: sessionResult.rows[0].id,
          date: sessionResult.rows[0].scheduled_date,
          time: sessionResult.rows[0].scheduled_time,
          start_time: sessionResult.rows[0].scheduled_start_time,
          end_time: sessionResult.rows[0].scheduled_end_time,
          duration_minutes: stageDurationMinutes,
          therapist: bookedSlot.therapist.name,
          room_id: bookedSlot.roomId,
        });

        scheduledCount++;
        sessionDate = addDays(sessionDate, 1);
      }

      if (scheduledCount < stage.duration_days) {
        throw new Error(`Unable to schedule all ${stage.duration_days} days for stage ${stage.stage_type} due to clinic availability constraints.`);
      }

      scheduleOutput.push({
        stage_type: stage.stage_type,
        duration_days: stage.duration_days,
        session_duration_minutes: stageDurationMinutes,
        pre_instructions: stage.pre_instructions,
        post_instructions: stage.post_instructions,
        status: i === 0 ? 'unlocked' : 'locked',
        sessions: stageSessions,
      });
    }

    await client.query('COMMIT');

    return {
      plan_id: planId,
      package_id: pkg.id,
      package_name: pkg.name,
      therapy_type: pkg.therapy_type,
      auto_assigned: resolved.autoAssigned,
      assignment_reason: resolved.reason,
      patient_dosha: resolved.confirmedDosha,
      therapist_assigned: scheduleOutput[0]?.sessions[0]?.therapist || primaryTherapist.name,
      schedule: scheduleOutput,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Creates / Books a single session with transaction-safe 2-layer availability and overlap conflict checks.
 */
async function bookSession(sessionData, dbClient = null) {
  const {
    planStageId,
    patientId,
    therapistId,
    roomId,
    scheduledDate,
    scheduledStartTime,
    durationMinutes = 60,
  } = sessionData;

  const start = normalizeTimeString(scheduledStartTime);
  const end = addMinutesToTime(start, durationMinutes);

  const shouldManageTx = !dbClient;
  const client = dbClient || (await pool.connect());

  try {
    if (shouldManageTx) await client.query('BEGIN');

    // 1. Check therapist availability & conflicts
    const therapistCheck = await checkTherapistAvailability(client, therapistId, scheduledDate, start, end);
    if (!therapistCheck.available) {
      throw new Error(`Therapist is unavailable: ${therapistCheck.reason}`);
    }

    // 2. Check room availability & conflicts
    const roomCheck = await checkRoomAvailability(client, roomId, scheduledDate, start, end);
    if (!roomCheck.available) {
      throw new Error(`Room is unavailable: ${roomCheck.reason}`);
    }

    // 3. Insert session
    const res = await client.query(
      `INSERT INTO sessions 
         (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, scheduled_start_time, scheduled_end_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
       RETURNING *`,
      [planStageId, patientId, therapistId, roomId, scheduledDate, start, start, end]
    );

    if (shouldManageTx) await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    if (shouldManageTx) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (shouldManageTx) client.release();
  }
}

/**
 * Reschedules an existing session with overlap conflict checking.
 */
async function rescheduleSession(sessionId, rescheduleData, dbClient = null) {
  const shouldManageTx = !dbClient;
  const client = dbClient || (await pool.connect());

  try {
    if (shouldManageTx) await client.query('BEGIN');

    const existingRes = await client.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    const existing = existingRes.rows[0];
    if (!existing) throw new Error(`Session with ID ${sessionId} not found`);

    const newDate = rescheduleData.scheduledDate || existing.scheduled_date;
    const newStart = rescheduleData.scheduledStartTime 
      ? normalizeTimeString(rescheduleData.scheduledStartTime) 
      : existing.scheduled_start_time;
    
    let newEnd;
    if (rescheduleData.scheduledEndTime) {
      newEnd = normalizeTimeString(rescheduleData.scheduledEndTime);
    } else if (rescheduleData.durationMinutes) {
      newEnd = addMinutesToTime(newStart, rescheduleData.durationMinutes);
    } else {
      // Keep existing duration
      const durationMins = (new Date(`1970-01-01T${existing.scheduled_end_time}Z`) - new Date(`1970-01-01T${existing.scheduled_start_time}Z`)) / 60000;
      newEnd = addMinutesToTime(newStart, isNaN(durationMins) || durationMins <= 0 ? 60 : durationMins);
    }

    const therapistId = rescheduleData.therapistId || existing.therapist_id;
    const roomId = rescheduleData.roomId || existing.room_id;

    // Check therapist availability & conflict (excluding current session)
    const therapistCheck = await checkTherapistAvailability(client, therapistId, newDate, newStart, newEnd, sessionId);
    if (!therapistCheck.available) {
      throw new Error(`Therapist is unavailable for rescheduling: ${therapistCheck.reason}`);
    }

    // Check room availability & conflict (excluding current session)
    const roomCheck = await checkRoomAvailability(client, roomId, newDate, newStart, newEnd, sessionId);
    if (!roomCheck.available) {
      throw new Error(`Room is unavailable for rescheduling: ${roomCheck.reason}`);
    }

    const res = await client.query(
      `UPDATE sessions 
       SET scheduled_date = $1, scheduled_time = $2, scheduled_start_time = $3, scheduled_end_time = $4, therapist_id = $5, room_id = $6
       WHERE id = $7
       RETURNING *`,
      [newDate, newStart, newStart, newEnd, therapistId, roomId, sessionId]
    );

    if (shouldManageTx) await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    if (shouldManageTx) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (shouldManageTx) client.release();
  }
}

/**
 * Cancels a session.
 */
async function cancelSession(sessionId, dbClient = null) {
  const runner = dbClient || pool;
  const res = await runner.query(
    `UPDATE sessions SET status = 'cancelled', therapist_id = NULL, room_id = NULL WHERE id = $1 RETURNING *`,
    [sessionId]
  );
  if (res.rows.length === 0) throw new Error(`Session with ID ${sessionId} not found`);
  return res.rows[0];
}

module.exports = {
  generateTherapyPlan,
  bookSession,
  rescheduleSession,
  cancelSession,
};
