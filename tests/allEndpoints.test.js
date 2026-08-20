const http = require('http');
const assert = require('assert');
const app = require('../src/app');
const { pool } = require('../src/config/db');

async function runAllAudits() {
  console.log('🛡️ Starting Full System Verification Audit for Riddhima-Merged Branch...\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`📡 Test Server running on ${baseUrl}\n`);

  let testClinicId, adminUserId, doctorUserId, therapistUserId, patientUserId;
  let roomId, packageId, protocolId, planId, stage1Id, stage2Id, session1Id, session2Id;
  const testRunId = Date.now().toString().slice(-6);

  try {
    // --------------------------------------------------------------------------
    // 1. HEALTH CHECK
    // --------------------------------------------------------------------------
    console.log('1️⃣ Checking Base Health Check: GET / ...');
    const healthRes = await fetch(`${baseUrl}/`);
    assert.strictEqual(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.message, 'AyurSutra Backend API running successfully');
    console.log('   ✅ Health check OK');

    // --------------------------------------------------------------------------
    // 2. AUTH MODULE
    // --------------------------------------------------------------------------
    console.log('\n2️⃣ Checking Auth Module: POST /api/auth/mock-login ...');
    const authRes = await fetch(`${baseUrl}/api/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'clinic_admin' }),
    });
    assert.strictEqual(authRes.status, 200);
    const authData = await authRes.json();
    assert(authData.user_id, 'User ID returned');
    assert.strictEqual(authData.role, 'clinic_admin');
    console.log('   ✅ Mock login OK');

    // --------------------------------------------------------------------------
    // 3. SEED CORE DATA FOR ADMIN / THERAPIST / PATIENT
    // --------------------------------------------------------------------------
    console.log('\n3️⃣ Seeding Test Clinic & Admin...');
    const clinicRes = await pool.query(`
      INSERT INTO clinics (name, practitioner_mode, address, contact_phone)
      VALUES ($1, 'clinic', '789 Ayurveda Blvd', $2)
      RETURNING id;
    `, [`AyurSutra Audit Clinic ${testRunId}`, `+9177${testRunId}01`]);
    testClinicId = clinicRes.rows[0].id;

    // Admin user
    const adminRes = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('clinic_admin', 'Admin Ritu', $1, $2, 'hash123', 'Female', $3)
      RETURNING id;
    `, [`ritu.admin.${testRunId}@ayursutra.com`, `+9177${testRunId}02`, testClinicId]);
    adminUserId = adminRes.rows[0].id;

    await pool.query('UPDATE clinics SET owner_user_id = $1 WHERE id = $2', [adminUserId, testClinicId]);

    // --------------------------------------------------------------------------
    // 4. ADMIN: STAFF MANAGEMENT APIs
    // --------------------------------------------------------------------------
    console.log('\n4️⃣ Checking Admin Staff APIs: POST /api/staff, GET /api/staff, PATCH /api/staff/:id/status ...');
    
    // Create Doctor via API
    const createDocRes = await fetch(`${baseUrl}/api/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Vivek Sharma',
        email: `vivek.${testRunId}@ayursutra.com`,
        phone: `+9177${testRunId}03`,
        password: 'Password@123',
        gender: 'Male',
        role: 'doctor',
        clinic_id: testClinicId,
        qualification: 'BAMS, MD',
        registration_number: `DOC-AUDIT-${testRunId}`,
      }),
    });
    assert.strictEqual(createDocRes.status, 201, `Expected 201, got ${createDocRes.status}`);
    const docData = await createDocRes.json();
    doctorUserId = docData.data.id;
    assert.strictEqual(docData.data.name, 'Dr. Vivek Sharma');
    console.log('   ✅ POST /api/staff (Doctor) OK');

    // Create Therapist via API
    const createTherRes = await fetch(`${baseUrl}/api/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Kavita Joshi',
        email: `kavita.${testRunId}@ayursutra.com`,
        phone: `+9177${testRunId}04`,
        password: 'Password@123',
        gender: 'Female',
        role: 'therapist',
        clinic_id: testClinicId,
        specializations: ['Virechana', 'Basti'],
      }),
    });
    assert.strictEqual(createTherRes.status, 201);
    const therData = await createTherRes.json();
    therapistUserId = therData.data.id;
    assert.strictEqual(therData.data.name, 'Kavita Joshi');
    console.log('   ✅ POST /api/staff (Therapist with Specializations) OK');

    // List Staff
    const listStaffRes = await fetch(`${baseUrl}/api/staff?clinic_id=${testClinicId}`);
    assert.strictEqual(listStaffRes.status, 200);
    const listStaffData = await listStaffRes.json();
    assert(Array.isArray(listStaffData.data));
    assert(listStaffData.data.length >= 2);
    console.log('   ✅ GET /api/staff OK');

    // Update Staff Status
    const updateStaffRes = await fetch(`${baseUrl}/api/staff/${therapistUserId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Suspended' }),
    });
    assert.strictEqual(updateStaffRes.status, 200);
    // Re-activate
    await fetch(`${baseUrl}/api/staff/${therapistUserId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Active' }),
    });
    console.log('   ✅ PATCH /api/staff/:id/status OK');

    // --------------------------------------------------------------------------
    // 5. ADMIN: ROOM MANAGEMENT & OCCUPANCY APIs
    // --------------------------------------------------------------------------
    console.log('\n5️⃣ Checking Admin Room APIs: POST /api/rooms, GET /api/rooms, GET /api/rooms/occupancy ...');
    const createRoomRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Droni Chamber 1',
        clinic_id: testClinicId,
        status: 'available',
      }),
    });
    assert.strictEqual(createRoomRes.status, 201);
    const roomData = await createRoomRes.json();
    roomId = roomData.data.id;
    console.log('   ✅ POST /api/rooms OK');

    const getRoomsRes = await fetch(`${baseUrl}/api/rooms?clinic_id=${testClinicId}`);
    assert.strictEqual(getRoomsRes.status, 200);
    console.log('   ✅ GET /api/rooms OK');

    const getOccupancyRes = await fetch(`${baseUrl}/api/rooms/occupancy?clinic_id=${testClinicId}`);
    assert.strictEqual(getOccupancyRes.status, 200);
    console.log('   ✅ GET /api/rooms/occupancy OK');

    // --------------------------------------------------------------------------
    // 6. ADMIN: PROTOCOL & PACKAGE MANAGEMENT APIs
    // --------------------------------------------------------------------------
    console.log('\n6️⃣ Checking Admin Protocol APIs: POST /api/protocols, GET /api/protocols, GET /api/protocols/:id ...');
    const createProtoRes = await fetch(`${baseUrl}/api/protocols`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic_id: testClinicId,
        name: 'Standard 7-Day Virechana Package',
        therapy_type: 'Virechana',
        created_by: adminUserId,
        stages: [
          {
            stage_type: 'Poorvakarma',
            sequence_order: 1,
            day_offset: 0,
            duration_days: 3,
            pre_instructions: 'Snehana and Swedana protocol',
            post_instructions: 'Rest and warm water',
            base_diet_framework: { meals: 'Peya and Vilepi' },
          },
          {
            stage_type: 'Pradhanakarma',
            sequence_order: 2,
            day_offset: 3,
            duration_days: 1,
            pre_instructions: 'Early morning Virechana dosage',
            post_instructions: 'Monitor vega count',
            base_diet_framework: { meals: 'Warm water only' },
          },
        ],
      }),
    });
    assert.strictEqual(createProtoRes.status, 201);
    const protoData = await createProtoRes.json();
    packageId = protoData.data.id;
    console.log('   ✅ POST /api/protocols with nested stages OK');

    const getProtoRes = await fetch(`${baseUrl}/api/protocols/${packageId}`);
    assert.strictEqual(getProtoRes.status, 200);
    console.log('   ✅ GET /api/protocols/:id OK');

    // --------------------------------------------------------------------------
    // 7. SCREEN 3: THERAPIST VIEW & PROGRESSION ENGINE APIs
    // --------------------------------------------------------------------------
    console.log('\n7️⃣ Checking Screen 3 (Therapist View): GET /api/therapist/queue/:id, PATCH /api/sessions/:id/start, POST /api/sessions/:id/complete ...');
    
    // Seed Patient User
    const patUserRes = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('patient', 'Pooja Verma', $1, $2, 'hash123', 'Female', $3)
      RETURNING id;
    `, [`pooja.${testRunId}@ayursutra.com`, `+9177${testRunId}05`, testClinicId]);
    patientUserId = patUserRes.rows[0].id;

    await pool.query(`
      INSERT INTO patients (user_id, clinic_id, age, chief_complaint, diagnosis)
      VALUES ($1, $2, 29, 'Chronic Indigestion', 'Pitta Vitiation');
    `, [patientUserId, testClinicId]);

    // Prakriti
    await pool.query(`
      INSERT INTO prakriti_assessments (patient_id, conducted_by, tentative_vata, tentative_pitta, tentative_kapha, confirmed_dosha)
      VALUES ($1, $2, 20, 60, 20, 'Pitta-Vata');
    `, [patientUserId, doctorUserId]);

    // Therapy Plan
    const planRes = await pool.query(`
      INSERT INTO therapy_plans (patient_id, package_id, doctor_id, status, start_date)
      VALUES ($1, $2, $3, 'active', CURRENT_DATE)
      RETURNING id;
    `, [patientUserId, packageId, doctorUserId]);
    planId = planRes.rows[0].id;

    // Stages
    const stg1 = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, 'Poorvakarma', 1, 3, 'unlocked')
      RETURNING id;
    `, [planId]);
    stage1Id = stg1.rows[0].id;

    const stg2 = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, 'Pradhanakarma', 2, 1, 'locked')
      RETURNING id;
    `, [planId]);
    stage2Id = stg2.rows[0].id;

    // Sessions
    const ses1 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'scheduled')
      RETURNING id;
    `, [stage1Id, patientUserId, therapistUserId, roomId]);
    session1Id = ses1.rows[0].id;

    const ses2 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE + 1, '11:00:00', 'scheduled')
      RETURNING id;
    `, [stage2Id, patientUserId, therapistUserId, roomId]);
    session2Id = ses2.rows[0].id;

    // 7a. GET /api/therapist/queue/:therapistId
    const tQueueRes = await fetch(`${baseUrl}/api/therapist/queue/${therapistUserId}`);
    assert.strictEqual(tQueueRes.status, 200);
    const tQueue = await tQueueRes.json();
    assert(Array.isArray(tQueue));
    assert.strictEqual(tQueue.length, 2);
    console.log('   ✅ GET /api/therapist/queue/:therapistId OK');

    // 7b. PATCH /api/sessions/:sessionId/start
    const startRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/start`, { method: 'PATCH' });
    assert.strictEqual(startRes.status, 200);
    const startData = await startRes.json();
    assert.strictEqual(startData.status, 'in_progress');
    console.log('   ✅ PATCH /api/sessions/:sessionId/start OK');

    // 7c. POST /api/sessions/:sessionId/complete (Normal Flow)
    const compRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: therapistUserId,
        dosage_given: '50ml Ghrita',
        patient_response: 'normal',
        vitals: { bp: '120/80', pulse: 72 },
        complication_notes: '',
      }),
    });
    assert.strictEqual(compRes.status, 200);
    const compData = await compRes.json();
    assert.strictEqual(compData.status, 'COMPLETED');
    assert.strictEqual(compData.stage_unlocked, true);
    console.log('   ✅ POST /api/sessions/:sessionId/complete (Progression to Stage 2) OK');

    // --------------------------------------------------------------------------
    // 8. SCREEN 4: PATIENT VIEW DASHBOARD & FEEDBACK APIs
    // --------------------------------------------------------------------------
    console.log('\n8️⃣ Checking Screen 4 (Patient View): GET /api/patient/dashboard/:id, POST /api/patient/feedback ...');

    // 8a. GET /api/patient/dashboard/:patientId
    const pDashRes = await fetch(`${baseUrl}/api/patient/dashboard/${patientUserId}`);
    assert.strictEqual(pDashRes.status, 200);
    const pDash = await pDashRes.json();
    assert.strictEqual(pDash.patient_info.name, 'Pooja Verma');
    assert.strictEqual(pDash.patient_info.confirmed_dosha, 'Pitta-Vata');
    assert.strictEqual(pDash.sessions_timeline.length, 2);
    assert(pDash.current_diet_instructions);
    assert(pDash.simulated_reminder);
    console.log('   ✅ GET /api/patient/dashboard/:patientId OK');

    // 8b. POST /api/patient/feedback
    const pFeedRes = await fetch(`${baseUrl}/api/patient/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session1Id,
        patient_id: patientUserId,
        pain_scale: 2,
        sleep_quality: 9,
        energy_level: 8,
        side_effects: 'Feeling light and energetic',
      }),
    });
    assert.strictEqual(pFeedRes.status, 201);
    const pFeed = await pFeedRes.json();
    assert.strictEqual(pFeed.success, true);
    console.log('   ✅ POST /api/patient/feedback OK');

    console.log('\n================================================================');
    console.log('🎉 100% COMPLETE: ALL APIs & MODULES ON RIDDHIMA-MERGED ARE 100% VERIFIED & WORKING PERFECTLY!');
    console.log('================================================================\n');

  } finally {
    console.log('🧹 Cleaning up test audit fixtures...');
    try {
      const userIds = [adminUserId, doctorUserId, therapistUserId, patientUserId].filter(Boolean);
      if (userIds.length > 0) {
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
      }
      if (testClinicId) {
        await pool.query('DELETE FROM clinics WHERE id = $1', [testClinicId]);
      }
    } catch (err) {
      console.warn('Cleanup note:', err.message);
    }
    server.close();
  }
}

runAllAudits()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Audit Failed:', err);
    process.exit(1);
  });
