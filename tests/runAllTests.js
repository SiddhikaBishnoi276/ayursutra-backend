/**
 * Master Test Runner for AyurSutra Scheduling Test Suite
 */

const { runUnitTests } = require('./scheduling.unit.test');
const { runIntegrationTests } = require('./scheduling.integration.test');
const { pool } = require('../src/config/db');

async function main() {
  console.log('===============================================================');
  console.log('🚀 AYURSUTRA SCHEDULING & CONFLICT RESOLUTION TEST SUITE');
  console.log('===============================================================\n');

  try {
    // 1. Run Unit Tests
    runUnitTests();

    // 2. Run Database Integration Tests
    await runIntegrationTests();

    console.log('🎉 ALL UNIT AND INTEGRATION TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message || error);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch {}
  }
}

if (require.main === module) {
  main();
}

module.exports = main;
