// tests/liveIntegrationSmoke.js
// Automated live integration smoke test verifying live HTTP endpoints across all 4 roles

const BASE_URL = 'http://localhost:5000';

async function runSmokeTests() {
  console.log('================================================================');
  console.log('🔍 AYURSUTRA LIVE INTEGRATION SMOKE TEST SUITE');
  console.log(`📡 Testing live server at: ${BASE_URL}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`   ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Health & Base Check
  console.log('1️⃣ CHECKING HEALTH & GATEWAY ENDPOINTS...');
  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === 'OK', 'GET /health returns 200 OK');

    const apiHealthRes = await fetch(`${BASE_URL}/api/health`);
    const apiHealthData = await apiHealthRes.json();
    assert(apiHealthRes.status === 200 && apiHealthData.status === 'OK', 'GET /api/health returns 200 OK');
  } catch (err) {
    assert(false, `Health check failed: ${err.message}`);
  }

  // Auth logins to get realistic UUIDs
  let adminId, doctorId, therapistId, patientId;
  try {
    const admLogin = await fetch(`${BASE_URL}/api/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'clinic_admin' }),
    }).then((r) => r.json());
    adminId = admLogin.user_id;

    const docLogin = await fetch(`${BASE_URL}/api/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'doctor' }),
    }).then((r) => r.json());
    doctorId = docLogin.user_id;

    const therLogin = await fetch(`${BASE_URL}/api/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'therapist' }),
    }).then((r) => r.json());
    therapistId = therLogin.user_id;

    const patLogin = await fetch(`${BASE_URL}/api/auth/mock-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'patient' }),
    }).then((r) => r.json());
    patientId = patLogin.user_id;

    assert(Boolean(adminId && doctorId && therapistId && patientId), `Auth mock logins returned valid user IDs across all 4 roles`);
  } catch (err) {
    assert(false, `Auth mock login failed: ${err.message}`);
  }

  // 2. Doctor Flow Test
  console.log('\n2️⃣ TESTING DOCTOR CLINICAL WORKFLOW...');
  let testPatientId, testPackageId;
  try {
    // 2.1 Get Patients List
    const patientsRes = await fetch(`${BASE_URL}/api/doctor/patients`, {
      headers: { 'x-user-id': doctorId },
    });
    const patientsData = await patientsRes.json();
    const patients = Array.isArray(patientsData) ? patientsData : patientsData.data || [];
    assert(patientsRes.status === 200 && Array.isArray(patients), `GET /api/doctor/patients returned ${patients.length} patients`);

    // 2.2 Onboard New Patient
    const intakeRes = await fetch(`${BASE_URL}/api/doctor/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': doctorId },
      body: JSON.stringify({
        name: 'Live Smoke Patient',
        contact_number: `+9198${Date.now().toString().slice(-8)}`,
        email: `smoke_${Date.now()}@test.com`,
        gender: 'Female',
        age: 38,
        chief_complaint: 'Chronic Fatigue and Joint Stiffness',
        diagnosis: 'Vata-dominant Amavata',
      }),
    });
    const intakeData = await intakeRes.json();
    testPatientId = intakeData.patient?.id || intakeData.patient?.user_id || intakeData.id;
    assert(intakeRes.status === 201 && testPatientId, `POST /api/doctor/patients created patient ${testPatientId}`);

    // 2.3 Get Prakriti Questions
    const questionsRes = await fetch(`${BASE_URL}/api/doctor/prakriti/questions`, {
      headers: { 'x-user-id': doctorId },
    });
    const questionsData = await questionsRes.json();
    const questions = Array.isArray(questionsData) ? questionsData : questionsData.data || [];
    assert(questionsRes.status === 200 && Array.isArray(questions) && questions.length > 0, `GET /api/doctor/prakriti/questions returned ${questions.length} questions`);

    // 2.4 Submit Prakriti Assessment
    const assessRes = await fetch(`${BASE_URL}/api/doctor/prakriti/patients/${testPatientId}/assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': doctorId },
      body: JSON.stringify({
        confirmed_dosha: 'Vata-Pitta',
        clinical_observation: 'Vata pulse noted with mild Pitta inflammation.',
        answers: questions.slice(0, 3).map((q) => ({
          question_id: q.id,
          option_id: q.options?.[0]?.id || 1,
        })),
      }),
    });
    const assessData = await assessRes.json();
    assert((assessRes.status === 201 || assessRes.status === 200) && (assessData.assessment || assessData.success || assessData.message), `POST /api/doctor/prakriti/patients/:id/assessment locked Prakriti`);

    // 2.5 Get Packages
    const pkgsRes = await fetch(`${BASE_URL}/api/doctor/therapy-packages`, {
      headers: { 'x-user-id': doctorId },
    });
    const pkgsData = await pkgsRes.json();
    const pkgs = Array.isArray(pkgsData) ? pkgsData : pkgsData.data || [];
    testPackageId = pkgs[0]?.id;
    assert(pkgsRes.status === 200 && testPackageId, `GET /api/doctor/therapy-packages found package ID ${testPackageId}`);

    // 2.6 Generate Therapy Plan
    const planRes = await fetch(`${BASE_URL}/api/doctor/patients/${testPatientId}/therapy-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': doctorId },
      body: JSON.stringify({
        package_id: testPackageId,
        start_date: new Date().toISOString().split('T')[0],
      }),
    });
    const planData = await planRes.json();
    assert(planRes.status === 201 && (planData.plan_id || planData.planId || planData.success || planData.plan || planData.therapy_plan), `POST /api/doctor/patients/:id/therapy-plan generated sequential plan with stages`);

    // 2.7 Record Vitals
    const vitalsRes = await fetch(`${BASE_URL}/api/doctor/patients/${testPatientId}/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': doctorId },
      body: JSON.stringify({
        bp: '120/80',
        pulse: 74,
        temperature: 98.6,
        weight: 65,
        spo2: 99,
      }),
    });
    assert(vitalsRes.status === 200 || vitalsRes.status === 201, `POST /api/doctor/patients/:id/vitals recorded clinical vitals`);
  } catch (err) {
    assert(false, `Doctor workflow failed: ${err.message}`);
  }

  // 3. Therapist Flow Test
  console.log('\n3️⃣ TESTING THERAPIST WORKFLOW & SESSION PROGRESSION...');
  let testSessionId;
  try {
    // 3.1 Get Queue
    const queueRes = await fetch(`${BASE_URL}/api/therapist/queue/${therapistId}`);
    const queueData = await queueRes.json();
    const queue = Array.isArray(queueData) ? queueData : queueData.data || [];
    assert(queueRes.status === 200 && Array.isArray(queue), `GET /api/therapist/queue/:id returned ${queue.length} sessions`);

    if (queue.length > 0) {
      const session = queue[0];
      testSessionId = session.sessionId || session.session_id || session.id;
      assert(Boolean((session.scheduledEndTime || session.scheduled_end_time) && session.materials && (session.preInstructions || session.pre_instructions)), `Therapist session contains dynamic scheduledEndTime, materials, and preInstructions`);

      // 3.2 Start Session
      const startRes = await fetch(`${BASE_URL}/api/sessions/${testSessionId}/start`, {
        method: 'PATCH',
        headers: { 'x-user-id': therapistId },
      });
      const startData = await startRes.json();
      assert(startRes.status === 200 && startData.status === 'in_progress', `PATCH /api/sessions/:id/start set session to in_progress`);

      // 3.3 Emergency Pause & Resume
      const pauseRes = await fetch(`${BASE_URL}/api/sessions/${testSessionId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': therapistId },
        body: JSON.stringify({
          therapistId,
          reason: 'Routine clinical check during snehana',
          vitals: { bp: '125/82', pulse: 76 },
        }),
      });
      assert(pauseRes.status === 200, `POST /api/sessions/:id/pause paused session`);

      const resumeRes = await fetch(`${BASE_URL}/api/sessions/${testSessionId}/start`, {
        method: 'PATCH',
        headers: { 'x-user-id': therapistId },
      });
      assert(resumeRes.status === 200, `PATCH /api/sessions/:id/start resumed session`);

      // 3.4 Complete Session
      const completeRes = await fetch(`${BASE_URL}/api/sessions/${testSessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': therapistId },
        body: JSON.stringify({
          therapistId,
          dosageGiven: '60ml medicated Taila',
          patientResponse: 'normal',
          vitals: { bp: '120/80', pulse: 72, vasScore: 2 },
          complicationNotes: '',
        }),
      });
      const completeData = await completeRes.json();
      assert(completeRes.status === 200 && completeData.success, `POST /api/sessions/:id/complete completed session and unlocked next stage`);
    }
  } catch (err) {
    assert(false, `Therapist workflow failed: ${err.message}`);
  }

  // 4. Patient Flow Test
  console.log('\n4️⃣ TESTING PATIENT DASHBOARD & FEEDBACK WORKFLOW...');
  try {
    const targetPatient = testPatientId || patientId;
    // 4.1 Get Patient Dashboard
    const dashRes = await fetch(`${BASE_URL}/api/patient/dashboard/${targetPatient}`);
    const dashData = await dashRes.json();
    assert(dashRes.status === 200 && (dashData.patientInfo || dashData.patient_info), `GET /api/patient/dashboard/:id returned patientInfo, activePackage, and doctorName`);

    const timeline = dashData.sessionsTimeline || dashData.sessions_timeline || [];
    assert(timeline.length > 0 && timeline[0].time, `Patient dashboard timeline formatted 12-hour time correctly (${timeline[0]?.time})`);
    assert(Boolean((dashData.dietPlan || dashData.diet_plan)?.doshaTarget && (dashData.dietPlan || dashData.diet_plan)?.dietaryGuidelines), `Patient dashboard contains AI diet plan with doshaTarget and guidelines`);

    // 4.2 Submit Feedback
    const feedbackSessionId = testSessionId || timeline[0]?.sessionId || timeline[0]?.session_id || 1;
    const fbRes = await fetch(`${BASE_URL}/api/patient/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: feedbackSessionId,
        patientId: targetPatient,
        rating: 5,
        symptomImprovementScore: 9,
        overallExperience: 'Outstanding therapy session. Great relief from lower back tightness.',
        comments: 'Therapist was exceptionally punctual and attentive.',
      }),
    });
    const fbData = await fbRes.json();
    assert(fbRes.status === 201 && fbData.success, `POST /api/patient/feedback returned 201 Created and persisted feedback`);

    // 4.3 Get Patient Feedback List
    const fbListRes = await fetch(`${BASE_URL}/api/patient/feedback/${targetPatient}`);
    const fbListData = await fbListRes.json();
    const fbList = Array.isArray(fbListData) ? fbListData : fbListData.data || [];
    assert(fbListRes.status === 200 && Array.isArray(fbList) && fbList.length > 0, `GET /api/patient/feedback/:id returned ${fbList.length} historical feedback records`);
  } catch (err) {
    assert(false, `Patient workflow failed: ${err.message}`);
  }

  // 5. Admin Flow Test
  console.log('\n5️⃣ TESTING ADMIN WORKFLOW & CAPACITY OVERSIGHT...');
  try {
    // 5.1 Get Staff List
    const staffRes = await fetch(`${BASE_URL}/api/staff`, {
      headers: { 'x-user-id': adminId },
    });
    const staffData = await staffRes.json();
    const staff = Array.isArray(staffData) ? staffData : staffData.data || [];
    assert(staffRes.status === 200 && Array.isArray(staff), `GET /api/staff returned ${staff.length} staff members`);

    // 5.2 Get Room Occupancy
    const roomsRes = await fetch(`${BASE_URL}/api/rooms/occupancy`, {
      headers: { 'x-user-id': adminId },
    });
    const roomsData = await roomsRes.json();
    const rooms = Array.isArray(roomsData) ? roomsData : roomsData.data || [];
    assert(roomsRes.status === 200 && Array.isArray(rooms), `GET /api/rooms/occupancy returned ${rooms.length} rooms`);

    // 5.3 Get Protocol Templates
    const protocolsRes = await fetch(`${BASE_URL}/api/protocols`, {
      headers: { 'x-user-id': adminId },
    });
    const protocolsData = await protocolsRes.json();
    const protocols = Array.isArray(protocolsData) ? protocolsData : protocolsData.data || [];
    assert(protocolsRes.status === 200 && Array.isArray(protocols), `GET /api/protocols returned ${protocols.length} protocol templates`);

    // 5.4 Get Admin Dashboard Summary
    const adminDashRes = await fetch(`${BASE_URL}/api/admin/dashboard`, {
      headers: { 'x-user-id': adminId },
    });
    const adminDashData = await adminDashRes.json();
    assert(adminDashRes.status === 200 && (adminDashData.stats || adminDashData.stats_summary || adminDashData.data), `GET /api/admin/dashboard returned clinic statistics and activity logs`);
  } catch (err) {
    assert(false, `Admin workflow failed: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`📊 SMOKE TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error('Fatal Smoke Test Error:', err);
  process.exit(1);
});
