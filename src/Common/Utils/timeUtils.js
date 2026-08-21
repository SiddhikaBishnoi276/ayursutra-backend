/**
 * Time and Range Calculation Utilities
 */

/**
 * Converts a time string (e.g. "09:30:00", "09:30", "9:30") to minutes since midnight.
 * @param {string} timeStr 
 * @returns {number} minutes (0 to 1439)
 */
function timeStringToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    throw new Error(`Invalid time string: ${timeStr}`);
  }
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid time format (expected HH:MM or HH:MM:SS): ${timeStr}`);
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parts[2] ? parseInt(parts[2], 10) : 0;

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
    throw new Error(`Non-numeric time values in: ${timeStr}`);
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    throw new Error(`Time values out of range in: ${timeStr}`);
  }
  return hours * 60 + minutes;
}

/**
 * Converts minutes since midnight to standard "HH:MM:SS" format.
 * @param {number} totalMinutes 
 * @param {boolean} includeSeconds 
 * @returns {string} e.g. "10:30:00"
 */
function minutesToTimeString(totalMinutes, includeSeconds = true) {
  if (typeof totalMinutes !== 'number' || isNaN(totalMinutes)) {
    throw new Error(`Invalid minutes value: ${totalMinutes}`);
  }
  const normalized = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  return includeSeconds ? `${hStr}:${mStr}:00` : `${hStr}:${mStr}`;
}

/**
 * Normalizes a time string to standard "HH:MM:SS" format.
 * @param {string} timeStr 
 * @returns {string} e.g. "09:00:00"
 */
function normalizeTimeString(timeStr) {
  const mins = timeStringToMinutes(timeStr);
  return minutesToTimeString(mins, true);
}

/**
 * Adds minutes to a time string and returns the resulting "HH:MM:SS" string.
 * @param {string} timeStr 
 * @param {number} durationMinutes 
 * @returns {string} e.g. "10:00:00" + 30 => "10:30:00"
 */
function addMinutesToTime(timeStr, durationMinutes) {
  const startMins = timeStringToMinutes(timeStr);
  const endMins = startMins + durationMinutes;
  return minutesToTimeString(endMins, true);
}

/**
 * Checks if two time ranges overlap using the standard formula:
 * (startA < endB) AND (endA > startB)
 * Back-to-back/adjacent ranges (e.g. 10:00-11:30 and 11:30-12:00) return FALSE (no overlap).
 * @param {string} startA 
 * @param {string} endA 
 * @param {string} startB 
 * @param {string} endB 
 * @returns {boolean}
 */
function isTimeRangeOverlapping(startA, endA, startB, endB) {
  const aStart = timeStringToMinutes(startA);
  const aEnd = timeStringToMinutes(endA);
  const bStart = timeStringToMinutes(startB);
  const bEnd = timeStringToMinutes(endB);

  return aStart < bEnd && aEnd > bStart;
}

/**
 * Checks if range [checkStart, checkEnd] is entirely within [parentStart, parentEnd].
 * @param {string} checkStart 
 * @param {string} checkEnd 
 * @param {string} parentStart 
 * @param {string} parentEnd 
 * @returns {boolean}
 */
function isTimeRangeWithin(checkStart, checkEnd, parentStart, parentEnd) {
  const cStart = timeStringToMinutes(checkStart);
  const cEnd = timeStringToMinutes(checkEnd);
  const pStart = timeStringToMinutes(parentStart);
  const pEnd = timeStringToMinutes(parentEnd);

  return cStart >= pStart && cEnd <= pEnd;
}

/**
 * Extracts day of week (0=Sunday to 6=Saturday) from a Date object or "YYYY-MM-DD" string.
 * Uses local calendar date components to avoid timezone shift issues.
 * @param {Date|string} dateInput 
 * @returns {number} 0 (Sun) to 6 (Sat)
 */
function getDayOfWeek(dateInput) {
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day).getDay();
    }
  }
  const d = new Date(dateInput);
  return d.getDay();
}

module.exports = {
  timeStringToMinutes,
  minutesToTimeString,
  normalizeTimeString,
  addMinutesToTime,
  isTimeRangeOverlapping,
  isTimeRangeWithin,
  getDayOfWeek,
};
