// Test script for verifying Patient Email Credentials Notification
// Run with: node scripts/testPatientEmail.js

const http = require('http');
const assert = require('assert');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { generatePatientCredentialsHtml } = require('../src/Common/Services/emailService');

async function runEmailTests() {
  console.log('🧪 Starting Patient Email Notification Verification Suite...\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE_URL = `http://127.0.0.1:${port}`;

  async function req(method, path, body, headers = {}) {
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
    // 1. Verify HTML Email Template Generation
    console.log('--- Step 1: Verify Ayurvedic-Themed HTML Template Generation ---');
    const mockEmailPayload = {
      patientName: 'Aarav Patel',
      email: 'aarav.patel@example.com',
      phone: '9876543210',
      tempPassword: 'AYUR_PASS_99',
      patientId: 'a1b2c3d4-e5f6-7890',
      clinicName: 'AyurSutra Wellness Center',
    };
    const htmlOutput = generatePatientCredentialsHtml(mockEmailPayload);
    assert.ok(htmlOutput.includes('Aarav Patel'), 'HTML template must contain patient name');
    assert.ok(htmlOutput.includes('AYUR_PASS_99'), 'HTML template must contain temporary password');
    assert.ok(htmlOutput.includes('9876543210'), 'HTML template must contain login identifier');
    assert.ok(htmlOutput.includes('AyurSutra'), 'HTML template must contain branding');
    assert.ok(htmlOutput.includes('Security Advisory'), 'HTML template must contain security note');
    console.log('✅ HTML Email Template generated cleanly with responsive Ayurvedic styling.\n');

    // 2. Doctor Login to acquire auth header
    console.log('--- Step 2: Doctor Login ---');
    const loginRes = await req('POST', '/api/auth/mock-login', { role: 'doctor' });
    assert.strictEqual(loginRes.status, 200, 'Doctor login must succeed');
    const doctorId = loginRes.data.user_id;
    const authHeaders = { 'x-user-id': doctorId };
    console.log(`✅ Doctor authenticated: ${loginRes.data.name} (ID: ${doctorId})\n`);

    // 3. Register Patient WITH Email Address
    console.log('--- Step 3: Register Patient with Email & Verify Email Notification Dispatch ---');
    const randomPhone = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const testEmail = `aarav.${Date.now()}@example.com`;
    const patientPayloadWithEmail = {
      name: 'Aarav Patel ' + Date.now().toString().slice(-4),
      age: 38,
      gender: 'Male',
      contact: randomPhone,
      email: testEmail,
      chiefComplaint: 'Vata vyadhi with chronic joint stiffness',
      diagnosis: 'Sandhigata Vata',
    };

    const registerRes = await req('POST', '/api/doctor/patients', patientPayloadWithEmail, authHeaders);
    assert.strictEqual(registerRes.status, 201, 'Patient registration must return 201');
    assert.ok(registerRes.data.patient?.id || registerRes.data.id, 'Response must contain created patient ID');
    const createdPatient = registerRes.data.patient || registerRes.data;
    assert.strictEqual(createdPatient.email, testEmail, 'Patient email must match registered email');
    assert.strictEqual(registerRes.data.email_notification?.sent, true, 'Email notification sent flag must be true');
    assert.strictEqual(registerRes.data.email_notification?.to, testEmail, 'Email notification recipient must match');
    console.log(`✅ Patient registered with Email: ${createdPatient.name}`);
    console.log(`   Simulated SMS: ${registerRes.data.simulated_sms.message}`);
    console.log(`   Email Notification: ${registerRes.data.email_notification.message}\n`);

    // 4. Register Patient WITHOUT Email (Verify Graceful Fallback)
    console.log('--- Step 4: Register Patient without Email & Verify Graceful Fallback ---');
    const randomPhone2 = '9' + Math.floor(100000000 + Math.random() * 900000000);
    const patientPayloadNoEmail = {
      name: 'Meera Deshmukh ' + Date.now().toString().slice(-4),
      age: 29,
      gender: 'Female',
      contact: randomPhone2,
      chiefComplaint: 'Digestive sluggishness and fatigue',
    };

    const registerNoEmailRes = await req('POST', '/api/doctor/patients', patientPayloadNoEmail, authHeaders);
    assert.strictEqual(registerNoEmailRes.status, 201, 'Patient registration without email must succeed');
    assert.strictEqual(registerNoEmailRes.data.email_notification?.sent, false, 'Email sent flag must be false when no email');
    console.log(`✅ Patient registered without email: ${registerNoEmailRes.data.patient?.name || registerNoEmailRes.data.name}`);
    console.log(`   Email Status: ${registerNoEmailRes.data.email_notification.reason}\n`);

    // 5. Verify Credential Delivery Log in Database
    console.log('--- Step 5: Verify Credential Delivery Database Logs ---');
    const patientUserId = registerRes.data.patient?.id || registerRes.data.id;
    const logsRes = await pool.query(
      `SELECT channel, status, attempted_at FROM credential_delivery_log WHERE user_id = $1`,
      [patientUserId]
    );
    const channels = logsRes.rows.map((r) => r.channel);
    assert.ok(channels.includes('sms'), 'Must log SMS credential channel');
    assert.ok(channels.includes('email'), 'Must log Email credential channel');
    console.log(`✅ Database Credential Logs verified for channels: [${channels.join(', ')}]\n`);

    console.log('🎉 ALL PATIENT EMAIL CREDENTIAL VERIFICATION TESTS PASSED 100% PERFECTLY!\n');
  } catch (err) {
    console.error('❌ Test Failed:', err);
    process.exit(1);
  } finally {
    server.close();
    await pool.end();
  }
}

runEmailTests();
