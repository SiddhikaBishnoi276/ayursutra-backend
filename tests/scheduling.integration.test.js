/**
 * Integration Test Suite for Robust Scheduling, 2-Layer Availability & Conflict Resolution
 * Runs live tests against Neon PostgreSQL database.
 */

const { pool } = require('../src/config/db');
const {
  checkTherapistAvailability,
  checkRoomAvailability,
  addTherapistOverride,
  setTherapistWeeklyShift,
} = require('../src/Scheduling/Services/availabilityService');
const {
  generateTherapyPlan,
  bookSession,
  rescheduleSession,
  cancelSession,
} = require('../src/Scheduling/Services/schedulingEngine');

let passed = 0;
let failed = 0;

function logPass(msg) {
  passed++;
  console.log(`  ✅ PASS: ${msg}`);
}

function logFail(msg, err) {
  failed++;
  console.error(`  ❌ FAIL: ${msg}`);
  if (err) console.error('     Detail:', err.message || err);
}

async function runIntegrationTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING SCHEDULING INTEGRATION TESTS (DATABASE)');
  console.log('======================================================\n');

  const client = await pool.connect();

  try {
    // 0. Setup test prerequisites
    console.log('Setup: Querying test entities...');
    const doctorRes = await client.query("SELECT id, name, clinic_id, role FROM users WHERE role = 'doctor' LIMIT 1");
    const doctor = doctorRes.rows[0];
    if (!doctor) throw new Error('No doctor found. Run npm run db:seed first.');

    const patientRes = await client.query("SELECT user_id FROM patients LIMIT 1");
    const patientId = patientRes.rows[0]?.user_id;
    if (!patientId) throw new Error('No patient found. Run npm run db:seed first.');

    const therapistRes = await client.query("SELECT id, name FROM users WHERE role = 'therapist' ORDER BY name ASC");
    const therapistA = therapistRes.rows[0]; // Suresh Yadav
    const therapistB = therapistRes.rows[1] || therapistRes.rows[0]; // Priya Nair
    if (!therapistA) throw new Error('No therapist found. Run npm run db:seed first.');

    const roomsRes = await client.query("SELECT id, name FROM rooms WHERE clinic_id = $1 ORDER BY id ASC", [doctor.clinic_id]);
    const room1 = roomsRes.rows[0];
    const room2 = roomsRes.rows[1] || roomsRes.rows[0];
    if (!room1) throw new Error('No room found. Run npm run db:seed first.');

    const pkgRes = await client.query("SELECT id, name FROM therapy_packages WHERE clinic_id = $1 LIMIT 1", [doctor.clinic_id]);
    const packageId = pkgRes.rows[0]?.id;

    const stagesRes = await client.query("SELECT id, stage_type, session_duration_minutes FROM therapy_package_stages WHERE package_id = $1 ORDER BY sequence_order ASC", [packageId]);
    const stage1 = stagesRes.rows[0];
    const stage2 = stagesRes.rows[1] || stage1;

    // Create a dummy therapy plan stage for direct session booking tests
    const dummyPlanRes = await client.query(
      `INSERT INTO therapy_plans (patient_id, doctor_id, package_id, status, start_date)
       VALUES ($1, $2, $3, 'active', '2026-08-24') RETURNING id`,
      [patientId, doctor.id, packageId]
    );
    const dummyPlanId = dummyPlanRes.rows[0].id;

    const dummyStageRes = await client.query(
      `INSERT INTO therapy_plan_stages (plan_id, stage_type, sequence_order, scheduled_start_date, duration_days, status)
       VALUES ($1, 'Poorvakarma', 1, '2026-08-24', 1, 'unlocked') RETURNING id`,
      [dummyPlanId]
    );
    const dummyPlanStageId = dummyStageRes.rows[0].id;

    const TEST_DATE_WEEKDAY = '2026-08-24'; // Monday
    const TEST_DATE_SUNDAY = '2026-08-23';  // Sunday
    const TEST_DATE_WEDNESDAY = '2026-08-26'; // Wednesday

    // Clean any previous test data on test dates
    await client.query("DELETE FROM sessions WHERE scheduled_date IN ($1, $2, $3)", [TEST_DATE_WEEKDAY, TEST_DATE_SUNDAY, TEST_DATE_WEDNESDAY]);
    await client.query("DELETE FROM therapist_availability WHERE date IN ($1, $2, $3)", [TEST_DATE_WEEKDAY, TEST_DATE_SUNDAY, TEST_DATE_WEDNESDAY]);

    console.log('\n--- 1. Overlap Conflict Tests ---');

    // Case 1: Mid-overlap (Session A: 10:00 - 11:30, Session B: 10:30 - 11:15 -> MUST FAIL)
    console.log('\nTesting Case 1: Mid-overlap conflict attempt...');
    const sessionA = await bookSession({
      planStageId: dummyPlanStageId,
      patientId,
      therapistId: therapistA.id,
      roomId: room1.id,
      scheduledDate: TEST_DATE_WEEKDAY,
      scheduledStartTime: '10:00:00',
      durationMinutes: 90, // 10:00 - 11:30
    }, client);

    try {
      await bookSession({
        planStageId: dummyPlanStageId,
        patientId,
        therapistId: therapistA.id,
        roomId: room2.id,
        scheduledDate: TEST_DATE_WEEKDAY,
        scheduledStartTime: '10:30:00',
        durationMinutes: 45, // 10:30 - 11:15 (Overlaps with 10:00 - 11:30)
      }, client);
      logFail('Case 1: Overlapping booking (10:30 - 11:15) should have thrown conflict error, but succeeded');
    } catch (err) {
      if (err.message.includes('overlapping session') || err.message.includes('unavailable')) {
        logPass(`Case 1: Mid-overlap booking blocked as expected (${err.message})`);
      } else {
        logFail('Case 1: Unexpected error message', err);
      }
    }

    // Case 2: Adjacent / Back-to-Back (Session A: 10:00 - 11:30, Session B: 11:30 - 12:00 -> MUST PASS)
    console.log('\nTesting Case 2: Adjacent/Back-to-back session...');
    try {
      const sessionB = await bookSession({
        planStageId: dummyPlanStageId,
        patientId,
        therapistId: therapistA.id,
        roomId: room1.id,
        scheduledDate: TEST_DATE_WEEKDAY,
        scheduledStartTime: '11:30:00',
        durationMinutes: 30, // 11:30 - 12:00
      }, client);
      if (sessionB.scheduled_start_time === '11:30:00' && sessionB.scheduled_end_time === '12:00:00') {
        logPass('Case 2: Adjacent session (11:30 - 12:00) booked successfully with zero conflict');
      } else {
        logFail(`Case 2: Session created but timings mismatched: ${sessionB.scheduled_start_time} - ${sessionB.scheduled_end_time}`);
      }
    } catch (err) {
      logFail('Case 2: Adjacent booking should have succeeded but failed', err);
    }

    // Case 3: Start overlap (Session C: 12:00 - 13:00, Session D: 11:45 - 12:30 -> MUST FAIL)
    console.log('\nTesting Case 3: Start overlap conflict attempt...');
    const sessionC = await bookSession({
      planStageId: dummyPlanStageId,
      patientId,
      therapistId: therapistB.id,
      roomId: room2.id,
      scheduledDate: TEST_DATE_WEEKDAY,
      scheduledStartTime: '12:00:00',
      durationMinutes: 60, // 12:00 - 13:00
    }, client);

    try {
      await bookSession({
        planStageId: dummyPlanStageId,
        patientId,
        therapistId: therapistB.id,
        roomId: room1.id,
        scheduledDate: TEST_DATE_WEEKDAY,
        scheduledStartTime: '11:45:00',
        durationMinutes: 45, // 11:45 - 12:30 (Overlaps 12:00 - 13:00)
      }, client);
      logFail('Case 3: Start overlap booking (11:45 - 12:30) should have thrown conflict error, but succeeded');
    } catch (err) {
      if (err.message.includes('overlapping session') || err.message.includes('unavailable')) {
        logPass(`Case 3: Start overlap booking blocked as expected (${err.message})`);
      } else {
        logFail('Case 3: Unexpected error message', err);
      }
    }

    // Case 4: Room double-booking attempt (Must Fail)
    console.log('\nTesting Case 4: Room double-booking conflict attempt...');
    try {
      // Room 1 is occupied by therapistA from 10:00 - 11:30.
      // Attempt to book Room 1 with therapistB from 10:45 - 11:45
      await bookSession({
        planStageId: dummyPlanStageId,
        patientId,
        therapistId: therapistB.id,
        roomId: room1.id, // Same room!
        scheduledDate: TEST_DATE_WEEKDAY,
        scheduledStartTime: '10:45:00',
        durationMinutes: 60,
      }, client);
      logFail('Case 4: Room double booking should have thrown room conflict, but succeeded');
    } catch (err) {
      if (err.message.includes('Room is unavailable') || err.message.includes('overlapping session')) {
        logPass(`Case 4: Room double-booking blocked as expected (${err.message})`);
      } else {
        logFail('Case 4: Unexpected error message for room conflict', err);
      }
    }

    console.log('\n--- 2. Weekly Shift & Override Tests ---');

    // Case 5: Therapist default shift Mon-Fri 09:00 - 18:00. Booking attempt on Sunday -> MUST FAIL
    console.log('\nTesting Case 5: Weekly Shift Sunday (Day off)...');
    try {
      await bookSession({
        planStageId: dummyPlanStageId,
        patientId,
        therapistId: therapistA.id,
        roomId: room1.id,
        scheduledDate: TEST_DATE_SUNDAY, // Sunday
        scheduledStartTime: '10:00:00',
        durationMinutes: 60,
      }, client);
      logFail('Case 5: Booking on therapist day off (Sunday) should have failed, but succeeded');
    } catch (err) {
      if (err.message.includes('day off') || err.message.includes('not scheduled to work')) {
        logPass(`Case 5: Booking on day off blocked as expected (${err.message})`);
      } else {
        logFail('Case 5: Unexpected error message', err);
      }
    }

    // Case 6: Therapist has override in therapist_availability for a specific Wednesday marked as "LEAVE" -> MUST FAIL
    console.log('\nTesting Case 6: Date Override LEAVE on Wednesday...');
    await addTherapistOverride(client, therapistA.id, TEST_DATE_WEDNESDAY, {
      is_available: false,
      status: 'leave',
      reason: 'Ayurveda Conference & Leave',
    });

    try {
      await bookSession({
        planStageId: dummyPlanStageId,
        patientId,
        therapistId: therapistA.id,
        roomId: room1.id,
        scheduledDate: TEST_DATE_WEDNESDAY,
        scheduledStartTime: '10:00:00',
        durationMinutes: 60,
      }, client);
      logFail('Case 6: Booking on therapist override leave date should have failed, but succeeded');
    } catch (err) {
      if (err.message.includes('leave') || err.message.includes('unavailable')) {
        logPass(`Case 6: Booking on leave date blocked as expected (${err.message})`);
      } else {
        logFail('Case 6: Unexpected error message for override leave', err);
      }
    }

    // Case 7: Outside shift working hours (09:00 - 18:00, booking attempt 18:00 - 19:00) -> MUST FAIL
    console.log('\nTesting Case 7: Outside Shift Working Hours (18:00 - 19:00)...');
    try {
      await bookSession({
        planStageId: dummyPlanStageId,
        patientId,
        therapistId: therapistA.id,
        roomId: room1.id,
        scheduledDate: TEST_DATE_WEEKDAY,
        scheduledStartTime: '18:00:00',
        durationMinutes: 60, // 18:00 - 19:00
      }, client);
      logFail('Case 7: Booking outside shift working hours (18:00 - 19:00) should have failed, but succeeded');
    } catch (err) {
      if (err.message.includes('outside therapist regular working hours') || err.message.includes('outside')) {
        logPass(`Case 7: Booking outside shift hours blocked as expected (${err.message})`);
      } else {
        logFail('Case 7: Unexpected error message', err);
      }
    }

    console.log('\n--- 3. Stage Duration Calculation Tests ---');

    // Case 8: Stage 1 (30 min) booked at 14:00 -> scheduled_end_time correctly saved as 14:30:00
    console.log('\nTesting Case 8: Stage duration 30 min...');
    const session30 = await bookSession({
      planStageId: dummyPlanStageId,
      patientId,
      therapistId: therapistA.id,
      roomId: room1.id,
      scheduledDate: TEST_DATE_WEEKDAY,
      scheduledStartTime: '14:00:00',
      durationMinutes: 30,
    }, client);

    if (session30.scheduled_start_time === '14:00:00' && session30.scheduled_end_time === '14:30:00') {
      logPass(`Case 8: 30-min stage saved correctly (start: ${session30.scheduled_start_time}, end: ${session30.scheduled_end_time})`);
    } else {
      logFail(`Case 8: Incorrect times for 30-min stage: ${session30.scheduled_start_time} - ${session30.scheduled_end_time}`);
    }

    // Case 9: Stage 2 (90 min) booked at 15:00 -> scheduled_end_time correctly saved as 16:30:00
    console.log('\nTesting Case 9: Stage duration 90 min...');
    const session90 = await bookSession({
      planStageId: dummyPlanStageId,
      patientId,
      therapistId: therapistA.id,
      roomId: room1.id,
      scheduledDate: TEST_DATE_WEEKDAY,
      scheduledStartTime: '15:00:00',
      durationMinutes: 90,
    }, client);

    if (session90.scheduled_start_time === '15:00:00' && session90.scheduled_end_time === '16:30:00') {
      logPass(`Case 9: 90-min stage saved correctly (start: ${session90.scheduled_start_time}, end: ${session90.scheduled_end_time})`);
    } else {
      logFail(`Case 9: Incorrect times for 90-min stage: ${session90.scheduled_start_time} - ${session90.scheduled_end_time}`);
    }

    console.log('\n--- 4. Rescheduling & Cancellation Tests ---');

    // Case 10: Rescheduling conflict vs success
    console.log('\nTesting Case 10: Rescheduling with conflict validation...');
    try {
      // Attempt to reschedule session90 (15:00 - 16:30) to overlap with session30 (14:00 - 14:30) at 14:15
      await rescheduleSession(session90.id, {
        scheduledStartTime: '14:15:00',
        durationMinutes: 90,
      }, client);
      logFail('Case 10: Rescheduling to overlapping slot should have failed, but succeeded');
    } catch (err) {
      logPass(`Case 10a: Rescheduling to conflicting slot blocked as expected (${err.message})`);
    }

    // Reschedule to a clean slot 16:30 - 17:30
    const rescheduled = await rescheduleSession(session90.id, {
      scheduledStartTime: '16:30:00',
      durationMinutes: 60,
    }, client);
    if (rescheduled.scheduled_start_time === '16:30:00' && rescheduled.scheduled_end_time === '17:30:00') {
      logPass(`Case 10b: Rescheduling to clean slot succeeded (new slot: ${rescheduled.scheduled_start_time} - ${rescheduled.scheduled_end_time})`);
    } else {
      logFail('Case 10b: Rescheduling time mismatch');
    }

    // Case 11: Cancelled session frees up slot
    console.log('\nTesting Case 11: Session cancellation frees slot...');
    await cancelSession(sessionA.id, client);
    // Now slot 10:00 - 11:30 on therapistA & room1 should be available
    const newSessionInFreedSlot = await bookSession({
      planStageId: dummyPlanStageId,
      patientId,
      therapistId: therapistA.id,
      roomId: room1.id,
      scheduledDate: TEST_DATE_WEEKDAY,
      scheduledStartTime: '10:00:00',
      durationMinutes: 60,
    }, client);
    if (newSessionInFreedSlot.id) {
      logPass('Case 11: Cancelled session allowed new booking in the same slot without conflict');
    } else {
      logFail('Case 11: Failed to book in cancelled slot');
    }

    console.log('\n--- 5. End-to-End Smart Schedule Generation Test ---');
    console.log('Testing generateTherapyPlan with 2-layer availability & stage durations...');
    const fullPlan = await generateTherapyPlan(doctor, patientId, packageId, { preferredStartTime: '10:00:00' });
    if (fullPlan && fullPlan.schedule && fullPlan.schedule.length > 0) {
      const totalSessions = fullPlan.schedule.reduce((sum, s) => sum + s.sessions.length, 0);
      logPass(`Full therapy plan generated with ${fullPlan.schedule.length} stages and ${totalSessions} sessions`);
      
      // Verify stage session durations
      fullPlan.schedule.forEach((stg) => {
        stg.sessions.forEach((sess) => {
          console.log(`      - Stage: ${stg.stage_type} | Duration: ${sess.duration_minutes}m | Slot: ${sess.start_time} to ${sess.end_time}`);
        });
      });
    } else {
      logFail('End-to-end plan generation failed');
    }

    // Cleanup dummy plan
    await client.query("DELETE FROM therapy_plans WHERE id = $1", [dummyPlanId]);

    console.log('\n------------------------------------------------------');
    console.log(`Integration Tests Summary: ${passed} Passed, ${failed} Failed`);
    console.log('------------------------------------------------------\n');

    if (failed > 0) {
      throw new Error(`${failed} integration test(s) failed`);
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runIntegrationTests()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Test run failed with error:', err);
      pool.end().then(() => process.exit(1));
    });
}

module.exports = { runIntegrationTests };
