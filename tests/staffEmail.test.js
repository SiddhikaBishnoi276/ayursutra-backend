const assert = require('assert');
const bcrypt = require('bcryptjs');
const emailService = require('../src/Common/utils/emailService');
const staffController = require('../src/Admin/Controllers/staffController');
const {
  sendStaffCredentialsEmail,
  generateStaffCredentialsHtml,
  getTransporter,
} = emailService;

async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING STAFF WELCOME EMAIL & CREDENTIALS UNIT/INTEGRATION TESTS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function test(description, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(description, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Template Generation Tests
  console.log('1. Staff Email Template Generation:');

  test('Generates Doctor welcome email HTML with default password', () => {
    const html = generateStaffCredentialsHtml({
      name: 'Dr. Ananya Sharma',
      role: 'doctor',
      toEmail: 'dr.ananya@ayursutra.com',
      phone: '+91-9876543210',
      password: 'password@123',
    });

    assert(typeof html === 'string', 'HTML must be a string');
    assert(html.includes('Dr. Ananya Sharma'), 'HTML must include staff name');
    assert(html.includes('Doctor'), 'HTML must include capitalized role');
    assert(html.includes('dr.ananya@ayursutra.com'), 'HTML must include recipient email');
    assert(html.includes('+91-9876543210'), 'HTML must include phone number');
    assert(html.includes('password@123'), 'HTML must include default credentials');
    assert(html.includes('AyurSutra'), 'HTML must include branding');
  });

  test('Generates Therapist welcome email HTML with custom password', () => {
    const html = generateStaffCredentialsHtml({
      name: 'Ravi Kumar',
      role: 'therapist',
      toEmail: 'ravi.therapist@ayursutra.com',
      phone: '+91-9876543211',
      password: 'CustomPassword@2026',
    });

    assert(html.includes('Ravi Kumar'), 'HTML must include therapist name');
    assert(html.includes('Therapist'), 'HTML must include Therapist role');
    assert(html.includes('CustomPassword@2026'), 'HTML must include custom password');
  });

  test('Defaults password to password@123 when password parameter is undefined or empty', () => {
    const html = generateStaffCredentialsHtml({
      name: 'Vaidya Mohan',
      role: 'doctor',
      toEmail: 'mohan@ayursutra.com',
      phone: '+91-9876543212',
    });

    assert(html.includes('password@123'), 'HTML must default to password@123');
  });

  // 2. Email Service Dispatch Tests
  console.log('\n2. Email Service Dispatch & Error Handling:');

  await asyncTest('Skips email sending and returns NO_EMAIL when toEmail is missing', async () => {
    const result = await sendStaffCredentialsEmail({
      name: 'No Email User',
      role: 'doctor',
      toEmail: '',
      phone: '+91-9000000000',
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'NO_EMAIL');
  });

  await asyncTest('Simulates email dispatch when SMTP is not configured or in dev mode', async () => {
    const result = await sendStaffCredentialsEmail({
      name: 'Dr. Test Simulated',
      role: 'doctor',
      toEmail: 'doctor.test@ayursutra.com',
      phone: '+91-9876500001',
      password: 'password@123',
    });

    assert.strictEqual(result.success, true);
    if (result.simulated) {
      assert.strictEqual(result.preview.to, 'doctor.test@ayursutra.com');
      assert.strictEqual(result.preview.role, 'Doctor');
      assert.strictEqual(result.preview.password, 'password@123');
    } else {
      assert(result.messageId, 'Live SMTP must return messageId');
    }
  });

  // 3. Controller Simulation & Non-Blocking Async Behavior
  console.log('\n3. Controller Non-Blocking Behavior Simulation:');

  await asyncTest('Asynchronously triggers email without throwing unhandled rejection on failure', async () => {
    let emailTriggered = false;
    let emailCompleted = false;

    // Simulate controller flow
    const fakeStaff = {
      id: 'uuid-12345',
      name: 'Dr. Async Test',
      email: 'async.doc@ayursutra.com',
      role: 'doctor',
      phone: '+91-9988776655',
    };

    const defaultStaffPassword = 'password@123';

    // Fire non-blocking email trigger exactly like staffController
    const emailPromise = sendStaffCredentialsEmail({
      toEmail: fakeStaff.email,
      name: fakeStaff.name,
      role: fakeStaff.role,
      phone: fakeStaff.phone,
      password: defaultStaffPassword,
    }).then((res) => {
      emailCompleted = true;
      return res;
    }).catch((err) => {
      // should never throw unhandled
      console.error(err);
    });

    emailTriggered = true;
    assert.strictEqual(emailTriggered, true, 'Email trigger must be invoked');

    // Wait for the async task to complete
    await emailPromise;
    assert.strictEqual(emailCompleted, true, 'Email dispatch promise should complete');
  });

  // 4. Default Password and Bcrypt Verification
  console.log('\n4. Default Credentials & Bcrypt Compatibility:');

  await asyncTest('Default password password@123 correctly hashes and verifies with bcrypt', async () => {
    const defaultPassword = 'password@123';
    const hash = await bcrypt.hash(defaultPassword, 10);
    const isMatch = await bcrypt.compare('password@123', hash);
    const isWrongMatch = await bcrypt.compare('wrongpassword', hash);

    assert.strictEqual(isMatch, true, 'bcrypt must verify password@123 against its hash');
    assert.strictEqual(isWrongMatch, false, 'bcrypt must reject wrong password');
  });

  // 5. Validation Logic in Controller
  console.log('\n5. Controller Validation without Password in Request Body:');

  await asyncTest('Controller validation does not fail when password is omitted from req.body', async () => {
    let statusCode = null;
    let responseBody = null;

    const req = {
      body: {
        // Missing name, phone, etc. -> will return 400 for those, but NOT for password
        role: 'doctor',
        clinic_id: 1,
      },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    await staffController.createStaff(req, res);

    assert.strictEqual(statusCode, 400);
    assert(responseBody.message.includes('name'), 'Must complain about missing name');
    assert(responseBody.message.includes('phone'), 'Must complain about missing phone');
    assert(!responseBody.message.includes('password'), 'Must NOT complain about missing password (as it defaults to password@123)');
  });

  console.log('\n---------------------------------------------------------------');
  console.log(`Staff Email Unit Tests Summary: ${passed} Passed, ${failed} Failed`);
  console.log('---------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
