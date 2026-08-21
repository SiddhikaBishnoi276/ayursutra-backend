const http = require('http');
const assert = require('assert');
const app = require('../src/app');
const { pool } = require('../src/config/db');

async function runTests() {
  console.log('🧪 Starting Upgraded Patient View & Integration Tests...\n');

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
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, scheduled_start_time, scheduled_end_time, status, actual_start_time, actual_end_time)
      VALUES ($1, $2, $3, $4, CURRENT_DATE - 1, '10:00:00', '10:00:00', '11:30:00', 'completed', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '23 hours')
      RETURNING id;
    `, [stage1Id, patientUserId, therapistUserId, roomId]);
    session1Id = ses1.rows[0].id;

    // Session 2 (Upcoming Session for Stage 2)
    const ses2 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, scheduled_start_time, scheduled_end_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE + 1, '14:00:00', '14:00:00', '15:30:00', 'scheduled')
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

    // Validate patient_info with dual contracts
    assert(dashData.patient_info, 'Should contain patient_info');
    assert.strictEqual(dashData.patient_info.patient_id, patientUserId);
    assert.strictEqual(dashData.patient_info.patientId, patientUserId);
    assert.strictEqual(dashData.patient_info.name, 'Priya Verma');
    assert.strictEqual(dashData.patient_info.patientName, 'Priya Verma');
    assert.strictEqual(dashData.patient_info.gender, 'Female');
    assert.strictEqual(dashData.patient_info.confirmed_dosha, 'Vata-Pitta');
    assert.strictEqual(dashData.patient_info.prakritiType, 'Vata-Pitta');
    assert.strictEqual(dashData.patient_info.active_package, '7-Day Virechana Protocol');
    assert.strictEqual(dashData.patient_info.activePackage, '7-Day Virechana Protocol');
    assert.strictEqual(dashData.patient_info.plan_status, 'active');
    assert.strictEqual(dashData.patient_info.planStatus, 'active');
    assert.strictEqual(dashData.patient_info.doctorName, 'Dr. Arvind Nambiar');

    // Validate sessions_timeline
    assert(Array.isArray(dashData.sessions_timeline), 'sessions_timeline should be an array');
    assert.strictEqual(dashData.sessions_timeline.length, 2);
    
    const timeline1 = dashData.sessions_timeline[0];
    assert.strictEqual(timeline1.session_id, session1Id);
    assert.strictEqual(timeline1.sessionId, `SES-${session1Id}`);
    assert.strictEqual(timeline1.id, `APT-${session1Id}`);
    assert.strictEqual(timeline1.stage_type, 'Poorvakarma');
    assert.strictEqual(timeline1.stageCategory, 'Poorvakarma');
    assert.strictEqual(timeline1.sequence_order, 1);
    assert.strictEqual(timeline1.stage_status, 'complete');
    assert.strictEqual(timeline1.room_name, 'Droni Room A');
    assert.strictEqual(timeline1.session_status, 'completed');
    assert.strictEqual(timeline1.status, 'completed');
    assert.strictEqual(timeline1.feedbackSubmitted, false);
    assert(Array.isArray(timeline1.preCareNotes));
    assert(Array.isArray(timeline1.postCareNotes));
    assert(typeof timeline1.therapistNotesSummary === 'string');

    const timeline2 = dashData.sessions_timeline[1];
    assert.strictEqual(timeline2.session_id, session2Id);
    assert.strictEqual(timeline2.sessionId, `SES-${session2Id}`);
    assert.strictEqual(timeline2.id, `APT-${session2Id}`);
    assert.strictEqual(timeline2.stage_type, 'Pradhanakarma');
    assert.strictEqual(timeline2.stageCategory, 'Pradhanakarma');
    assert.strictEqual(timeline2.sequence_order, 2);
    assert.strictEqual(timeline2.stage_status, 'unlocked');
    assert.strictEqual(timeline2.room_name, 'Droni Room A');
    assert.strictEqual(timeline2.session_status, 'scheduled');
    assert.strictEqual(timeline2.status, 'upcoming'); // Mapped scheduled -> upcoming
    assert.strictEqual(timeline2.canReschedule, true);
    assert.strictEqual(timeline2.time, '02:00 PM'); // 14:00:00 -> 02:00 PM

    // Validate dietPlan (Dosha-targeted)
    assert(dashData.dietPlan, 'Should contain dietPlan');
    assert.strictEqual(dashData.dietPlan.doshaTarget, 'Vata-Pitta Balance');
    assert(Array.isArray(dashData.dietPlan.dietaryGuidelines));
    assert(Array.isArray(dashData.dietPlan.forbiddenFoods));
    assert(Array.isArray(dashData.dietPlan.permittedDrinks));
    assert(Array.isArray(dashData.dietPlan.lifestyleTips));

    // Validate medications
    assert(Array.isArray(dashData.medications), 'Should contain medications array');
    assert(dashData.medications.length > 0);
    assert.strictEqual(dashData.medications[0].id, 'MED-01');

    // Validate current_diet_instructions (backwards compatibility)
    assert(dashData.current_diet_instructions, 'Should contain current_diet_instructions');
    assert.strictEqual(dashData.current_diet_instructions.stage, 'Pradhanakarma');
    assert(dashData.current_diet_instructions.pathya.includes('Rice Gruel') || dashData.current_diet_instructions.pathya.includes('Peya'));

    // Validate simulated_reminder
    assert(typeof dashData.simulated_reminder === 'string' && dashData.simulated_reminder.length > 0);
    console.log('✅ Endpoint 1 (Patient Dashboard) passed all dual contracts & schema checks.');

    // --------------------------------------------------------------------------
    // 3. TEST ENDPOINT 2: POST /api/patient/feedback (Standard Payload)
    // --------------------------------------------------------------------------
    console.log('\n📝 Step 3: Testing POST /api/patient/feedback (Standard Payload)...');
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

    console.log('Feedback API Output 1:\n', JSON.stringify(feedbackData, null, 2));
    assert.strictEqual(feedbackData.success, true);
    assert.strictEqual(feedbackData.message, 'Feedback submitted successfully');
    assert(feedbackData.feedback_id, 'Should return feedback_id');
    assert(feedbackData.feedbackId, 'Should return feedbackId');

    // Verify DB insertion
    const dbFeedback = await pool.query('SELECT * FROM patient_feedback WHERE id = $1', [feedbackData.feedback_id]);
    assert.strictEqual(dbFeedback.rows.length, 1);
    assert.strictEqual(dbFeedback.rows[0].session_id, session1Id);
    assert.strictEqual(dbFeedback.rows[0].patient_id, patientUserId);
    assert.strictEqual(dbFeedback.rows[0].pain_scale, 3);
    assert.strictEqual(dbFeedback.rows[0].sleep_quality, 8);
    assert.strictEqual(dbFeedback.rows[0].energy_level, 7);
    assert.strictEqual(dbFeedback.rows[0].side_effects, 'None reported');
    console.log('✅ Endpoint 2 (Patient Feedback Standard Submission) passed.');

    // --------------------------------------------------------------------------
    // 4. TEST ENDPOINT 2: POST /api/patient/feedback (Frontend Mapped Payload)
    // --------------------------------------------------------------------------
    console.log('\n📝 Step 4: Testing POST /api/patient/feedback (Frontend Mapped Payload)...');
    const frontendPayload = {
      sessionId: `SES-${session2Id}`, // Formatted string ID
      patientId: patientUserId, // camelCase UUID
      symptomImprovementScore: 8, // maps to pain_scale = 10 - 8 = 2
      rating: 5, // maps to sleep_quality = 10, energy_level = 10
      overallExperience: 'Felt very light and energetic post Virechana',
    };

    const frontendFeedbackRes = await fetch(`${baseUrl}/api/patient/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(frontendPayload),
    });

    assert.strictEqual(frontendFeedbackRes.status, 201, `Expected 201 Created, got ${frontendFeedbackRes.status}`);
    const frontendFeedbackData = await frontendFeedbackRes.json();

    console.log('Feedback API Output 2:\n', JSON.stringify(frontendFeedbackData, null, 2));
    assert.strictEqual(frontendFeedbackData.success, true);
    assert.strictEqual(frontendFeedbackData.sessionId, session2Id);
    assert.strictEqual(frontendFeedbackData.painScale, 2);
    assert.strictEqual(frontendFeedbackData.sleepQuality, 10);
    assert.strictEqual(frontendFeedbackData.energyLevel, 10);
    assert.strictEqual(frontendFeedbackData.sideEffects, 'Felt very light and energetic post Virechana');

    // --------------------------------------------------------------------------
    // 5. TEST DASHBOARD FEEDBACK DYNAMIC COMPUTATION
    // --------------------------------------------------------------------------
    console.log('\n🔍 Step 5: Testing feedbackSubmitted dynamic computation on Dashboard...');
    const updatedDashRes = await fetch(`${baseUrl}/api/patient/dashboard/${patientUserId}`);
    const updatedDashData = await updatedDashRes.json();
    assert.strictEqual(updatedDashData.sessions_timeline[0].feedbackSubmitted, true);
    assert.strictEqual(updatedDashData.sessions_timeline[1].feedbackSubmitted, true);
    console.log('✅ Step 5 (feedbackSubmitted dynamic calculation) passed.');

    // --------------------------------------------------------------------------
    // 6. TEST SAFE VALIDATION: Reject invalid UUID or session ID
    // --------------------------------------------------------------------------
    console.log('\n🛡️ Step 6: Testing Safe Validation & Error Handling on Malformed Inputs...');
    const invalidDash = await fetch(`${baseUrl}/api/patient/dashboard/invalid-uuid`);
    assert.strictEqual(invalidDash.status, 400);

    const invalidFeed = await fetch(`${baseUrl}/api/patient/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'invalid', patientId: patientUserId }),
    });
    assert.strictEqual(invalidFeed.status, 400);
    console.log('✅ Step 6 (Safe Parameter Validation) passed.');

    console.log('\n🎉 ALL UPGRADED PATIENT VIEW TESTS PASSED PERFECTLY!\n');
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
