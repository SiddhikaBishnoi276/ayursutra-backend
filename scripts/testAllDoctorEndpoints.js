const http = require('http');
const assert = require('assert');
const app = require('../src/app');
const { pool } = require('../src/config/db');

async function runTests() {
  console.log('🧪 Starting Full Doctor Module Verification Suite (All Endpoints)...\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`📡 In-Memory Test Server running on ${baseUrl}\n`);

  let doctorId, clinicId, patientId, packageId, planId, sessionId;

  async function req(method, path, body, headers = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  }

  try {
    // 1. Auth Login as Doctor
    console.log('--- Step 1: Doctor Login ---');
    const loginRes = await req('POST', '/api/auth/mock-login', { role: 'doctor' });
    assert.strictEqual(loginRes.status, 200, 'Doctor login must succeed');
    doctorId = loginRes.data.user_id;
    clinicId = loginRes.data.clinic_id;
    console.log(`✅ Logged in as Dr. ${loginRes.data.name} (ID: ${doctorId}, Clinic: ${clinicId})`);

    const authHeaders = { 'x-user-id': doctorId };

    // 2. GET /api/doctor/therapists
    console.log('\n--- Step 2: GET /api/doctor/therapists ---');
    const therapistsRes = await req('GET', '/api/doctor/therapists', null, authHeaders);
    assert.strictEqual(therapistsRes.status, 200, 'GET therapists must return 200');
    assert.ok(Array.isArray(therapistsRes.data), 'Must return an array of therapists');
    assert.ok(therapistsRes.data.length > 0, 'Should have at least 1 therapist');
    const firstTherapist = therapistsRes.data[0];
    assert.ok(firstTherapist.id, 'Therapist must have id');
    assert.ok(firstTherapist.name, 'Therapist must have name');
    assert.ok(Array.isArray(firstTherapist.specializations), 'Specializations must be an array');
    assert.strictEqual(typeof firstTherapist.rating, 'number', 'Rating must be number');
    assert.strictEqual(typeof firstTherapist.activeWorkload, 'number', 'activeWorkload must be number');
    assert.strictEqual(typeof firstTherapist.isAvailable, 'boolean', 'isAvailable must be boolean');
    console.log(`✅ Fetched ${therapistsRes.data.length} therapists:`, therapistsRes.data.map(t => `${t.name} (Workload: ${t.activeWorkload}, Available: ${t.isAvailable})`));

    // 3. POST /api/doctor/therapy-packages (Custom package creation by doctor)
    console.log('\n--- Step 3: POST /api/doctor/therapy-packages ---');
    const customPkgPayload = {
      name: `Custom Janu Basti & Patra Protocol ${Date.now()}`,
      therapy_type: 'Basti',
      stages: [
        {
          stage_type: 'Poorvakarma',
          sequence_order: 1,
          day_offset: 1,
          duration_days: 2,
          session_duration_minutes: 45,
          pre_instructions: 'Drink warm water with ginger',
          post_instructions: 'Rest in warm room',
        },
        {
          stage_type: 'Pradhanakarma',
          sequence_order: 2,
          day_offset: 3,
          duration_days: 4,
          session_duration_minutes: 60,
          pre_instructions: 'Medicated oil application',
          post_instructions: 'Warm sponge bath',
        },
        {
          stage_type: 'Paschatkarma',
          sequence_order: 3,
          day_offset: 7,
          duration_days: 1,
          session_duration_minutes: 30,
          pre_instructions: 'Dietary restoration with light soup',
          post_instructions: 'Avoid strenuous exercises',
        },
      ],
    };
    const createPkgRes = await req('POST', '/api/doctor/therapy-packages', customPkgPayload, authHeaders);
    assert.strictEqual(createPkgRes.status, 201, 'POST package must return 201');
    assert.ok(createPkgRes.data.id, 'Created package must have id');
    assert.strictEqual(createPkgRes.data.stages.length, 3, 'Created package must have 3 stages');
    assert.strictEqual(createPkgRes.data.isStandard, false, 'Doctor created package response must have isStandard: false');
    assert.strictEqual(createPkgRes.data.created_by, doctorId, 'Doctor created package must set created_by to logged-in doctor');
    packageId = createPkgRes.data.id;
    console.log(`✅ Created custom therapy package ID: ${packageId} with 3 stages (isStandard: ${createPkgRes.data.isStandard}, created_by: ${createPkgRes.data.created_by})`);

    // 4. GET /api/doctor/therapy-packages (Verify dynamic is_standard & nested stages)
    console.log('\n--- Step 4: GET /api/doctor/therapy-packages ---');
    const listPkgsRes = await req('GET', '/api/doctor/therapy-packages', null, authHeaders);
    assert.strictEqual(listPkgsRes.status, 200, 'GET packages must return 200');
    assert.ok(listPkgsRes.data.length > 0, 'Packages list must not be empty');

    // Test Case A: Packages created by admin / default have isStandard: true
    const adminPkgs = listPkgsRes.data.filter(p => p.creator_role === 'clinic_admin' || p.creator_role === 'solo_practitioner' || p.created_by === null);
    assert.ok(adminPkgs.length > 0, 'At least one standard package created by admin must exist');
    for (const p of adminPkgs) {
      assert.strictEqual(p.isStandard, true, `Admin package "${p.name}" must have isStandard: true`);
      assert.strictEqual(p.is_standard, true, `Admin package "${p.name}" must have is_standard: true`);
    }
    console.log(`✅ Test Case A: Verified ${adminPkgs.length} admin packages have isStandard: true`);

    // Test Case B: Package created by doctor has isStandard: false
    const fetchedCustomPkg = listPkgsRes.data.find(p => p.id === packageId);
    assert.ok(fetchedCustomPkg, 'Created package must appear in list');
    assert.strictEqual(fetchedCustomPkg.isStandard, false, 'Doctor created package must return isStandard: false');
    assert.strictEqual(fetchedCustomPkg.is_standard, false, 'Doctor created package must return is_standard: false');
    assert.ok(Array.isArray(fetchedCustomPkg.stages) && fetchedCustomPkg.stages.length > 0, 'Package stages must be nested array');
    console.log(`✅ Test Case B: Verified doctor custom package ID ${packageId} returns isStandard: false with ${fetchedCustomPkg.stages.length} stages`);

    // 5. POST /api/doctor/patients (Intake)
    console.log('\n--- Step 5: POST /api/doctor/patients ---');
    const randomPhone = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const patientPayload = {
      name: 'Rohan Sharma ' + Date.now().toString().slice(-4),
      age: 44,
      gender: 'Male',
      contact: randomPhone,
      email: `rohan.${Date.now()}@example.com`,
      chiefComplaint: 'Chronic Lumbar Stiffness & Low Back Pain',
      diagnosis: 'Katigraha / Vata-Pitta Imbalance',
    };
    const addPatientRes = await req('POST', '/api/doctor/patients', patientPayload, authHeaders);
    assert.strictEqual(addPatientRes.status, 201, 'POST patient must return 201');
    patientId = addPatientRes.data.id || addPatientRes.data.patient.id;
    console.log(`✅ Patient onboarded: ${patientPayload.name} (ID: ${patientId})`);

    // 6. Prakriti Assessment
    console.log('\n--- Step 6: Prakriti Assessment ---');
    const questionsRes = await req('GET', '/api/doctor/prakriti/questions', null, authHeaders);
    const answers = questionsRes.data
      .filter((q) => q.options && q.options.length > 0)
      .map((q) => ({ question_id: q.id, option_id: q.options[0].id }));
    const assessmentRes = await req(
      'POST',
      `/api/doctor/prakriti/patients/${patientId}/assessment`,
      { answers, clinical_observation: 'Initial patient evaluation' },
      authHeaders
    );
    assert.strictEqual(assessmentRes.status, 201, 'Prakriti assessment must succeed');
    console.log(`✅ Prakriti locked: ${assessmentRes.data.assessment.confirmed_dosha}`);

    // 7. POST /api/doctor/patients/:id/therapy-plan (Generate Smart Schedule)
    console.log('\n--- Step 7: POST /api/doctor/patients/:id/therapy-plan ---');
    const planRes = await req(
      'POST',
      `/api/doctor/patients/${patientId}/therapy-plan`,
      { package_id: packageId },
      authHeaders
    );
    assert.strictEqual(planRes.status, 201, 'Therapy plan creation must succeed');
    planId = planRes.data.plan_id;
    console.log(`✅ Therapy Plan generated (Plan ID: ${planId}) with stages:`, planRes.data.schedule.map(s => `${s.stage_type}: ${s.sessions.length} sessions`));

    // Get a session ID for testing logs
    const sessionRes = await pool.query('SELECT id FROM sessions WHERE patient_id = $1 LIMIT 1', [patientId]);
    sessionId = sessionRes.rows[0]?.id;

    // 8. POST /api/doctor/patients/:id/vitals (Baseline & Discharge)
    console.log('\n--- Step 8: POST /api/doctor/patients/:id/vitals ---');
    const baselineVitals = {
      vasPainScore: 8.0,
      bloodPressure: '130/85',
      radialPulse: 78,
      sleepHours: 5,
      agniStatus: 'Vishamagni',
    };
    const baselineRes = await req('POST', `/api/doctor/patients/${patientId}/vitals`, { vitals: baselineVitals, type: 'baseline' }, authHeaders);
    assert.strictEqual(baselineRes.status, 201, 'Record baseline vitals must return 201');
    console.log('✅ Baseline vitals recorded successfully:', baselineRes.data);

    // 9. POST /api/doctor/patients/:id/session-log
    console.log('\n--- Step 9: POST /api/doctor/patients/:id/session-log ---');
    const logPayload = {
      sessionId,
      dosageGiven: 'Sahacharadi Taila 50ml',
      pulseBpm: 74,
      bloodPressure: '124/80',
      clinicalVASScore: 5.5,
      therapistNotes: 'Smooth session, patient reported relief after localized snehana.',
      complicationFlag: false,
    };
    const logRes = await req('POST', `/api/doctor/patients/${patientId}/session-log`, logPayload, authHeaders);
    assert.strictEqual(logRes.status, 201, 'Session log must return 201');
    console.log('✅ Session observation logged successfully:', logRes.data);

    // 10. GET /api/doctor/patients/:id/progress
    console.log('\n--- Step 10: GET /api/doctor/patients/:id/progress ---');
    const progressRes = await req('GET', `/api/doctor/patients/${patientId}/progress`, null, authHeaders);
    assert.strictEqual(progressRes.status, 200, 'GET progress must return 200');
    assert.ok(Array.isArray(progressRes.data.timeline), 'Must contain timeline array');
    assert.ok(progressRes.data.comparativeReport, 'Must contain comparativeReport');
    console.log(`✅ Fetched progress analytics: Timeline (${progressRes.data.timeline.length} sessions), Relief Percentage: ${progressRes.data.comparativeReport.reliefPercentage}%`);

    // 11. GET /api/doctor/patients (Enhanced List)
    console.log('\n--- Step 11: GET /api/doctor/patients ---');
    const patientsListRes = await req('GET', '/api/doctor/patients', null, authHeaders);
    assert.strictEqual(patientsListRes.status, 200, 'GET patients must return 200');
    const patientObj = patientsListRes.data.find(p => p.id === patientId || p.user_id === patientId);
    assert.ok(patientObj, 'Onboarded patient must be in list');
    assert.ok(patientObj.dominantPrakriti, 'Patient must have dominantPrakriti populated');
    assert.strictEqual(patientObj.status, 'in_progress', 'Patient status must be in_progress');
    console.log(`✅ Enhanced patient list verified: ${patientObj.name} | Status: ${patientObj.status} | Prakriti: ${patientObj.dominantPrakriti} | Package: ${patientObj.assignedPackageName}`);

    // 12. GET /api/doctor/dashboard/stats
    console.log('\n--- Step 12: GET /api/doctor/dashboard/stats ---');
    const statsRes = await req('GET', '/api/doctor/dashboard/stats', null, authHeaders);
    assert.strictEqual(statsRes.status, 200, 'GET dashboard stats must return 200');
    assert.ok(statsRes.data.stats, 'Must contain stats object');
    assert.ok(Array.isArray(statsRes.data.todayScheduledProcedures), 'Must contain todayScheduledProcedures array');
    assert.ok(Array.isArray(statsRes.data.complicationAlerts), 'Must contain complicationAlerts array');
    assert.ok(Array.isArray(statsRes.data.recentActivity), 'Must contain recentActivity array');
    console.log('✅ Dashboard Overview Stats:', statsRes.data.stats);
    console.log('   Recent Activities:', statsRes.data.recentActivity.map(a => `${a.type}: ${a.title}`));

    console.log('\n🎉 ALL 12 DOCTOR ENDPOINT VERIFICATION STEPS PASSED 100% PERFECTLY!\n');
  } catch (err) {
    console.error('❌ Test Failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
  }
}

runTests();
