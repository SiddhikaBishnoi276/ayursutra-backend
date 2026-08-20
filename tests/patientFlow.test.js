const http = require('http');
const assert = require('assert');
const app = require('../src/app');
const { pool } = require('../src/config/db');

async function runTests() {
  console.log('🧪 Starting Patient View (Screen 4) Integration Tests...\n');

  // Start temporary server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`📡 Test server running on ${baseUrl}`);

  let testClinicId, doctorUserId, therapistUserId, patientUserId, roomId, packageId, planId;
  let stage1Id, stage2Id, session1Id, session2Id;
  const testRunId = Date.now().toString().slice(-6);

  try {
    // --------------------------------------------------------------------------
    // 1. SEED TEST DATA
    // --------------------------------------------------------------------------
    console.log('\n🌱 Step 1: Seeding test data in database...');

    // Clinic
    const clinicRes = await pool.query(`
      INSERT INTO clinics (name, practitioner_mode, address, contact_phone)
      VALUES ($1, 'clinic', '456 Panchakarma Way', $2)
      RETURNING id;
    `, [`AyurSutra Patient Test Clinic ${testRunId}`, `+9188${testRunId}01`]);
    testClinicId = clinicRes.rows[0].id;

    // Doctor User
    const docRes = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('doctor', 'Dr. Arvind Nambiar', $1, $2, 'hash123', 'Male', $3)
      RETURNING id;
    `, [`arvind.${testRunId}@ayursutra.com`, `+9188${testRunId}02`, testClinicId]);
    doctorUserId = docRes.rows[0].id;

    await pool.query(`
      INSERT INTO doctor_profiles (user_id, qualification, registration_number)
      VALUES ($1, 'BAMS, MD (Ayu)', $2);
    `, [doctorUserId, `DOC-TEST-${testRunId}`]);

    // Therapist User
    const therRes = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('therapist', 'Manoj Kumar', $1, $2, 'hash123', 'Male', $3)
      RETURNING id;
    `, [`manoj.${testRunId}@ayursutra.com`, `+9188${testRunId}03`, testClinicId]);
    therapistUserId = therRes.rows[0].id;

    await pool.query(`
      INSERT INTO therapist_profiles (user_id)
      VALUES ($1);
    `, [therapistUserId]);

    // Patient User
    const patUserRes = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('patient', 'Priya Verma', $1, $2, 'hash123', 'Female', $3)
      RETURNING id;
    `, [`priya.patient.${testRunId}@ayursutra.com`, `+9188${testRunId}04`, testClinicId]);
    patientUserId = patUserRes.rows[0].id;

    await pool.query(`
      INSERT INTO patients (user_id, clinic_id, age, chief_complaint, diagnosis)
      VALUES ($1, $2, 32, 'Digestive sluggishness and insomnia', 'Pitta-Kapha Dushti');
    `, [patientUserId, testClinicId]);

    // Prakriti Assessment
    await pool.query(`
      INSERT INTO prakriti_assessments (patient_id, conducted_by, tentative_vata, tentative_pitta, tentative_kapha, confirmed_dosha)
      VALUES ($1, $2, 30, 50, 20, 'Vata-Pitta');
    `, [patientUserId, doctorUserId]);

    // Room
    const roomRes = await pool.query(`
      INSERT INTO rooms (clinic_id, name, status)
      VALUES ($1, 'Droni Room A', 'available')
      RETURNING id;
    `, [testClinicId]);
    roomId = roomRes.rows[0].id;

    // Therapy Package
    const pkgRes = await pool.query(`
      INSERT INTO therapy_packages (clinic_id, name, therapy_type)
      VALUES ($1, '7-Day Virechana Protocol', 'Virechana')
      RETURNING id;
    `, [testClinicId]);
    packageId = pkgRes.rows[0].id;

    // Therapy Plan
    const planRes = await pool.query(`
      INSERT INTO therapy_plans (patient_id, package_id, doctor_id, status, start_date)
      VALUES ($1, $2, $3, 'active', CURRENT_DATE)
      RETURNING id;
    `, [patientUserId, packageId, doctorUserId]);
    planId = planRes.rows[0].id;

    // Sequential Stages:
    // Stage 1: Poorvakarma (complete)
    const stg1 = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, 'Poorvakarma', 1, 3, 'complete')
      RETURNING id;
    `, [planId]);
    stage1Id = stg1.rows[0].id;

    // Stage 2: Pradhanakarma (unlocked - Active Stage)
    const stg2 = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, 'Pradhanakarma', 2, 1, 'unlocked')
      RETURNING id;
    `, [planId]);
    stage2Id = stg2.rows[0].id;

    // Sessions:
    // Session 1 (Completed Session for Stage 1)
    const ses1 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, status, actual_start_time, actual_end_time)
      VALUES ($1, $2, $3, $4, CURRENT_DATE - 1, '10:00:00', 'completed', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '23 hours')
      RETURNING id;
    `, [stage1Id, patientUserId, therapistUserId, roomId]);
    session1Id = ses1.rows[0].id;

    // Session 2 (Upcoming Session for Stage 2)
    const ses2 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE + 1, '14:00:00', 'scheduled')
      RETURNING id;
    `, [stage2Id, patientUserId, therapistUserId, roomId]);
    session2Id = ses2.rows[0].id;

    console.log('✅ Test fixtures seeded successfully.');

    // --------------------------------------------------------------------------
    // 2. TEST ENDPOINT 1: GET /api/patient/dashboard/:patientId
    // --------------------------------------------------------------------------
    console.log('\n🔍 Step 2: Testing GET /api/patient/dashboard/:patientId...');
    const dashRes = await fetch(`${baseUrl}/api/patient/dashboard/${patientUserId}`);
    assert.strictEqual(dashRes.status, 200, `Expected 200 OK, got ${dashRes.status}`);
    const dashData = await dashRes.json();

    console.log('Dashboard API Output:\n', JSON.stringify(dashData, null, 2));

    // Validate patient_info
    assert(dashData.patient_info, 'Should contain patient_info');
    assert.strictEqual(dashData.patient_info.patient_id, patientUserId);
    assert.strictEqual(dashData.patient_info.name, 'Priya Verma');
    assert.strictEqual(dashData.patient_info.gender, 'Female');
    assert.strictEqual(dashData.patient_info.confirmed_dosha, 'Vata-Pitta');
    assert.strictEqual(dashData.patient_info.active_package, '7-Day Virechana Protocol');
    assert.strictEqual(dashData.patient_info.plan_status, 'active');

    // Validate sessions_timeline
    assert(Array.isArray(dashData.sessions_timeline), 'sessions_timeline should be an array');
    assert.strictEqual(dashData.sessions_timeline.length, 2);
    
    const timeline1 = dashData.sessions_timeline[0];
    assert.strictEqual(timeline1.session_id, session1Id);
    assert.strictEqual(timeline1.stage_type, 'Poorvakarma');
    assert.strictEqual(timeline1.sequence_order, 1);
    assert.strictEqual(timeline1.stage_status, 'complete');
    assert.strictEqual(timeline1.room_name, 'Droni Room A');
    assert.strictEqual(timeline1.session_status, 'completed');

    const timeline2 = dashData.sessions_timeline[1];
    assert.strictEqual(timeline2.session_id, session2Id);
    assert.strictEqual(timeline2.stage_type, 'Pradhanakarma');
    assert.strictEqual(timeline2.sequence_order, 2);
    assert.strictEqual(timeline2.stage_status, 'unlocked');
    assert.strictEqual(timeline2.room_name, 'Droni Room A');
    assert.strictEqual(timeline2.session_status, 'scheduled');

    // Validate current_diet_instructions (should reflect unlocked Pradhanakarma stage)
    assert(dashData.current_diet_instructions, 'Should contain current_diet_instructions');
    assert.strictEqual(dashData.current_diet_instructions.stage, 'Pradhanakarma');
    assert(dashData.current_diet_instructions.pathya.includes('Rice Gruel') || dashData.current_diet_instructions.pathya.includes('Peya'));
    assert(dashData.current_diet_instructions.apathya.includes('dairy') || dashData.current_diet_instructions.apathya.includes('fried'));

    // Validate simulated_reminder
    assert(typeof dashData.simulated_reminder === 'string' && dashData.simulated_reminder.length > 0);
    console.log('✅ Endpoint 1 (Patient Dashboard) passed all schema & assertion checks.');

    // --------------------------------------------------------------------------
    // 3. TEST ENDPOINT 2: POST /api/patient/feedback
    // --------------------------------------------------------------------------
    console.log('\n📝 Step 3: Testing POST /api/patient/feedback...');
    const feedbackPayload = {
      session_id: session1Id,
      patient_id: patientUserId,
      pain_scale: 3,
      sleep_quality: 8,
      energy_level: 7,
      side_effects: 'None reported',
    };

    const feedbackRes = await fetch(`${baseUrl}/api/patient/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedbackPayload),
    });

    assert.strictEqual(feedbackRes.status, 201, `Expected 201 Created, got ${feedbackRes.status}`);
    const feedbackData = await feedbackRes.json();

    console.log('Feedback API Output:\n', JSON.stringify(feedbackData, null, 2));
    assert.strictEqual(feedbackData.success, true);
    assert.strictEqual(feedbackData.message, 'Feedback submitted successfully');
    assert(feedbackData.feedback_id, 'Should return feedback_id');

    // Verify DB insertion
    const dbFeedback = await pool.query('SELECT * FROM patient_feedback WHERE id = $1', [feedbackData.feedback_id]);
    assert.strictEqual(dbFeedback.rows.length, 1);
    assert.strictEqual(dbFeedback.rows[0].session_id, session1Id);
    assert.strictEqual(dbFeedback.rows[0].patient_id, patientUserId);
    assert.strictEqual(dbFeedback.rows[0].pain_scale, 3);
    assert.strictEqual(dbFeedback.rows[0].sleep_quality, 8);
    assert.strictEqual(dbFeedback.rows[0].energy_level, 7);
    assert.strictEqual(dbFeedback.rows[0].side_effects, 'None reported');
    console.log('✅ Endpoint 2 (Patient Feedback Submission) passed with verified DB state.');

    console.log('\n🎉 ALL PATIENT VIEW (SCREEN 4) TESTS PASSED PERFECTLY!\n');
  } finally {
    // Clean up test data
    console.log('🧹 Cleaning up test fixtures...');
    try {
      if (doctorUserId || therapistUserId || patientUserId) {
        const userIds = [doctorUserId, therapistUserId, patientUserId].filter(Boolean);
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
      }
      if (testClinicId) {
        await pool.query('DELETE FROM clinics WHERE id = $1', [testClinicId]);
      }
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
    server.close();
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Integration Test Failed:', err);
    process.exit(1);
  });
