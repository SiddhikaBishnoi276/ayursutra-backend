const http = require('http');
const assert = require('assert');
const app = require('../src/app');
const { pool } = require('../src/config/db');

async function runTests() {
  console.log('🧪 Starting Upgraded Therapist View & Operational Endpoints Integration Tests...\n');

  // Start temporary server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`📡 Test server running on ${baseUrl}`);

  let testClinicId, doctorUserId, therapistUserId, secondTherapistUserId, patientUserId, roomId, packageId, planId;
  let stage1Id, stage2Id, stage3Id, session1Id, session2Id, session3Id, session4Id;
  let createdAvailabilityId;
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

    // Therapist User 1
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

    // Therapist User 2 (for Shift Handover tests)
    const ther2Res = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('therapist', 'Kavita Joshi', $1, $2, 'hash123', 'Female', $3)
      RETURNING id;
    `, [`kavita.${testRunId}@ayursutra.com`, `+9199${testRunId}05`, testClinicId]);
    secondTherapistUserId = ther2Res.rows[0].id;

    await pool.query(`
      INSERT INTO therapist_profiles (user_id)
      VALUES ($1);
    `, [secondTherapistUserId]);

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

    // Session 3 (for Emergency Pause testing)
    const ses3 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, '16:00:00', 'in_progress')
      RETURNING id;
    `, [stage1Id, patientUserId, therapistUserId, roomId]);
    session3Id = ses3.rows[0].id;

    // Session 4 (for Handover testing)
    const ses4 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, '17:30:00', 'scheduled')
      RETURNING id;
    `, [stage1Id, patientUserId, therapistUserId, roomId]);
    session4Id = ses4.rows[0].id;

    console.log('✅ Test fixtures seeded successfully.');

    // --------------------------------------------------------------------------
    // 2. TEST ENDPOINT 1: GET /api/therapist/queue/:therapistId (Rich Enriched Response)
    // --------------------------------------------------------------------------
    console.log('\n🔍 Step 2: Testing GET /api/therapist/queue/:therapistId (Rich Enriched Queue)...');
    const queueRes = await fetch(`${baseUrl}/api/therapist/queue/${therapistUserId}`);
    assert.strictEqual(queueRes.status, 200, `Expected 200 OK, got ${queueRes.status}`);
    const queueData = await queueRes.json();

    console.log('Queue API Output sample item:', JSON.stringify(queueData[0], null, 2));
    assert(Array.isArray(queueData), 'Queue response should be an array');
    assert.strictEqual(queueData.length, 4, 'Should return 4 active sessions for the therapist');

    const firstItem = queueData[0];
    // Dual Contracts & string ID checks
    assert.strictEqual(firstItem.id, String(session1Id));
    assert.strictEqual(firstItem.sessionId, session1Id);
    assert.strictEqual(firstItem.session_id, session1Id);
    assert.strictEqual(firstItem.patientId, patientUserId);
    assert.strictEqual(firstItem.patient_id, patientUserId);
    assert.strictEqual(firstItem.patientName, 'Priya Verma');
    assert.strictEqual(firstItem.patient_name, 'Priya Verma');
    assert.strictEqual(firstItem.patientGender, 'Female');
    assert.strictEqual(firstItem.patient_gender, 'Female');
    assert.strictEqual(firstItem.stageCategory, 'Poorvakarma');
    assert.strictEqual(firstItem.stage_type, 'Poorvakarma');
    assert.strictEqual(firstItem.stageName, 'Poorvakarma');
    assert.strictEqual(firstItem.stageStatus, 'unlocked');
    assert.strictEqual(firstItem.stage_status, 'unlocked');
    assert.strictEqual(firstItem.roomName, 'Droni Room A');
    assert.strictEqual(firstItem.room_name, 'Droni Room A');
    assert.strictEqual(firstItem.status, 'scheduled');
    assert.strictEqual(firstItem.therapistId, therapistUserId);
    assert.strictEqual(firstItem.therapist_id, therapistUserId);
    assert.strictEqual(firstItem.therapistName, 'Ramesh Kumar');

    // Preparation metadata checks
    assert(Array.isArray(firstItem.materials), 'materials should be an array');
    assert(firstItem.materials.length > 0, 'materials should have items');
    assert(firstItem.materials[0].name !== undefined);
    assert(firstItem.materials[0].quantityRequired !== undefined);
    assert(firstItem.materials[0].inStock !== undefined);
    assert.strictEqual(typeof firstItem.preInstructions, 'string');
    assert.strictEqual(typeof firstItem.pre_instructions, 'string');
    console.log('✅ Endpoint 1 (Rich Queue Fetch with Dual Contracts & Materials) passed.');

    // --------------------------------------------------------------------------
    // 3. TEST SAFE VALIDATION: Invalid IDs rejection
    // --------------------------------------------------------------------------
    console.log('\n🛡️ Step 3: Testing Safe Validation & Error Handling on Malformed IDs...');
    const invalidQueueRes = await fetch(`${baseUrl}/api/therapist/queue/not-a-valid-uuid`);
    assert.strictEqual(invalidQueueRes.status, 400, 'Expected 400 Bad Request for malformed UUID');

    const invalidSessionStartRes = await fetch(`${baseUrl}/api/sessions/invalid-id/start`, { method: 'PATCH' });
    assert.strictEqual(invalidSessionStartRes.status, 400, 'Expected 400 Bad Request for non-integer session ID');
    console.log('✅ Step 3 (Safe Parameter Validation) passed.');

    // --------------------------------------------------------------------------
    // 4. TEST ENDPOINT 2: PATCH /api/sessions/:sessionId/start (Dual Contracts)
    // --------------------------------------------------------------------------
    console.log('\n🚀 Step 4: Testing PATCH /api/sessions/:sessionId/start...');
    const startRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/start`, {
      method: 'PATCH',
    });
    assert.strictEqual(startRes.status, 200, `Expected 200 OK, got ${startRes.status}`);
    const startData = await startRes.json();

    console.log('Start Session Output:', JSON.stringify(startData, null, 2));
    assert.strictEqual(startData.success, true);
    assert.strictEqual(startData.sessionId, session1Id);
    assert.strictEqual(startData.session_id, session1Id);
    assert.strictEqual(startData.status, 'in_progress');
    assert(startData.actualStartTime !== undefined);

    // Verify DB update
    const dbSessionAfterStart = await pool.query('SELECT status, actual_start_time FROM sessions WHERE id = $1', [session1Id]);
    assert.strictEqual(dbSessionAfterStart.rows[0].status, 'in_progress');
    assert(dbSessionAfterStart.rows[0].actual_start_time !== null, 'actual_start_time should be recorded');

    const dbStageAfterStart = await pool.query('SELECT status FROM therapy_plan_stages WHERE id = $1', [stage1Id]);
    assert.strictEqual(dbStageAfterStart.rows[0].status, 'in_progress', 'Parent stage should be marked in_progress');
    console.log('✅ Endpoint 2 (Start session & stage update) passed.');

    // --------------------------------------------------------------------------
    // 5. TEST ENDPOINT 3: POST /api/sessions/:sessionId/complete (Flexible camelCase payload & Normal Flow)
    // --------------------------------------------------------------------------
    console.log('\n🏁 Step 5: Testing POST /api/sessions/:sessionId/complete (Flexible camelCase Payload)...');
    const completeRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapistId: therapistUserId, // camelCase
        dosageGiven: '50ml Medicated Ghee', // camelCase
        patientResponse: 'normal', // camelCase
        vitals: { bp: '120/80', pulse: 72, temperature: '98.4F', spo2: '99%' },
        complicationNotes: '', // camelCase
      }),
    });

    assert.strictEqual(completeRes.status, 200, `Expected 200 OK, got ${completeRes.status}`);
    const completeData = await completeRes.json();

    console.log('Complete Session Normal Output:', JSON.stringify(completeData, null, 2));
    assert.strictEqual(completeData.success, true);
    assert.strictEqual(completeData.status, 'COMPLETED');
    assert.strictEqual(completeData.stageUnlocked, true);
    assert.strictEqual(completeData.stage_unlocked, true);
    assert.strictEqual(completeData.alertGenerated, false);
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
    assert.strictEqual(dbObs.rows[0].vitals.spo2, '99%');
    console.log('✅ Endpoint 3 Normal Progression Flow (camelCase normalization & DB state) passed.');

    // --------------------------------------------------------------------------
    // 6. TEST ENDPOINT 3: POST /api/sessions/:sessionId/complete (Complication Flow)
    // --------------------------------------------------------------------------
    console.log('\n⚠️ Step 6: Testing POST /api/sessions/:sessionId/complete (Complication Flow)...');
    
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
    assert.strictEqual(complicationData.stageUnlocked, false);
    assert.strictEqual(complicationData.stage_unlocked, false);
    assert.strictEqual(complicationData.alertGenerated, true);
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

    // --------------------------------------------------------------------------
    // 7. TEST OPERATIONAL ENDPOINT: Emergency Pause (POST /api/sessions/:sessionId/pause)
    // --------------------------------------------------------------------------
    console.log('\n🛑 Step 7: Testing Emergency Pause (POST /api/sessions/:sessionId/pause)...');
    const pauseRes = await fetch(`${baseUrl}/api/sessions/${session3Id}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapistId: therapistUserId,
        reason: 'Patient reported sudden dizziness and high heart rate during Swedana',
        vitals: { bp: '160/100', pulse: 105 },
      }),
    });
    assert.strictEqual(pauseRes.status, 200, `Expected 200 OK, got ${pauseRes.status}`);
    const pauseData = await pauseRes.json();
    console.log('Emergency Pause Output:', JSON.stringify(pauseData, null, 2));
    assert.strictEqual(pauseData.success, true);
    assert.strictEqual(pauseData.status, 'PAUSED');
    assert.strictEqual(pauseData.alertGenerated, true);
    assert.strictEqual(pauseData.alert_generated, true);
    assert(pauseData.alertId !== undefined);

    // Verify DB state
    const pauseObs = await pool.query('SELECT * FROM session_observations WHERE session_id = $1', [session3Id]);
    assert.strictEqual(pauseObs.rows.length, 1);
    assert.strictEqual(pauseObs.rows[0].patient_response, 'abnormal');
    assert(pauseObs.rows[0].complication_notes.includes('sudden dizziness'));
    console.log('✅ Operational Endpoint 1 (Emergency Pause & Doctor Alert) passed.');

    // --------------------------------------------------------------------------
    // 8. TEST OPERATIONAL ENDPOINT: Shift Handover (POST /api/therapist/shift-handover)
    // --------------------------------------------------------------------------
    console.log('\n🔄 Step 8: Testing Shift Handover (POST /api/therapist/shift-handover)...');
    const handoverRes = await fetch(`${baseUrl}/api/therapist/shift-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceTherapistId: therapistUserId,
        targetTherapistId: secondTherapistUserId,
        sessionIds: [session4Id],
        notes: 'Handover evening session due to shift completion',
      }),
    });
    assert.strictEqual(handoverRes.status, 200, `Expected 200 OK, got ${handoverRes.status}`);
    const handoverData = await handoverRes.json();
    console.log('Shift Handover Output:', JSON.stringify(handoverData, null, 2));
    assert.strictEqual(handoverData.success, true);
    assert.strictEqual(handoverData.reassignedCount, 1);
    assert.strictEqual(handoverData.targetTherapistId, secondTherapistUserId);

    // Verify DB update
    const dbSession4 = await pool.query('SELECT therapist_id FROM sessions WHERE id = $1', [session4Id]);
    assert.strictEqual(dbSession4.rows[0].therapist_id, secondTherapistUserId, 'Session 4 should now belong to second therapist');
    console.log('✅ Operational Endpoint 2 (Shift Handover & Reassignment) passed.');

    // --------------------------------------------------------------------------
    // 9. TEST OPERATIONAL ENDPOINT: Availability Tracking (POST & GET /api/therapist/availability)
    // --------------------------------------------------------------------------
    console.log('\n📅 Step 9: Testing Availability Tracking (POST, GET, PATCH, DELETE /api/therapist/availability)...');
    
    // Create Availability
    const createAvailRes = await fetch(`${baseUrl}/api/therapist/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapistId: therapistUserId,
        date: '2026-08-25',
        startTime: '08:00:00',
        endTime: '16:00:00',
        status: 'available',
      }),
    });
    assert.strictEqual(createAvailRes.status, 201, `Expected 201 Created, got ${createAvailRes.status}`);
    const createAvailData = await createAvailRes.json();
    createdAvailabilityId = createAvailData.data.id;
    assert.strictEqual(createAvailData.success, true);
    assert.strictEqual(createAvailData.data.date, '2026-08-25');
    assert.strictEqual(createAvailData.data.startTime, '08:00:00');
    assert.strictEqual(createAvailData.data.start_time, '08:00:00');

    // Get Availability
    const getAvailRes = await fetch(`${baseUrl}/api/therapist/availability/${therapistUserId}?date=2026-08-25`);
    assert.strictEqual(getAvailRes.status, 200);
    const getAvailData = await getAvailRes.json();
    assert(Array.isArray(getAvailData));
    assert.strictEqual(getAvailData.length, 1);
    assert.strictEqual(getAvailData[0].therapistId, therapistUserId);
    assert.strictEqual(getAvailData[0].status, 'available');

    // Update Availability (Mark as leave)
    const updateAvailRes = await fetch(`${baseUrl}/api/therapist/availability/${createdAvailabilityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'leave',
      }),
    });
    assert.strictEqual(updateAvailRes.status, 200);
    const updateAvailData = await updateAvailRes.json();
    assert.strictEqual(updateAvailData.data.status, 'leave');

    // Delete Availability
    const delAvailRes = await fetch(`${baseUrl}/api/therapist/availability/${createdAvailabilityId}`, {
      method: 'DELETE',
    });
    assert.strictEqual(delAvailRes.status, 200);

    const getAvailAfterDel = await fetch(`${baseUrl}/api/therapist/availability/${therapistUserId}?date=2026-08-25`);
    const getAvailAfterDelData = await getAvailAfterDel.json();
    assert.strictEqual(getAvailAfterDelData.length, 0);

    console.log('✅ Operational Endpoint 3 (Availability CRUD Lifecycle) passed.');

    console.log('\n🎉 ALL UPGRADED THERAPIST VIEW & OPERATIONAL ENDPOINTS TESTS PASSED PERFECTLY!\n');
  } finally {
    // Clean up test data
    console.log('🧹 Cleaning up test fixtures...');
    try {
      if (doctorUserId || therapistUserId || secondTherapistUserId || patientUserId) {
        const userIds = [doctorUserId, therapistUserId, secondTherapistUserId, patientUserId].filter(Boolean);
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
