const { pool, query } = require('../../config/db');
const { addDays, formatDate } = require('../../Common/Utils/dateUtils');

async function generateTherapyPlan(doctorUser, patientId, packageId) {
  const pkgResult = await query(
    'SELECT * FROM therapy_packages WHERE id = $1 AND clinic_id = $2 AND is_active = true',
    [packageId, doctorUser.clinic_id]
  );
  const pkg = pkgResult.rows[0];
  if (!pkg) throw new Error('Therapy package not found for this clinic');

  const stagesResult = await query(
    'SELECT * FROM therapy_package_stages WHERE package_id = $1 ORDER BY sequence_order ASC',
    [packageId]
  );
  const stages = stagesResult.rows;
  if (stages.length === 0) throw new Error('This package has no stages defined');

  // Filter 1: Specialization match (continuity - same therapist for the whole plan)
  const specMatch = await query(
    `SELECT u.id, u.name FROM users u
     JOIN therapist_specializations ts ON ts.therapist_id = u.id
     WHERE u.clinic_id = $1 AND u.role = 'therapist' AND u.is_active = true AND ts.therapy_type = $2
     LIMIT 1`,
    [doctorUser.clinic_id, pkg.therapy_type]
  );
  let therapist = specMatch.rows[0];

  // Fallback: any active therapist in the clinic (so scheduling never fails in demo)
  if (!therapist) {
    const fallback = await query(
      `SELECT id, name FROM users WHERE clinic_id = $1 AND role = 'therapist' AND is_active = true LIMIT 1`,
      [doctorUser.clinic_id]
    );
    therapist = fallback.rows[0];
  }
  if (!therapist) throw new Error('No active therapist available in this clinic');

  const roomsResult = await query(
    `SELECT id FROM rooms WHERE clinic_id = $1 AND status = 'available' ORDER BY id ASC`,
    [doctorUser.clinic_id]
  );
  const rooms = roomsResult.rows;
  if (rooms.length === 0) throw new Error('No available rooms in this clinic');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const startDate = new Date();
    const planResult = await client.query(
      `INSERT INTO therapy_plans (patient_id, package_id, doctor_id, status, start_date)
       VALUES ($1, $2, $3, 'active', $4) RETURNING id`,
      [patientId, packageId, doctorUser.id, formatDate(startDate)]
    );
    const planId = planResult.rows[0].id;

    const SESSION_TIME = '10:00:00';
    const scheduleOutput = [];
    let roomCursor = 0;

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageStartDate = addDays(startDate, stage.day_offset);

      const stageResult = await client.query(
        `INSERT INTO therapy_plan_stages
           (plan_id, package_stage_id, stage_type, sequence_order, scheduled_start_date, duration_days, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          planId,
          stage.id,
          stage.stage_type,
          stage.sequence_order,
          formatDate(stageStartDate),
          stage.duration_days,
          i === 0 ? 'unlocked' : 'locked',
        ]
      );
      const planStageId = stageResult.rows[0].id;

      const stageSessions = [];

      for (let d = 0; d < stage.duration_days; d++) {
        const sessionDate = addDays(stageStartDate, d);
        const sessionDateStr = formatDate(sessionDate);

        let assignedRoomId = null;
        for (let r = 0; r < rooms.length; r++) {
          const idx = (roomCursor + r) % rooms.length;
          const candidateRoomId = rooms[idx].id;
          const conflict = await client.query(
            `SELECT 1 FROM sessions WHERE room_id = $1 AND scheduled_date = $2 AND scheduled_time = $3`,
            [candidateRoomId, sessionDateStr, SESSION_TIME]
          );
          if (conflict.rows.length === 0) {
            assignedRoomId = candidateRoomId;
            roomCursor = idx + 1;
            break;
          }
        }
        if (!assignedRoomId) {
          throw new Error(`No room available on ${sessionDateStr} — all rooms double-booked`);
        }

        const sessionResult = await client.query(
          `INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
           RETURNING id, scheduled_date, scheduled_time`,
          [planStageId, patientId, therapist.id, assignedRoomId, sessionDateStr, SESSION_TIME]
        );

        stageSessions.push({
          session_id: sessionResult.rows[0].id,
          date: sessionResult.rows[0].scheduled_date,
          time: sessionResult.rows[0].scheduled_time,
          therapist: therapist.name,
          room_id: assignedRoomId,
        });
      }

      scheduleOutput.push({
        stage_type: stage.stage_type,
        duration_days: stage.duration_days,
        pre_instructions: stage.pre_instructions,
        post_instructions: stage.post_instructions,
        status: i === 0 ? 'unlocked' : 'locked',
        sessions: stageSessions,
      });
    }

    await client.query('COMMIT');

    return {
      plan_id: planId,
      package_name: pkg.name,
      therapy_type: pkg.therapy_type,
      therapist_assigned: therapist.name,
      schedule: scheduleOutput,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { generateTherapyPlan };
