/**
 * Unit Test Suite for Scheduling Time Utilities & Conflict Formulas
 */

const {
  timeStringToMinutes,
  minutesToTimeString,
  normalizeTimeString,
  addMinutesToTime,
  isTimeRangeOverlapping,
  isTimeRangeWithin,
  getDayOfWeek,
} = require('../src/Common/Utils/timeUtils');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function runUnitTests() {
  console.log('\n========================================');
  console.log('🧪 RUNNING SCHEDULING UNIT TESTS');
  console.log('========================================\n');

  console.log('1. Time Parsing & String Formats:');
  assert(timeStringToMinutes('00:00:00') === 0, '00:00:00 is 0 minutes');
  assert(timeStringToMinutes('10:30:00') === 630, '10:30:00 is 630 minutes');
  assert(timeStringToMinutes('18:00:00') === 1080, '18:00:00 is 1080 minutes');
  assert(timeStringToMinutes('23:59:00') === 1439, '23:59:00 is 1439 minutes');
  assert(timeStringToMinutes('9:15') === 555, '9:15 parses to 555 minutes');
  assert(minutesToTimeString(630) === '10:30:00', '630 minutes converts to 10:30:00');
  assert(normalizeTimeString('9:00') === '09:00:00', '9:00 normalizes to 09:00:00');

  console.log('\n2. Duration Calculations:');
  assert(addMinutesToTime('10:00:00', 30) === '10:30:00', '10:00 + 30 min = 10:30:00 (Case 8 duration check)');
  assert(addMinutesToTime('10:00:00', 90) === '11:30:00', '10:00 + 90 min = 11:30:00 (Case 9 duration check)');
  assert(addMinutesToTime('17:45:00', 45) === '18:30:00', '17:45 + 45 min = 18:30:00');

  console.log('\n3. Overlap Logic ((startA < endB) && (endA > startB)):');
  // Case 1: Mid-overlap (10:00 - 11:30 vs 10:30 - 11:15)
  assert(
    isTimeRangeOverlapping('10:00:00', '11:30:00', '10:30:00', '11:15:00') === true,
    'Case 1: (10:00-11:30) vs (10:30-11:15) MUST OVERLAP (Conflict)'
  );

  // Case 2: Adjacent / Back-to-Back (10:00 - 11:30 vs 11:30 - 12:00)
  assert(
    isTimeRangeOverlapping('10:00:00', '11:30:00', '11:30:00', '12:00:00') === false,
    'Case 2: (10:00-11:30) vs (11:30-12:00) MUST NOT OVERLAP (Adjacent allowed)'
  );

  // Case 3: Start overlap (10:00 - 11:00 vs 09:30 - 10:30)
  assert(
    isTimeRangeOverlapping('10:00:00', '11:00:00', '09:30:00', '10:30:00') === true,
    'Case 3: (10:00-11:00) vs (09:30-10:30) MUST OVERLAP (Conflict)'
  );

  // End overlap (10:00 - 11:00 vs 10:45 - 11:45)
  assert(
    isTimeRangeOverlapping('10:00:00', '11:00:00', '10:45:00', '11:45:00') === true,
    'End overlap: (10:00-11:00) vs (10:45-11:45) MUST OVERLAP'
  );

  // Complete containment (10:00 - 12:00 vs 09:00 - 13:00)
  assert(
    isTimeRangeOverlapping('10:00:00', '12:00:00', '09:00:00', '13:00:00') === true,
    'Containment: (10:00-12:00) vs (09:00-13:00) MUST OVERLAP'
  );

  console.log('\n4. Working Hours Boundary Checks (isTimeRangeWithin):');
  assert(
    isTimeRangeWithin('10:00:00', '11:00:00', '09:00:00', '18:00:00') === true,
    '10:00-11:00 is within 09:00-18:00'
  );
  assert(
    isTimeRangeWithin('09:00:00', '18:00:00', '09:00:00', '18:00:00') === true,
    'Exact boundary 09:00-18:00 is within 09:00-18:00'
  );
  assert(
    isTimeRangeWithin('18:00:00', '19:00:00', '09:00:00', '18:00:00') === false,
    'Case 7: 18:00-19:00 is outside shift 09:00-18:00'
  );
  assert(
    isTimeRangeWithin('08:30:00', '09:30:00', '09:00:00', '18:00:00') === false,
    'Early start 08:30-09:30 is outside shift 09:00-18:00'
  );

  console.log('\n5. Day of Week Resolution:');
  // 2026-08-23 is Sunday (0), 2026-08-24 is Monday (1), 2026-08-26 is Wednesday (3)
  assert(getDayOfWeek('2026-08-23') === 0, '2026-08-23 resolves to Sunday (0)');
  assert(getDayOfWeek('2026-08-24') === 1, '2026-08-24 resolves to Monday (1)');
  assert(getDayOfWeek('2026-08-26') === 3, '2026-08-26 resolves to Wednesday (3)');
  assert(getDayOfWeek('2026-08-29') === 6, '2026-08-29 resolves to Saturday (6)');

  console.log('\n----------------------------------------');
  console.log(`Unit Tests Summary: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------\n');

  if (failed > 0) {
    throw new Error(`${failed} unit test(s) failed`);
  }
}

if (require.main === module) {
  try {
    runUnitTests();
  } catch (err) {
    process.exit(1);
  }
}

module.exports = { runUnitTests };
