/**
 * Utility helpers for parameter parsing, validation, and payload normalization.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FLEXIBLE_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Safely parse an integer ID (e.g. session_id, stage_id, room_id).
 * Returns null if invalid.
 */
function parseIntegerId(val) {
  if (val === null || val === undefined || val === '') {
    return null;
  }
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || String(parsed) !== String(val).trim()) {
    return null;
  }
  return parsed;
}

/**
 * Validate UUID format (e.g. user_id, therapist_id, patient_id).
 */
function isValidUUID(val) {
  if (typeof val !== 'string') return false;
  return FLEXIBLE_UUID_REGEX.test(val.trim());
}

/**
 * Get value from object checking multiple alternate keys (e.g. camelCase and snake_case).
 */
function getNormalizedParam(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined) {
      return obj[key];
    }
  }
  return undefined;
}

module.exports = {
  UUID_REGEX: FLEXIBLE_UUID_REGEX,
  parseIntegerId,
  isValidUUID,
  getNormalizedParam,
};
