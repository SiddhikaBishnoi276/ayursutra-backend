const NOTIFICATION_TYPES = {
  // Instant Events
  SESSION_BOOKED: 'session_booked',
  SESSION_RESCHEDULED: 'session_rescheduled',
  SESSION_CANCELLED: 'session_cancelled',
  COMPLICATION_REPORTED: 'complication_reported',
  EMERGENCY_SESSION_PAUSE: 'emergency_session_pause',
  STAGE_PROGRESSION_UNLOCKED: 'stage_progression_unlocked',
  SCHEDULING_CONFLICT_DETECTED: 'scheduling_conflict_detected',
  PRAKRITI_RECLASSIFICATION_IMPACT: 'prakriti_reclassification_impact',
  DUPLICATE_PACKAGE_WARNING: 'duplicate_package_warning',
  ACCOUNT_CREDENTIALS_GENERATED: 'account_credentials_generated',
  NEW_SESSION_ASSIGNED: 'new_session_assigned',
  SHIFT_HANDOVER_RECEIVED: 'shift_handover_received',
  PLAN_UPDATED_MID_SESSION: 'plan_updated_mid_session',
  DELIVERY_FAILED: 'delivery_failed',
  ROOM_MAINTENANCE_CONFLICT: 'room_maintenance_conflict',
  INVENTORY_THRESHOLD_BREACH: 'inventory_threshold_breach',
  DOCTOR_CREATED_PACKAGE_LOGGED: 'doctor_created_package_logged',

  // Scheduled / Time-delayed Events
  REMINDER_24H: 'reminder_24h',
  REMINDER_2H: 'reminder_2h',
  REMINDER_10M: 'reminder_10m',
  FEEDBACK_REQUEST: 'feedback_request',
  NO_SHOW: 'no_show',
  PLAN_PAUSED: 'plan_paused',
};

module.exports = {
  NOTIFICATION_TYPES,
};
