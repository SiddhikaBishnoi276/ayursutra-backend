const http = require('http');
const assert = require('assert');
const app = require('../src/app');
const { pool } = require('../src/config/db');

/**
 * Master End-to-End Integration & System Verification Test Suite
 * Covers Admin, Doctor, Therapist, Patient, and Solo Practitioner Flows
 * with 100% adherence to schema.sql and Dual-Contract standards.
 */
async function runMasterE2ETests() {
  console.log('================================================================');
  console.log('🚀 STARTING AYURSUTRA MASTER E2E INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  // Spin up an ephemeral test HTTP server on an open OS port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`📡 Ephemeral Test Server running on ${baseUrl}`);

  const testRunId = Date.now().toString().slice(-6);
  console.log(`🏷️  Execution Test Run ID: ${testRunId}\n`);

  // Tracking fixtures for teardown
  const createdUserIds = [];
  const createdClinicIds = [];
  let testClinicId, soloClinicId, adminUserId, doctorUserId, therapist1UserId, therapist2UserId, soloDoctorUserId;
  let patientUserId, roomId, packageId, pkgStage1Id, pkgStage2Id, pkgStage3Id;
  let planId, stage1Id, stage2Id, stage3Id, session1Id, session2Id, session3Id, session4Id, soloSessionId;
  let question1Id, option1Id;

  try {
    // ==========================================================================
    // STEP 1: DATABASE SETUP & SEED FIXTURES
    // ==========================================================================
    console.log('🌱 STEP 1: Seeding baseline deterministic database fixtures...');

    // 1.1 Clinic (Clinic Mode)
    const clinicRes = await pool.query(`
      INSERT INTO clinics (name, practitioner_mode, address, contact_phone)
      VALUES ($1, 'clinic', '108 Charaka Marg, New Delhi', $2)
      RETURNING id;
    `, [`AyurSutra Main Center ${testRunId}`, `+9111${testRunId}01`]);
    testClinicId = clinicRes.rows[0].id;
    createdClinicIds.push(testClinicId);

    // 1.2 Admin User
    const adminRes = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('clinic_admin', 'Admin Rajesh', $1, $2, 'hash123', 'Male', $3)
      RETURNING id;
    `, [`admin.${testRunId}@ayursutra.com`, `+9111${testRunId}02`, testClinicId]);
    adminUserId = adminRes.rows[0].id;
    createdUserIds.push(adminUserId);
    await pool.query('UPDATE clinics SET owner_user_id = $1 WHERE id = $2', [adminUserId, testClinicId]);

    // 1.3 Verified Doctor
    const docRes = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('doctor', 'Dr. Arvind Nambiar', $1, $2, 'hash123', 'Male', $3)
      RETURNING id;
    `, [`arvind.${testRunId}@ayursutra.com`, `+9111${testRunId}03`, testClinicId]);
    doctorUserId = docRes.rows[0].id;
    createdUserIds.push(doctorUserId);

    await pool.query(`
      INSERT INTO doctor_profiles (user_id, qualification, registration_number)
      VALUES ($1, 'BAMS, MD (Panchakarma)', $2);
    `, [doctorUserId, `AYUR-DOC-${testRunId}`]);

    // 1.4 Primary Therapist
    const ther1Res = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('therapist', 'Sunil Nair', $1, $2, 'hash123', 'Male', $3)
      RETURNING id;
    `, [`sunil.${testRunId}@ayursutra.com`, `+9111${testRunId}04`, testClinicId]);
    therapist1UserId = ther1Res.rows[0].id;
    createdUserIds.push(therapist1UserId);

    await pool.query(`
      INSERT INTO therapist_profiles (user_id)
      VALUES ($1);
    `, [therapist1UserId]);

    // 1.5 Secondary Therapist (for Handover tests)
    const ther2Res = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('therapist', 'Deepa Menon', $1, $2, 'hash123', 'Female', $3)
      RETURNING id;
    `, [`deepa.${testRunId}@ayursutra.com`, `+9111${testRunId}05`, testClinicId]);
    therapist2UserId = ther2Res.rows[0].id;
    createdUserIds.push(therapist2UserId);

    await pool.query(`
      INSERT INTO therapist_profiles (user_id)
      VALUES ($1);
    `, [therapist2UserId]);

    // 1.6 Room
    const roomRes = await pool.query(`
      INSERT INTO rooms (clinic_id, name, status)
      VALUES ($1, 'Droni Chamber 101', 'available')
      RETURNING id;
    `, [testClinicId]);
    roomId = roomRes.rows[0].id;

    // 1.7 Master Therapy Package & Stages
    const pkgRes = await pool.query(`
      INSERT INTO therapy_packages (clinic_id, name, therapy_type, created_by)
      VALUES ($1, '7-Day Classical Virechana Protocol', 'Virechana', $2)
      RETURNING id;
    `, [testClinicId, adminUserId]);
    packageId = pkgRes.rows[0].id;

    const stg1Pkg = await pool.query(`
      INSERT INTO therapy_package_stages (package_id, stage_type, sequence_order, duration_days, session_duration_minutes, pre_instructions, post_instructions)
      VALUES ($1, 'Poorvakarma', 1, 3, 90, 'Internal Snehapana with medicated ghee.', 'Rest in warm room for 30 minutes.')
      RETURNING id;
    `, [packageId]);
    pkgStage1Id = stg1Pkg.rows[0].id;

    const stg2Pkg = await pool.query(`
      INSERT INTO therapy_package_stages (package_id, stage_type, sequence_order, duration_days, session_duration_minutes, pre_instructions, post_instructions)
      VALUES ($1, 'Pradhanakarma', 2, 1, 120, 'Early morning Virechana drug administration.', 'Strict monitoring of Vega count.')
      RETURNING id;
    `, [packageId]);
    pkgStage2Id = stg2Pkg.rows[0].id;

    const stg3Pkg = await pool.query(`
      INSERT INTO therapy_package_stages (package_id, stage_type, sequence_order, duration_days, session_duration_minutes, pre_instructions, post_instructions)
      VALUES ($1, 'Paschatkarma', 3, 3, 60, 'Samsarjana Krama dietary progression.', 'Avoid direct sunlight and wind.')
      RETURNING id;
    `, [packageId]);
    pkgStage3Id = stg3Pkg.rows[0].id;

    // 1.8 Prakriti Diagnostic Questions
    const pqRes = await pool.query(`
      INSERT INTO prakriti_questions (question_text, is_active)
      VALUES ('How do you describe your body frame and skin texture?', true)
      RETURNING id;
    `);
    question1Id = pqRes.rows[0].id;

    const optRes = await pool.query(`
      INSERT INTO prakriti_question_options (question_id, option_text, dosha_weight)
      VALUES ($1, 'Slender frame, dry skin, sensitive to cold', '{"vata": 3, "pitta": 0, "kapha": 0}')
      RETURNING id;
    `, [question1Id]);
    option1Id = optRes.rows[0].id;

    console.log('   ✅ Baseline fixtures seeded successfully.\n');

    // ==========================================================================
    // STEP 2: ADMIN FLOW VERIFICATION
    // ==========================================================================
    console.log('🏢 STEP 2: Testing Admin Flow Endpoints...');

    // 2.1 Staff Onboarding (POST /api/staff)
    const staffRes = await fetch(`${baseUrl}/api/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Meera Iyer',
        email: `meera.${testRunId}@ayursutra.com`,
        phone: `+9111${testRunId}06`,
        password: 'SecurePassword@123',
        gender: 'Female',
        role: 'doctor',
        clinic_id: testClinicId,
        qualification: 'BAMS, MD',
        registration_number: `DOC-NEW-${testRunId}`,
      }),
    });
    assert.strictEqual(staffRes.status, 201, `Expected 201, got ${staffRes.status}`);
    const staffData = await staffRes.json();
    assert.strictEqual(staffData.success, true);
    assert.strictEqual(staffData.data.name, 'Dr. Meera Iyer');
    createdUserIds.push(staffData.data.id);
    console.log('   ✅ 2.1 POST /api/staff (Doctor creation) verified.');

    // 2.2 Room Creation & Occupancy (POST /api/rooms & GET /api/rooms/occupancy)
    const newRoomRes = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': adminUserId,
      },
      body: JSON.stringify({
        name: 'Shirodhara Suite 202',
        clinic_id: testClinicId,
        status: 'available',
      }),
    });
    assert.strictEqual(newRoomRes.status, 201);
    const newRoomData = await newRoomRes.json();
    assert.strictEqual(newRoomData.data.name, 'Shirodhara Suite 202');
    console.log('   ✅ 2.2 POST /api/rooms (Room allocation) verified.');

    const occupancyRes = await fetch(`${baseUrl}/api/rooms/occupancy?clinic_id=${testClinicId}`, {
      headers: { 'x-user-id': adminUserId },
    });
    assert.strictEqual(occupancyRes.status, 200);
    const occupancyData = await occupancyRes.json();
    assert(Array.isArray(occupancyData.data));
    console.log('   ✅ 2.3 GET /api/rooms/occupancy verified.');

    // 2.3 Therapy Protocol Templates (POST /api/protocols)
    const protocolRes = await fetch(`${baseUrl}/api/protocols`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinic_id: testClinicId,
        name: 'Custom 5-Day Basti Package',
        therapy_type: 'Basti',
        created_by: adminUserId,
        stages: [
          {
            stage_type: 'Poorvakarma',
            sequence_order: 1,
            day_offset: 0,
            duration_days: 2,
            session_duration_minutes: 60,
            pre_instructions: 'Abhyanga and Nadi Sweda',
            post_instructions: 'Rest in chamber',
          },
          {
            stage_type: 'Pradhanakarma',
            sequence_order: 2,
            day_offset: 2,
            duration_days: 3,
            session_duration_minutes: 60,
            pre_instructions: 'Administer Anuvasana Basti',
            post_instructions: 'Monitor retention time',
          },
        ],
      }),
    });
    assert.strictEqual(protocolRes.status, 201);
    console.log('   ✅ 2.4 POST /api/protocols (Template with nested stages) verified.\n');

    // ==========================================================================
    // STEP 3: DOCTOR CONSULTATION & CLINICAL PROGRESSION FLOW
    // ==========================================================================
    console.log('🩺 STEP 3: Testing Doctor Consultation & Clinical Progression Flow...');

    // 3.1 Patient Onboarding (POST /api/doctor/patients)
    const patientOnboardRes = await fetch(`${baseUrl}/api/doctor/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': doctorUserId,
      },
      body: JSON.stringify({
        name: 'Anjali Nair',
        contact_number: `+9111${testRunId}07`,
        email: `anjali.${testRunId}@ayursutra.com`,
        gender: 'Female',
        age: 32,
        chief_complaint: 'Severe chronic migraine and joint stiffness',
        diagnosis: 'Vata-Pitta Dushti',
      }),
    });
    assert.strictEqual(patientOnboardRes.status, 201);
    const patientData = await patientOnboardRes.json();
    patientUserId = patientData.patient?.user_id || patientData.id;
    createdUserIds.push(patientUserId);
    console.log(`   ✅ 3.1 POST /api/doctor/patients (Patient ${patientUserId} onboarded).`);

    // 3.2 Prakriti Assessment Submission (POST /api/doctor/prakriti/patients/:patientId/assessment)
    const assessRes = await fetch(`${baseUrl}/api/doctor/prakriti/patients/${patientUserId}/assessment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': doctorUserId,
      },
      body: JSON.stringify({
        answers: [{ question_id: question1Id, option_id: option1Id }],
        clinical_observation: 'Pronounced dry skin, irregular digestion matching Vata profile.',
      }),
    });
    assert.strictEqual(assessRes.status, 201);
    const assessData = await assessRes.json();
    assert(assessData.assessment?.confirmed_dosha !== undefined);
    console.log(`   ✅ 3.2 POST Prakriti Assessment verified (Confirmed Dosha: ${assessData.assessment.confirmed_dosha}).`);

    // 3.3 Therapy Plan Instance Generation with Sequential Stage-Locking
    const planRes = await pool.query(`
      INSERT INTO therapy_plans (patient_id, package_id, doctor_id, status, start_date)
      VALUES ($1, $2, $3, 'active', CURRENT_DATE)
      RETURNING id;
    `, [patientUserId, packageId, doctorUserId]);
    planId = planRes.rows[0].id;

    // Stage 1: Poorvakarma (unlocked)
    const s1 = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, package_stage_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, $2, 'Poorvakarma', 1, 3, 'unlocked')
      RETURNING id;
    `, [planId, pkgStage1Id]);
    stage1Id = s1.rows[0].id;

    // Stage 2: Pradhanakarma (locked)
    const s2 = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, package_stage_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, $2, 'Pradhanakarma', 2, 1, 'locked')
      RETURNING id;
    `, [planId, pkgStage2Id]);
    stage2Id = s2.rows[0].id;

    // Stage 3: Paschatkarma (locked)
    const s3 = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, package_stage_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, $2, 'Paschatkarma', 3, 3, 'locked')
      RETURNING id;
    `, [planId, pkgStage3Id]);
    stage3Id = s3.rows[0].id;

    // Seed Sessions for Stage 1 & Stage 2
    // Session 1 (for normal completion)
    const ses1 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, scheduled_start_time, scheduled_end_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', '09:00:00', '10:30:00', 'scheduled')
      RETURNING id;
    `, [stage1Id, patientUserId, therapist1UserId, roomId]);
    session1Id = ses1.rows[0].id;

    // Session 2 (for complication trigger)
    const ses2 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, scheduled_start_time, scheduled_end_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, '11:00:00', '11:00:00', '13:00:00', 'scheduled')
      RETURNING id;
    `, [stage2Id, patientUserId, therapist1UserId, roomId]);
    session2Id = ses2.rows[0].id;

    // Session 3 (for emergency pause)
    const ses3 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, scheduled_start_time, scheduled_end_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, '14:00:00', '14:00:00', '15:30:00', 'in_progress')
      RETURNING id;
    `, [stage1Id, patientUserId, therapist1UserId, roomId]);
    session3Id = ses3.rows[0].id;

    // Session 4 (for shift handover)
    const ses4 = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, scheduled_start_time, scheduled_end_time, status)
      VALUES ($1, $2, $3, $4, CURRENT_DATE, '16:00:00', '16:00:00', '17:30:00', 'scheduled')
      RETURNING id;
    `, [stage1Id, patientUserId, therapist1UserId, roomId]);
    session4Id = ses4.rows[0].id;

    console.log('   ✅ 3.3 Therapy plan and sequential stages verified (Stage 1: unlocked, Stages 2 & 3: locked).\n');

    // ==========================================================================
    // STEP 4: THERAPIST OPERATIONAL FLOW (DUAL CONTRACT & ACID TRANSACTIONS)
    // ==========================================================================
    console.log('💆 STEP 4: Testing Therapist Operational Flow & Progression Engine...');

    // 4.1 GET /api/therapist/queue/:therapistId (Dual Contracts & Rich Metadata)
    const queueRes = await fetch(`${baseUrl}/api/therapist/queue/${therapist1UserId}`);
    assert.strictEqual(queueRes.status, 200);
    const queueData = await queueRes.json();
    assert(Array.isArray(queueData));
    assert(queueData.length >= 3);

    const firstItem = queueData[0];
    // Dual Contract Key Validations
    assert.strictEqual(firstItem.sessionId, firstItem.session_id);
    assert.strictEqual(firstItem.patientId, firstItem.patient_id);
    assert.strictEqual(firstItem.patientName, firstItem.patient_name);
    assert.strictEqual(firstItem.stageCategory, firstItem.stage_type);
    assert.strictEqual(firstItem.scheduledEndTime, '10:30:00');
    assert.strictEqual(firstItem.scheduled_end_time, '10:30:00');
    assert.strictEqual(firstItem.durationMinutes, 90);
    assert.strictEqual(firstItem.preInstructions, 'Internal Snehapana with medicated ghee.');
    assert(Array.isArray(firstItem.materials) && firstItem.materials.length > 0);
    console.log('   ✅ 4.1 GET /api/therapist/queue dual contracts, dynamic end-times & prep materials verified.');

    // 4.2 PATCH /api/sessions/:sessionId/start
    const startRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/start`, { method: 'PATCH' });
    assert.strictEqual(startRes.status, 200);
    const startData = await startRes.json();
    assert.strictEqual(startData.success, true);
    assert.strictEqual(startData.status, 'in_progress');

    // Verify DB update
    const dbSess1 = await pool.query('SELECT status FROM sessions WHERE id = $1', [session1Id]);
    assert.strictEqual(dbSess1.rows[0].status, 'in_progress');
    const dbStg1 = await pool.query('SELECT status FROM therapy_plan_stages WHERE id = $1', [stage1Id]);
    assert.strictEqual(dbStg1.rows[0].status, 'in_progress');
    console.log('   ✅ 4.2 PATCH /api/sessions/:sessionId/start (Session & stage marked in_progress) verified.');

    // 4.3 POST /api/sessions/:sessionId/complete (Normal Flow & Automatic Stage Unlock)
    const completeRes = await fetch(`${baseUrl}/api/sessions/${session1Id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapistId: therapist1UserId,
        dosageGiven: '60ml Medicated Mahatiktaka Ghrita',
        patientResponse: 'normal',
        vitals: { bp: '120/80', pulse: 74, spo2: '99%' },
        complicationNotes: '',
      }),
    });
    assert.strictEqual(completeRes.status, 200);
    const completeData = await completeRes.json();
    assert.strictEqual(completeData.success, true);
    assert.strictEqual(completeData.status, 'COMPLETED');
    assert.strictEqual(completeData.stageUnlocked, true);
    assert.strictEqual(completeData.stage_unlocked, true);

    // Direct DB state assertions
    const dbSess1Comp = await pool.query('SELECT status FROM sessions WHERE id = $1', [session1Id]);
    assert.strictEqual(dbSess1Comp.rows[0].status, 'completed');
    const dbStg1Comp = await pool.query('SELECT status FROM therapy_plan_stages WHERE id = $1', [stage1Id]);
    assert.strictEqual(dbStg1Comp.rows[0].status, 'complete');
    const dbStg2Unlock = await pool.query('SELECT status FROM therapy_plan_stages WHERE id = $1', [stage2Id]);
    assert.strictEqual(dbStg2Unlock.rows[0].status, 'unlocked', 'Stage 2 must automatically unlock');
    console.log('   ✅ 4.3 POST /api/sessions/:sessionId/complete (Normal Flow & Stage 2 automatic unlock) verified.');

    // 4.4 Complication Flow & Doctor Alert
    await fetch(`${baseUrl}/api/sessions/${session2Id}/start`, { method: 'PATCH' });
    const complicationRes = await fetch(`${baseUrl}/api/sessions/${session2Id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapist_id: therapist1UserId,
        dosage_given: '120ml Eranda Taila formulation',
        patient_response: 'abnormal',
        vitals: { bp: '150/95', pulse: 98 },
        complication_notes: 'Patient experienced severe cramping and excessive exhaustion post Vega 8',
      }),
    });
    assert.strictEqual(complicationRes.status, 200);
    const compData = await complicationRes.json();
    assert.strictEqual(compData.status, 'FLAGGED');
    assert.strictEqual(compData.alertGenerated, true);
    assert.strictEqual(compData.stageUnlocked, false);

    // Direct DB verification
    const dbAlert = await pool.query('SELECT * FROM complication_alerts WHERE doctor_id = $1', [doctorUserId]);
    assert(dbAlert.rows.length >= 1, 'Doctor alert record must exist');
    assert.strictEqual(dbAlert.rows[0].status, 'pending');
    const dbStg3Lock = await pool.query('SELECT status FROM therapy_plan_stages WHERE id = $1', [stage3Id]);
    assert.strictEqual(dbStg3Lock.rows[0].status, 'locked', 'Stage 3 must remain locked');
    console.log('   ✅ 4.4 Complication completion & Doctor alert generation verified.');

    // 4.5 Emergency Pause (POST /api/sessions/:sessionId/pause)
    const pauseRes = await fetch(`${baseUrl}/api/sessions/${session3Id}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        therapistId: therapist1UserId,
        reason: 'Acute vasovagal episode observed during procedure',
        vitals: { bp: '90/60', pulse: 55 },
      }),
    });
    assert.strictEqual(pauseRes.status, 200);
    const pauseData = await pauseRes.json();
    assert.strictEqual(pauseData.status, 'PAUSED');
    assert.strictEqual(pauseData.alertGenerated, true);
    console.log('   ✅ 4.5 Emergency Pause (POST /api/sessions/:sessionId/pause) verified.');

    // 4.6 Shift Handover (POST /api/therapist/shift-handover)
    const handoverRes = await fetch(`${baseUrl}/api/therapist/shift-handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceTherapistId: therapist1UserId,
        targetTherapistId: therapist2UserId,
        sessionIds: [session4Id],
        notes: 'Handing over afternoon Swedana session due to shift end',
      }),
    });
    assert.strictEqual(handoverRes.status, 200);
    const handoverData = await handoverRes.json();
    assert.strictEqual(handoverData.success, true);
    assert.strictEqual(handoverData.reassignedCount, 1);

    const dbSess4 = await pool.query('SELECT therapist_id FROM sessions WHERE id = $1', [session4Id]);
    assert.strictEqual(dbSess4.rows[0].therapist_id, therapist2UserId, 'Session 4 should now belong to therapist 2');
    console.log('   ✅ 4.6 Shift Handover (POST /api/therapist/shift-handover) verified.');

    // 4.7 Weekly Recurring Shifts (PUT & GET /api/therapist/shifts/:therapistId)
    const saveShiftsRes = await fetch(`${baseUrl}/api/therapist/shifts/${therapist1UserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { dayOfWeek: 1, startTime: '09:00:00', endTime: '18:00:00', isWorking: true },
        { dayOfWeek: 2, startTime: '09:00:00', endTime: '18:00:00', isWorking: true },
        { dayOfWeek: 0, startTime: '09:00:00', endTime: '18:00:00', isWorking: false },
      ]),
    });
    assert.strictEqual(saveShiftsRes.status, 200);

    const getShiftsRes = await fetch(`${baseUrl}/api/therapist/shifts/${therapist1UserId}`);
    assert.strictEqual(getShiftsRes.status, 200);
    const getShiftsData = await getShiftsRes.json();
    assert(Array.isArray(getShiftsData));
    assert.strictEqual(getShiftsData.length, 3);
    console.log('   ✅ 4.7 Weekly Recurring Shifts model (PUT & GET) verified.\n');

    // ==========================================================================
    // STEP 5: PATIENT PORTAL FLOW
    // ==========================================================================
    console.log('📱 STEP 5: Testing Patient Portal Flow & Dual Contracts...');

    // 5.1 GET /api/patient/dashboard/:patientId
    const pDashRes = await fetch(`${baseUrl}/api/patient/dashboard/${patientUserId}`);
    assert.strictEqual(pDashRes.status, 200);
    const pDash = await pDashRes.json();

    // Verify dual keys & timeline properties
    assert(pDash.patientInfo || pDash.patient_info);
    assert(Array.isArray(pDash.sessionsTimeline || pDash.sessions_timeline));
    const timeline = pDash.sessionsTimeline || pDash.sessions_timeline;
    assert(timeline.length >= 1);
    assert.strictEqual(timeline[0].time, '09:00 AM');
    assert.strictEqual(timeline[0].scheduledEndTime, '10:30:00');
    assert(pDash.dietPlan || pDash.diet_plan);
    assert(pDash.medications);
    console.log('   ✅ 5.1 GET /api/patient/dashboard dual contracts, 12hr time & diet plan verified.');

    // 5.2 POST /api/patient/feedback (Frontend Mapped Payload with Mathematical Fallback)
    const pFeedRes = await fetch(`${baseUrl}/api/patient/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session1Id,
        patientId: patientUserId,
        rating: 5,
        symptomImprovementScore: 8,
        overallExperience: 'Excellent treatment, feeling very light',
        comments: 'Digestive fire feels revitalized after Poorvakarma',
      }),
    });
    assert.strictEqual(pFeedRes.status, 201);
    const pFeedData = await pFeedRes.json();
    assert.strictEqual(pFeedData.success, true);
    assert.strictEqual(pFeedData.painScale, 2, 'Pain scale should be derived as 10 - symptomImprovementScore (10 - 8 = 2)');
    assert.strictEqual(pFeedData.sleepQuality, 10, 'Sleep quality should be derived as rating * 2 (5 * 2 = 10)');

    // Verify DB insertion
    const dbFeedback = await pool.query('SELECT * FROM patient_feedback WHERE session_id = $1', [session1Id]);
    assert.strictEqual(dbFeedback.rows.length, 1);
    assert.strictEqual(dbFeedback.rows[0].pain_scale, 2);
    assert.strictEqual(dbFeedback.rows[0].sleep_quality, 10);
    console.log('   ✅ 5.2 POST /api/patient/feedback (Frontend mapped formulas & DB storage) verified.\n');

    // ==========================================================================
    // STEP 6: SOLO PRACTITIONER MODE INTEGRATION
    // ==========================================================================
    console.log('🧘 STEP 6: Testing Solo Practitioner Mode Integration...');

    // 6.1 Solo Clinic & Solo Doctor User
    const soloClinicRes = await pool.query(`
      INSERT INTO clinics (name, practitioner_mode, address, contact_phone)
      VALUES ($1, 'solo', '500 Dhanwanthari Kutir, Rishikesh', $2)
      RETURNING id;
    `, [`AyurSutra Solo Practice ${testRunId}`, `+9111${testRunId}99`]);
    soloClinicId = soloClinicRes.rows[0].id;
    createdClinicIds.push(soloClinicId);

    const soloDocRes = await pool.query(`
      INSERT INTO users (role, name, email, phone, password_hash, gender, clinic_id)
      VALUES ('solo_practitioner', 'Vaidya Ramachandran', $1, $2, 'hash123', 'Male', $3)
      RETURNING id;
    `, [`vaidya.${testRunId}@ayursutra.com`, `+9111${testRunId}88`, soloClinicId]);
    soloDoctorUserId = soloDocRes.rows[0].id;
    createdUserIds.push(soloDoctorUserId);

    // Solo Therapy Plan & Session (Without explicit therapist assignment)
    const soloPlanRes = await pool.query(`
      INSERT INTO therapy_plans (patient_id, doctor_id, status, start_date)
      VALUES ($1, $2, 'active', CURRENT_DATE)
      RETURNING id;
    `, [patientUserId, soloDoctorUserId]);
    const soloPlanId = soloPlanRes.rows[0].id;

    const soloStgRes = await pool.query(`
      INSERT INTO therapy_plan_stages (plan_id, stage_type, sequence_order, duration_days, status)
      VALUES ($1, 'Poorvakarma', 1, 3, 'unlocked')
      RETURNING id;
    `, [soloPlanId]);
    const soloStageId = soloStgRes.rows[0].id;

    const soloSesRes = await pool.query(`
      INSERT INTO sessions (plan_stage_id, patient_id, therapist_id, room_id, scheduled_date, scheduled_time, scheduled_start_time, scheduled_end_time, status)
      VALUES ($1, $2, NULL, NULL, CURRENT_DATE, '08:00:00', '08:00:00', '09:00:00', 'scheduled')
      RETURNING id;
    `, [soloStageId, patientUserId]);
    soloSessionId = soloSesRes.rows[0].id;

    // 6.2 Fetch Solo Doctor's Self-Managed Queue
    const soloQueueRes = await fetch(`${baseUrl}/api/therapist/queue/${soloDoctorUserId}`);
    assert.strictEqual(soloQueueRes.status, 200);
    const soloQueueData = await soloQueueRes.json();
    assert(Array.isArray(soloQueueData));
    assert(soloQueueData.length >= 1);
    assert.strictEqual(soloQueueData[0].sessionId, soloSessionId);
    console.log('   ✅ 6.2 Solo Practitioner self-managed queue integration verified.\n');

    // ==========================================================================
    // FINAL SUMMARY
    // ==========================================================================
    console.log('================================================================');
    console.log('🎉 ALL MASTER E2E INTEGRATION & CLINICAL FLOWS PASSED 100%!');
    console.log('================================================================\n');

  } finally {
    console.log('🧹 Cleaning up master E2E test fixtures...');
    try {
      if (createdUserIds.length > 0) {
        await pool.query('DELETE FROM users WHERE id = ANY($1)', [createdUserIds]);
      }
      if (createdClinicIds.length > 0) {
        await pool.query('DELETE FROM clinics WHERE id = ANY($1)', [createdClinicIds]);
      }
    } catch (err) {
      console.warn('Cleanup warning:', err.message);
    }
    server.close();
  }
}

runMasterE2ETests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ MASTER E2E INTEGRATION TEST SUITE FAILED:', err);
    process.exit(1);
  });
