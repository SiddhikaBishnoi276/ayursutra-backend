/**
 * Utility helpers for parameter parsing, validation, and payload normalization.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Safely parse an integer ID (e.g. session_id, stage_id, room_id).
 * Handles raw integers, numeric strings, and prefixed strings like "SES-105" or "APT-505".
 * Returns null if invalid.
 */
function parseIntegerId(val) {
  if (val === null || val === undefined || val === '') {
    return null;
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) && val > 0 ? val : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.length === 0) return null;
    // Strip prefixes like "SES-", "APT-", "STAGE-", etc.
    const cleaned = trimmed.replace(/^[A-Za-z]+[-_]*/, '');
    if (!/^\d+$/.test(cleaned)) {
      return null;
    }
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Validate UUID format (e.g. user_id, therapist_id, patient_id).
 */
function isValidUUID(val) {
  if (typeof val !== 'string') return false;
  return UUID_REGEX.test(val.trim());
}

/**
 * Get value from object checking multiple alternate keys (e.g. camelCase and snake_case).
 */
function getNormalizedParam(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
}

/**
 * Format 24-hour SQL time string "10:00:00" to "10:00 AM" / "02:30 PM".
 */
function formatTime12Hour(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return timeStr || '10:00 AM';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours < 10 ? `0${hours}` : `${hours}`;
  return `${strHours}:${minutes} ${ampm}`;
}

module.exports = {
  UUID_REGEX,
  parseIntegerId,
  isValidUUID,
  getNormalizedParam,
  formatTime12Hour,
};
