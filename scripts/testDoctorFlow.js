// End-to-end smoke test for the Doctor Module flow.
// Run with: node scripts/testDoctorFlow.js

const http = require('http');
const app = require('../src/app');
const { pool } = require('../src/config/db');

let passed = 0;
let failed = 0;

function logStep(title) {
  console.log(`\n=== ${title} ===`);
}

function logPass(msg) {
  passed++;
  console.log(`✅ PASS: ${msg}`);
}

function logFail(msg, detail) {
  failed++;
  console.log(`❌ FAIL: ${msg}`);
  if (detail) console.log('   Detail:', detail);
}

async function main() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE_URL = `http://127.0.0.1:${port}`;

  console.log('Starting Doctor Module end-to-end flow test against', BASE_URL);

  async function request(method, path, body, headers = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
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
    logStep('Step 1: Doctor mock-login');
    const login = await request('POST', '/api/auth/mock-login', { role: 'doctor' });
    if (login.status === 200 && login.data.user_id) {
      logPass(`Doctor logged in — ${login.data.name} (${login.data.user_id})`);
    } else {
      logFail('Doctor login failed', login.data);
      return printSummary();
    }
    const doctorId = login.data.user_id;
    const authHeader = { 'x-user-id': doctorId };

    logStep('Step 2: Add New Patient');
    const patientPayload = {
      name: 'Test Patient ' + Date.now(),
      email: 'test.patient.' + Date.now() + '@example.com',
      age: 31,
      gender: 'Female',
      contact_number: '90000' + Math.floor(10000 + Math.random() * 89999),
      chief_complaint: 'Automated test — chronic fatigue',
    };

    const addPatient = await request('POST', '/api/doctor/patients', patientPayload, authHeader);
    if (addPatient.status === 201 && (addPatient.data.patient?.user_id || addPatient.data.id)) {
      const p = addPatient.data.patient || addPatient.data;
      logPass(`Patient created — ${p.name} (${p.user_id || p.id})`);
      if (addPatient.data.simulated_sms) {
        console.log('   Simulated SMS:', addPatient.data.simulated_sms.message);
      }
    } else {
      logFail('Add patient failed', addPatient.data);
      return printSummary();
    }
    const patientId = addPatient.data.patient?.user_id || addPatient.data.id;

    logStep('Step 3: Fetch Prakriti Questions');
    const questions = await request('GET', '/api/doctor/prakriti/questions', null, authHeader);
    if (questions.status === 200 && Array.isArray(questions.data) && questions.data.length > 0) {
      logPass(`${questions.data.length} questions fetched`);
    } else {
      logFail('Fetching Prakriti questions failed', questions.data);
      return printSummary();
    }

    logStep('Step 4: Submit & Lock Prakriti Assessment');
    const answers = questions.data
      .filter((q) => q.options && q.options.length > 0)
      .map((q) => ({ question_id: q.id, option_id: q.options[0].id }));
    const assessment = await request(
      'POST',
      `/api/doctor/prakriti/patients/${patientId}/assessment`,
      { answers, clinical_observation: 'Automated test observation' },
      authHeader
    );
    if (assessment.status === 201 && assessment.data.assessment?.confirmed_dosha) {
      logPass(`Prakriti locked — confirmed_dosha: ${assessment.data.assessment.confirmed_dosha}`);
    } else {
      logFail('Prakriti assessment failed', assessment.data);
      return printSummary();
    }

    logStep('Step 5: List Therapy Packages');
    const packages = await request('GET', '/api/doctor/therapy-packages', null, authHeader);
    if (packages.status === 200 && Array.isArray(packages.data) && packages.data.length > 0) {
      logPass(`${packages.data.length} package(s) found — using "${packages.data[0].name}"`);
    } else {
      logFail('Fetching therapy packages failed', packages.data);
      return printSummary();
    }
    const packageId = packages.data[0].id;

    logStep('Step 6: Generate Smart Schedule');
    const plan = await request(
      'POST',
      `/api/doctor/patients/${patientId}/therapy-plan`,
      { package_id: packageId },
      authHeader
    );
    if (plan.status === 201 && plan.data.schedule) {
      const totalSessions = plan.data.schedule.reduce((sum, stage) => sum + stage.sessions.length, 0);
      logPass(`Schedule generated — ${plan.data.schedule.length} stages, ${totalSessions} sessions, therapist: ${plan.data.therapist_assigned}`);
      if (plan.data.simulated_sms) {
        console.log('   Simulated SMS:', plan.data.simulated_sms.message);
      }
      plan.data.schedule.forEach((stage) => {
        console.log(`   - ${stage.stage_type} (${stage.status}): ${stage.sessions.length} session(s)`);
      });
    } else {
      logFail('Generate schedule failed', plan.data);
      return printSummary();
    }

    logStep('Step 7: Security check — Patient tries a Doctor-only route');
    const forbidden = await request('POST', '/api/doctor/patients', patientPayload, { 'x-user-id': patientId });
    if (forbidden.status === 403) {
      logPass('Patient correctly blocked from doctor-only route (403)');
    } else {
      logFail('Expected 403 for patient hitting doctor-only route, got:', `${forbidden.status} ${JSON.stringify(forbidden.data)}`);
    }

    printSummary();
  } finally {
    server.close();
    await pool.end();
  }
}

function printSummary() {
  console.log('\n================ SUMMARY ================');
  console.log(`Passed: ${passed}  |  Failed: ${failed}`);
  console.log(failed === 0 ? '🎉 All doctor-flow checks passed!' : '⚠️ Some checks failed — see above.');
  console.log('===========================================\n');
}

main().catch((err) => {
  console.error('Unexpected error running test script:', err);
  process.exit(1);
});
