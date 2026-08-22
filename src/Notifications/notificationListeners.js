const notificationEmitter = require('./eventEmitter');
const { NOTIFICATION_TYPES } = require('./constants');
const { dispatchNotification } = require('./notificationService');

function registerListeners() {
  // SESSION_BOOKED
  notificationEmitter.on(NOTIFICATION_TYPES.SESSION_BOOKED, async (data) => {
    await dispatchNotification({
      recipientId: data.patientId,
      type: NOTIFICATION_TYPES.SESSION_BOOKED,
      channel: data.channel || 'both',
      content: `Your session has been successfully booked for ${data.time}.`,
      relatedSessionId: data.sessionId,
      title: 'Session Booked',
      data: data
    });
  });

  // SESSION_RESCHEDULED
  notificationEmitter.on(NOTIFICATION_TYPES.SESSION_RESCHEDULED, async (data) => {
    await dispatchNotification({
      recipientId: data.patientId,
      type: NOTIFICATION_TYPES.SESSION_RESCHEDULED,
      channel: data.channel || 'both',
      content: `Your session has been rescheduled to ${data.newTime}.`,
      relatedSessionId: data.sessionId,
      title: 'Session Rescheduled',
      data: data
    });
  });

  // SESSION_CANCELLED
  notificationEmitter.on(NOTIFICATION_TYPES.SESSION_CANCELLED, async (data) => {
    await dispatchNotification({
      recipientId: data.patientId,
      type: NOTIFICATION_TYPES.SESSION_CANCELLED,
      channel: data.channel || 'both',
      content: `Your session scheduled for ${data.time} has been cancelled.`,
      relatedSessionId: data.sessionId,
      title: 'Session Cancelled',
      data: data
    });
  });

  // COMPLICATION_REPORTED
  notificationEmitter.on(NOTIFICATION_TYPES.COMPLICATION_REPORTED, async (data) => {
    await dispatchNotification({
      recipientId: data.doctorId,
      type: NOTIFICATION_TYPES.COMPLICATION_REPORTED,
      channel: 'both',
      content: `A complication has been reported for session ${data.sessionId}.`,
      relatedSessionId: data.sessionId,
      title: 'Complication Reported',
      data: data
    });
  });

  // EMERGENCY_SESSION_PAUSE
  notificationEmitter.on(NOTIFICATION_TYPES.EMERGENCY_SESSION_PAUSE, async (data) => {
    await dispatchNotification({
      recipientId: data.doctorId,
      type: NOTIFICATION_TYPES.EMERGENCY_SESSION_PAUSE,
      channel: 'both',
      content: `Emergency pause triggered for session ${data.sessionId}.`,
      relatedSessionId: data.sessionId,
      title: 'Emergency Pause',
      data: data
    });
  });

  // STAGE_PROGRESSION_UNLOCKED
  notificationEmitter.on(NOTIFICATION_TYPES.STAGE_PROGRESSION_UNLOCKED, async (data) => {
    await dispatchNotification({
      recipientId: data.patientId,
      type: NOTIFICATION_TYPES.STAGE_PROGRESSION_UNLOCKED,
      channel: 'both',
      content: `You have progressed to the next stage of your therapy plan!`,
      relatedSessionId: data.sessionId,
      title: 'Stage Unlocked',
      data: data
    });
  });

  // SCHEDULING_CONFLICT_DETECTED
  notificationEmitter.on(NOTIFICATION_TYPES.SCHEDULING_CONFLICT_DETECTED, async (data) => {
    await dispatchNotification({
      recipientId: data.adminId,
      type: NOTIFICATION_TYPES.SCHEDULING_CONFLICT_DETECTED,
      channel: 'both',
      content: `Scheduling conflict detected for room ${data.roomId}.`,
      relatedSessionId: data.sessionId,
      title: 'Scheduling Conflict',
      data: data
    });
  });

  // PRAKRITI_RECLASSIFICATION_IMPACT
  notificationEmitter.on(NOTIFICATION_TYPES.PRAKRITI_RECLASSIFICATION_IMPACT, async (data) => {
    await dispatchNotification({
      recipientId: data.doctorId,
      type: NOTIFICATION_TYPES.PRAKRITI_RECLASSIFICATION_IMPACT,
      channel: 'both',
      content: `Prakriti reclassification may impact plan ${data.planId}.`,
      relatedSessionId: data.sessionId,
      title: 'Prakriti Reclassification',
      data: data
    });
  });

  // DUPLICATE_PACKAGE_WARNING
  notificationEmitter.on(NOTIFICATION_TYPES.DUPLICATE_PACKAGE_WARNING, async (data) => {
    await dispatchNotification({
      recipientId: data.adminId,
      type: NOTIFICATION_TYPES.DUPLICATE_PACKAGE_WARNING,
      channel: 'both',
      content: `Duplicate package warning for patient ${data.patientId}.`,
      relatedSessionId: data.sessionId,
      title: 'Duplicate Package',
      data: data
    });
  });

  // ACCOUNT_CREDENTIALS_GENERATED
  notificationEmitter.on(NOTIFICATION_TYPES.ACCOUNT_CREDENTIALS_GENERATED, async (data) => {
    await dispatchNotification({
      recipientId: data.userId,
      type: NOTIFICATION_TYPES.ACCOUNT_CREDENTIALS_GENERATED,
      channel: 'both',
      content: `Your account credentials have been generated.`,
      relatedSessionId: null,
      title: 'Credentials Generated',
      data: data
    });
  });

  // NEW_SESSION_ASSIGNED
  notificationEmitter.on(NOTIFICATION_TYPES.NEW_SESSION_ASSIGNED, async (data) => {
    await dispatchNotification({
      recipientId: data.therapistId,
      type: NOTIFICATION_TYPES.NEW_SESSION_ASSIGNED,
      channel: 'both',
      content: `You have been assigned a new session for patient ${data.patientId}.`,
      relatedSessionId: data.sessionId,
      title: 'New Session Assigned',
      data: data
    });
  });

  // SHIFT_HANDOVER_RECEIVED
  notificationEmitter.on(NOTIFICATION_TYPES.SHIFT_HANDOVER_RECEIVED, async (data) => {
    await dispatchNotification({
      recipientId: data.therapistId,
      type: NOTIFICATION_TYPES.SHIFT_HANDOVER_RECEIVED,
      channel: 'both',
      content: `You have received a shift handover.`,
      relatedSessionId: data.sessionId,
      title: 'Shift Handover',
      data: data
    });
  });

  // PLAN_UPDATED_MID_SESSION
  notificationEmitter.on(NOTIFICATION_TYPES.PLAN_UPDATED_MID_SESSION, async (data) => {
    await dispatchNotification({
      recipientId: data.therapistId,
      type: NOTIFICATION_TYPES.PLAN_UPDATED_MID_SESSION,
      channel: 'both',
      content: `Plan updated mid-session for patient ${data.patientId}.`,
      relatedSessionId: data.sessionId,
      title: 'Plan Updated',
      data: data
    });
  });

  // DELIVERY_FAILED
  notificationEmitter.on(NOTIFICATION_TYPES.DELIVERY_FAILED, async (data) => {
    await dispatchNotification({
      recipientId: data.adminId,
      type: NOTIFICATION_TYPES.DELIVERY_FAILED,
      channel: 'both',
      content: `Notification delivery failed for user ${data.targetUserId}.`,
      relatedSessionId: data.sessionId,
      title: 'Delivery Failed',
      data: data
    });
  });

  // ROOM_MAINTENANCE_CONFLICT
  notificationEmitter.on(NOTIFICATION_TYPES.ROOM_MAINTENANCE_CONFLICT, async (data) => {
    await dispatchNotification({
      recipientId: data.adminId,
      type: NOTIFICATION_TYPES.ROOM_MAINTENANCE_CONFLICT,
      channel: 'both',
      content: `Room maintenance conflict detected for room ${data.roomId}.`,
      relatedSessionId: data.sessionId,
      title: 'Room Maintenance Conflict',
      data: data
    });
  });

  // INVENTORY_THRESHOLD_BREACH
  notificationEmitter.on(NOTIFICATION_TYPES.INVENTORY_THRESHOLD_BREACH, async (data) => {
    await dispatchNotification({
      recipientId: data.adminId,
      type: NOTIFICATION_TYPES.INVENTORY_THRESHOLD_BREACH,
      channel: 'both',
      content: `Inventory threshold breach for item ${data.itemId}.`,
      relatedSessionId: null,
      title: 'Inventory Alert',
      data: data
    });
  });

  // DOCTOR_CREATED_PACKAGE_LOGGED
  notificationEmitter.on(NOTIFICATION_TYPES.DOCTOR_CREATED_PACKAGE_LOGGED, async (data) => {
    await dispatchNotification({
      recipientId: data.adminId,
      type: NOTIFICATION_TYPES.DOCTOR_CREATED_PACKAGE_LOGGED,
      channel: 'both',
      content: `Audit log: Doctor created a new package (ID: ${data.packageId}).`,
      relatedSessionId: null,
      title: 'Package Audit Log',
      data: data
    });
  });

  console.log('[Notification Engine] Listeners registered for all instant events.');
}

module.exports = {
  registerListeners,
};
