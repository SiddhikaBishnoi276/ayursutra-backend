const http = require('http');
const assert = require('assert');
const app = require('../src/app');
const { pool } = require('../src/config/db');

async function runTests() {
  console.log('🧪 Starting Therapist View & Progression Engine Integration Tests...\n');

  // Start temporary server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`📡 Test server running on ${baseUrl}`);

  let testClinicId, doctorUserId, therapistUserId, patientUserId, roomId, packageId, planId;
  let stage1Id, stage2Id, stage3Id, session1Id, session2Id;
  const testRunId = Date.now().toString().slice(-6);

  try {
    // --------------------------------------------------------------------------
    // 1. SEED TEST DATA
    // --------------------------------------------------------------------------
    console.log('\n🌱 Step 1: Seeding test data in database...');

    // Clinic
    const clinicRes = await pool.query(`
      INSERT INTO clinics (name, practitioner_mode, address, contact_phone)
      VALUES ($1, 'clinic', '123 Ayurveda Marg', $2)
      RETURNING id;
    `, [`AyurSutra Test Clinic ${testRunId}`, `+9199${testRunId}01`]);
    testClinicId = clinicRes.rows[0].id;

    // Doctor User
    const docRes = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('doctor', 'Dr. Ananya Sharma', $1, $2, 'hash123', 'Female', $3)
      RETURNING id;
    `, [`ananya.${testRunId}@ayursutra.com`, `+9199${testRunId}02`, testClinicId]);
    doctorUserId = docRes.rows[0].id;

    await pool.query(`
      INSERT INTO doctor_profiles (user_id, qualification, registration_number)
      VALUES ($1, 'BAMS, MD (Ayurveda)', $2);
    `, [doctorUserId, `AYUR-TEST-${testRunId}`]);

    // Therapist User
    const therRes = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('therapist', 'Ramesh Kumar', $1, $2, 'hash123', 'Male', $3)
      RETURNING id;
    `, [`ramesh.${testRunId}@ayursutra.com`, `+9199${testRunId}03`, testClinicId]);
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
    `, [`priya.${testRunId}@ayursutra.com`, `+9199${testRunId}04`, testClinicId]);
    patientUserId = patUserRes.rows[0].id;

    await pool.query(`
      INSERT INTO patients (user_id, clinic_id, age, chief_complaint, diagnosis)
      VALUES ($1, $2, 34, 'Chronic fatigue & Joint pain', 'Vata-Pitta Imbalance');
    `, [patientUserId, testClinicId]);

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
      VALUES ($1, 'Complete Virechana Protocol', 'Virechana')
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
    // Stage 1: Poorvakarma (unlocked)
    const stg1 = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, 'Poorvakarma', 1, 3, 'unlocked')
      RETURNING id;
    `, [planId]);
    stage1Id = stg1.rows[0].id;

    // Stage 2: Pradhanakarma (locked)
    const stg2 = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, 'Pradhanakarma', 2, 1, 'locked')
      RETURNING id;
    `, [planId]);
    stage2Id = stg2.rows[0].id;

    // Stage 3: Paschatkarma (locked)
    const stg3 = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, 'Paschatkarma', 3, 3, 'locked')
      RETURNING id;
    `, [planId]);
    stage3Id = stg3.rows[0].id;

    // Sessions:
    // Session 1 (Assigned to Therapist for Stage 1)
    const ses1 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, '10:00:00', 'scheduled')
      RETURNING id;
    `, [stage1Id, patientUserId, therapistUserId, roomId]);
    session1Id = ses1.rows[0].id;

    // Session 2 (Assigned to Therapist for Stage 2)
    const ses2 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, '14:00:00', 'scheduled')
      RETURNING id;
    `, [stage2Id, patientUserId, therapistUserId, roomId]);
    session2Id = ses2.rows[0].id;

    console.log('✅ Test fixtures seeded successfully.');

    // --------------------------------------------------------------------------
    // 2. TEST ENDPOINT 1: GET /api/therapist/queue/:therapistId
    // --------------------------------------------------------------------------
    console.log('\n🔍 Step 2: Testing GET /api/therapist/queue/:therapistId...');
    const queueRes = await fetch(`${baseUrl}/api/therapist/queue/${therapistUserId}`);
    assert.strictEqual(queueRes.status, 200, `Expected 200 OK, got ${queueRes.status}`);
    const queueData = await queueRes.json();

    console.log('Queue API Output:', JSON.stringify(queueData, null, 2));
    assert(Array.isArray(queueData), 'Queue response should be an array');
    assert.strictEqual(queueData.length, 2, 'Should return 2 active sessions for the therapist');

    const firstItem = queueData[0];
    assert.strictEqual(firstItem.session_id, session1Id);
    assert.strictEqual(firstItem.patient_name, 'Priya Verma');
    assert.strictEqual(firstItem.patient_gender, 'Female');
    assert.strictEqual(firstItem.stage_type, 'Poorvakarma');
    assert.strictEqual(firstItem.stage_status, 'unlocked');
    assert.strictEqual(firstItem.room_name, 'Droni Room A');
    assert.strictEqual(firstItem.status, 'scheduled');
    console.log('✅ Endpoint 1 (Queue fetch) passed with exact response shape.');

    // --------------------------------------------------------------------------
    // 3. TEST ENDPOINT 2: PATCH /api/sessions/:sessionId/start
    // --------------------------------------------------------------------------
    console.log('\n🚀 Step 3: Testing PATCH /api/sessions/:sessionId/start...');
    const startRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/start`, {
      method: 'PATCH',
    });
    assert.strictEqual(startRes.status, 200, `Expected 200 OK, got ${startRes.status}`);
    const startData = await startRes.json();

    console.log('Start Session Output:', JSON.stringify(startData, null, 2));
    assert.strictEqual(startData.success, true);
    assert.strictEqual(startData.session_id, session1Id);
    assert.strictEqual(startData.status, 'in_progress');

    // Verify DB update
    const dbSessionAfterStart = await pool.query('SELECT status, actual_start_time FROM sessions WHERE id = $1', [session1Id]);
    assert.strictEqual(dbSessionAfterStart.rows[0].status, 'in_progress');
    assert(dbSessionAfterStart.rows[0].actual_start_time !== null, 'actual_start_time should be recorded');

    const dbStageAfterStart = await pool.query('SELECT status FROM therapy_plan_stages WHERE id = $1', [stage1Id]);
    assert.strictEqual(dbStageAfterStart.rows[0].status, 'in_progress', 'Parent stage should be marked in_progress');
    console.log('✅ Endpoint 2 (Start session & stage update) passed.');

    // --------------------------------------------------------------------------
    // 4. TEST ENDPOINT 3: POST /api/sessions/:sessionId/complete (Normal Success Flow)
    // --------------------------------------------------------------------------
    console.log('\n🏁 Step 4: Testing POST /api/sessions/:sessionId/complete (Normal Flow)...');
    const completeRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: therapistUserId,
        dosage_given: '50ml Medicated Ghee',
        patient_response: 'normal',
        vitals: { bp: '120/80', pulse: 72 },
        complication_notes: '',
      }),
    });

    assert.strictEqual(completeRes.status, 200, `Expected 200 OK, got ${completeRes.status}`);
    const completeData = await completeRes.json();

    console.log('Complete Session Normal Output:', JSON.stringify(completeData, null, 2));
    assert.strictEqual(completeData.status, 'COMPLETED');
    assert.strictEqual(completeData.stage_unlocked, true);
    assert.strictEqual(completeData.alert_generated, false);

    // Verify DB updates for Normal Flow
    const dbSessionAfterComplete = await pool.query('SELECT status, actual_end_time FROM sessions WHERE id = $1', [session1Id]);
    assert.strictEqual(dbSessionAfterComplete.rows[0].status, 'completed');
    assert(dbSessionAfterComplete.rows[0].actual_end_time !== null, 'actual_end_time should be set');

    const dbStage1 = await pool.query('SELECT status FROM therapy_plan_stages WHERE id = $1', [stage1Id]);
    assert.strictEqual(dbStage1.rows[0].status, 'complete', 'Stage 1 should now be complete');

    const dbStage2 = await pool.query('SELECT status FROM therapy_plan_stages WHERE id = $1', [stage2Id]);
    assert.strictEqual(dbStage2.rows[0].status, 'unlocked', 'Stage 2 should now be unlocked');

    const dbObs = await pool.query('SELECT * FROM session_observations WHERE session_id = $1', [session1Id]);
    assert.strictEqual(dbObs.rows.length, 1);
    assert.strictEqual(dbObs.rows[0].dosage_given, '50ml Medicated Ghee');
    assert.strictEqual(dbObs.rows[0].patient_response, 'normal');
    console.log('✅ Endpoint 3 Normal Progression Flow (Stage 1 -> Complete, Stage 2 -> Unlocked) passed.');

    // --------------------------------------------------------------------------
    // 5. TEST ENDPOINT 3: POST /api/sessions/:sessionId/complete (Complication Flow)
    // --------------------------------------------------------------------------
    console.log('\n⚠️ Step 5: Testing POST /api/sessions/:sessionId/complete (Complication Flow)...');
    
    // Start Session 2 first
    await fetch(`${baseUrl}/api/sessions/${session2Id}/start`, { method: 'PATCH' });

    const complicationRes = await fetch(`${baseUrl}/api/sessions/${session2Id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: therapistUserId,
        dosage_given: '100ml Kashaya',
        patient_response: 'abnormal',
        vitals: { bp: '155/98', pulse: 96 },
        complication_notes: 'Patient experienced dizziness and acute nausea',
      }),
    });

    assert.strictEqual(complicationRes.status, 200, `Expected 200 OK, got ${complicationRes.status}`);
    const complicationData = await complicationRes.json();

    console.log('Complete Session Complication Output:', JSON.stringify(complicationData, null, 2));
    assert.strictEqual(complicationData.status, 'FLAGGED');
    assert.strictEqual(complicationData.stage_unlocked, false);
    assert.strictEqual(complicationData.alert_generated, true);

    // Verify DB updates for Complication Flow
    const dbSession2 = await pool.query('SELECT status FROM sessions WHERE id = $1', [session2Id]);
    assert.strictEqual(dbSession2.rows[0].status, 'completed');

    const dbAlert = await pool.query('SELECT * FROM complication_alerts WHERE doctor_id = $1', [doctorUserId]);
    assert.strictEqual(dbAlert.rows.length, 1, 'Complication alert should be created for doctor');
    assert.strictEqual(dbAlert.rows[0].status, 'pending');

    const dbStage3 = await pool.query('SELECT status FROM therapy_plan_stages WHERE id = $1', [stage3Id]);
    assert.strictEqual(dbStage3.rows[0].status, 'locked', 'Stage 3 must remain locked');
    console.log('✅ Endpoint 3 Complication Flow (Doctor alerted, Next stage kept locked) passed.');

    console.log('\n🎉 ALL THERAPIST VIEW & PROGRESSION ENGINE TESTS PASSED PERFECTLY!\n');
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
