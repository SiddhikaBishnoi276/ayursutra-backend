// tests/unifiedTherapyPackage.test.js
const assert = require('assert');
const { pool } = require('../src/config/db');
const protocolService = require('../src/Admin/Services/protocolService');
const packageService = require('../src/Doctor/Services/packageService');

async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING UNIFIED THERAPY PACKAGE CREATION & STAGES TESTS');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function asyncTest(description, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${description}`);
      console.error(`     Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
      failed++;
    }
  }

  // Ensure clinic 1 exists
  let clinicId = 1;
  const clinicCheck = await pool.query('SELECT id FROM clinics LIMIT 1');
  if (clinicCheck.rows.length > 0) {
    clinicId = clinicCheck.rows[0].id;
  }

  const sampleUnifiedPayload = {
    clinic_id: clinicId,
    name: `7-Day Classical Virechana Protocol Test ${Date.now()}`,
    therapy_type: 'Virechana',
    description: 'Classical purification protocol for Pitta disorders',
    base_price: 12000,
    stages: [
      {
        stage_type: 'Poorvakarma',
        sequence_order: 1,
        duration_days: 3,
        session_duration_minutes: 60,
        pre_instructions: 'Light digestible meal (Peya) 2 hours prior.',
        post_instructions: 'Avoid cold drafts and direct AC exposure.',
        base_diet_framework: {
          allowed: ['Warm rice gruel', 'Ginger boiled water'],
          forbidden: ['Curd', 'Heavy oily food', 'Cold drinks'],
        },
      },
      {
        stage_type: 'Pradhanakarma',
        sequence_order: 2,
        duration_days: 1,
        session_duration_minutes: 90,
        pre_instructions: 'Strict morning fasting before medicine intake.',
        post_instructions: 'Rest completely, drink warm thin gruel only.',
        base_diet_framework: {
          allowed: ['Thin warm Peya'],
          forbidden: ['Solid food'],
        },
      },
      {
        stage_type: 'Paschatkarma',
        sequence_order: 3,
        duration_days: 3,
        session_duration_minutes: 45,
        pre_instructions: 'Light morning walk only.',
        post_instructions: 'Gradual Samsarjana Krama dietary re-entry.',
        base_diet_framework: {
          allowed: ['Mudga Yusha', 'Vilepi'],
          forbidden: ['Spicy spicy food'],
        },
      },
    ],
  };

  // 1. Admin Protocol Service Creation
  await asyncTest('Admin protocolService.createProtocol creates package with nested stages', async () => {
    const created = await protocolService.createProtocol(sampleUnifiedPayload);

    assert(created.id, 'Protocol must have an ID');
    assert.strictEqual(created.name, sampleUnifiedPayload.name);
    assert.strictEqual(created.therapy_type, 'Virechana');
    assert.strictEqual(created.description, sampleUnifiedPayload.description);
    assert.strictEqual(created.base_price, 12000);
    assert.strictEqual(created.stages.length, 3, 'Must create 3 stages');
    assert.strictEqual(created.total_duration_days, 7, 'Total duration must be 3 + 1 + 3 = 7 days');

    // Stage 1 validation
    const s1 = created.stages[0];
    assert.strictEqual(s1.stage_type, 'Poorvakarma');
    assert.strictEqual(s1.duration_days, 3);
    assert.strictEqual(s1.session_duration_minutes, 60);
    assert.strictEqual(s1.pre_instructions, 'Light digestible meal (Peya) 2 hours prior.');
    assert(s1.base_diet_framework, 'Must contain diet framework');

    // Clean up created record
    await pool.query('DELETE FROM therapy_packages WHERE id = $1', [created._raw_id || created.id]);
  });

  // 2. Doctor Package Service Creation
  await asyncTest('Doctor packageService.createPackage creates package with identical schema & nested stages', async () => {
    const doctorUser = { id: null, clinic_id: clinicId, role: 'doctor' };
    const doctorPayload = {
      ...sampleUnifiedPayload,
      name: `Doctor 7-Day Protocol ${Date.now()}`,
    };

    const created = await packageService.createPackage(doctorUser, doctorPayload);

    assert(created.id, 'Created package must have an ID');
    assert.strictEqual(created.name, doctorPayload.name);
    assert.strictEqual(created.therapy_type, 'Virechana');
    assert.strictEqual(created.description, doctorPayload.description);
    assert.strictEqual(created.base_price, 12000);
    assert.strictEqual(created.stages.length, 3, 'Must have 3 nested stages');
    assert.strictEqual(created.duration_days, 7, 'Must calculate 7 days');

    // Clean up
    await pool.query('DELETE FROM therapy_packages WHERE id = $1', [created._raw_id || created.id]);
  });

  // 3. Retrieval and Aggregated Stages
  await asyncTest('protocolService.getAllProtocols returns packages with parsed stages and base_price', async () => {
    const created = await protocolService.createProtocol(sampleUnifiedPayload);
    const all = await protocolService.getAllProtocols({ clinic_id: clinicId });

    assert(Array.isArray(all), 'Result must be an array');
    const found = all.find((p) => p._raw_id === (created._raw_id || created.id));
    assert(found, 'Created protocol must be in retrieved list');
    assert.strictEqual(found.base_price, 12000);
    assert.strictEqual(found.stages.length, 3);

    // Clean up
    await pool.query('DELETE FROM therapy_packages WHERE id = $1', [created._raw_id || created.id]);
  });

  // 4. Update Protocol with Replaced Nested Stages
  await asyncTest('protocolService.updateProtocol updates details and replaces stages atomically', async () => {
    const created = await protocolService.createProtocol(sampleUnifiedPayload);
    const updated = await protocolService.updateProtocol(created._raw_id || created.id, {
      name: 'Updated 10-Day Deep Protocol',
      base_price: 18000,
      stages: [
        {
          stage_type: 'Poorvakarma',
          sequence_order: 1,
          duration_days: 4,
          session_duration_minutes: 60,
          pre_instructions: 'Deep Snehana preparation.',
          post_instructions: 'Warm water hydration.',
        },
        {
          stage_type: 'Pradhanakarma',
          sequence_order: 2,
          duration_days: 2,
          session_duration_minutes: 120,
          pre_instructions: 'Medicine administration.',
          post_instructions: 'Bed rest.',
        },
        {
          stage_type: 'Paschatkarma',
          sequence_order: 3,
          duration_days: 4,
          session_duration_minutes: 45,
          pre_instructions: 'Samsarjana diet.',
          post_instructions: 'Normal routine recovery.',
        },
      ],
    });

    assert.strictEqual(updated.name, 'Updated 10-Day Deep Protocol');
    assert.strictEqual(updated.base_price, 18000);
    assert.strictEqual(updated.total_duration_days, 10);
    assert.strictEqual(updated.stages.length, 3);

    // Clean up
    await pool.query('DELETE FROM therapy_packages WHERE id = $1', [created._raw_id || created.id]);
  });

  console.log('\n===============================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  pool.end();
  process.exit(1);
});
