const { query } = require('../../config/db');

/**
 * Get comprehensive Doctor Dashboard stats, scheduled procedures today,
 * complication alerts, and recent clinical activities.
 */
async function getDoctorDashboardStats(doctorUser) {
  const clinicId = doctorUser.clinic_id;

  // 1. Core aggregate counts
  const totalPatientsRes = await query(
    `SELECT COUNT(*) FROM patients WHERE clinic_id = $1`,
    [clinicId]
  );
  const totalPatients = parseInt(totalPatientsRes.rows[0]?.count || 0, 10);

  const activePlansRes = await query(
    `SELECT 
       COUNT(*) FILTER (WHERE tp.status = 'active') AS active_count,
       COUNT(*) FILTER (WHERE tp.status = 'completed') AS completed_count
     FROM therapy_plans tp
     JOIN patients p ON p.user_id = tp.patient_id
     WHERE p.clinic_id = $1`,
    [clinicId]
  );
  const activePatients = parseInt(activePlansRes.rows[0]?.active_count || 0, 10);
  const completedProtocols = parseInt(activePlansRes.rows[0]?.completed_count || 0, 10);

  const pendingAlertsRes = await query(
    `SELECT COUNT(*) 
     FROM complication_alerts ca
     JOIN session_observations so ON so.id = ca.session_observation_id
     JOIN sessions s ON s.id = so.session_id
     JOIN patients p ON p.user_id = s.patient_id
     WHERE p.clinic_id = $1 AND ca.status = 'pending'`,
    [clinicId]
  );
  const flaggedAlerts = parseInt(pendingAlertsRes.rows[0]?.count || 0, 10);

  const todaySessionsCountRes = await query(
    `SELECT COUNT(*) 
     FROM sessions s
     JOIN patients p ON p.user_id = s.patient_id
     WHERE p.clinic_id = $1 AND s.scheduled_date = CURRENT_DATE`,
    [clinicId]
  );
  const todaySessions = parseInt(todaySessionsCountRes.rows[0]?.count || 0, 10);

  const roomsRes = await query(
    `SELECT 
       COUNT(*) FILTER (WHERE status = 'occupied') AS occupied,
       COUNT(*) FILTER (WHERE status = 'available') AS available
     FROM rooms
     WHERE clinic_id = $1`,
    [clinicId]
  );
  const roomsOccupied = parseInt(roomsRes.rows[0]?.occupied || 0, 10);
  const roomsAvailable = parseInt(roomsRes.rows[0]?.available || 0, 10);

  // 2. Today's Scheduled Procedures list
  const todayProceduresRes = await query(
    `SELECT 
       s.id AS session_id,
       up.name AS patient_name,
       pkg.name AS package_name,
       pkg.therapy_type,
       tps.stage_type,
       s.scheduled_start_time,
       s.scheduled_time,
       r.name AS room_name,
       ut.name AS therapist_name,
       s.status
     FROM sessions s
     JOIN patients p ON p.user_id = s.patient_id
     JOIN users up ON up.id = p.user_id
     JOIN therapy_plan_stages tps ON tps.id = s.plan_stage_id
     JOIN therapy_plans tp ON tp.id = tps.plan_id
     LEFT JOIN therapy_packages pkg ON pkg.id = tp.package_id
     LEFT JOIN rooms r ON r.id = s.room_id
     LEFT JOIN users ut ON ut.id = s.therapist_id
     WHERE p.clinic_id = $1 AND s.scheduled_date = CURRENT_DATE
     ORDER BY s.scheduled_start_time ASC LIMIT 10`,
    [clinicId]
  );

  const todayScheduledProcedures = todayProceduresRes.rows.map((row) => ({
    sessionId: row.session_id,
    patientName: row.patient_name,
    procedureName: row.package_name || row.therapy_type || `${row.stage_type} Procedure`,
    stageType: row.stage_type,
    scheduledTime: row.scheduled_start_time || row.scheduled_time || '10:00:00',
    roomName: row.room_name || 'Treatment Room 1',
    therapistName: row.therapist_name || 'Assigned Therapist',
    status: row.status,
  }));

  // 3. Complication alerts feed
  const alertsRes = await query(
    `SELECT 
       ca.id AS alert_id,
       up.name AS patient_name,
       so.complication_notes,
       ut.name AS reported_by,
       ca.created_at,
       ca.status
     FROM complication_alerts ca
     JOIN session_observations so ON so.id = ca.session_observation_id
     JOIN sessions s ON s.id = so.session_id
     JOIN patients p ON p.user_id = s.patient_id
     JOIN users up ON up.id = p.user_id
     LEFT JOIN users ut ON ut.id = so.recorded_by
     WHERE p.clinic_id = $1
     ORDER BY ca.created_at DESC LIMIT 5`,
    [clinicId]
  );

  const complicationAlerts = alertsRes.rows.map((row) => ({
    alertId: row.alert_id,
    patientName: row.patient_name,
    severity: row.complication_notes?.toLowerCase().includes('emergency') ? 'critical' : 'moderate',
    message: row.complication_notes || 'Vital anomaly observed post-procedure.',
    reportedBy: row.reported_by ? `Therapist ${row.reported_by}` : 'Clinical Staff',
    createdAt: row.created_at,
    time: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
    status: row.status,
  }));

  // 4. Clinical Activity Feed
  const recentActivities = [];

  // Recent Assessments
  const assessmentsRes = await query(
    `SELECT pa.id, up.name AS patient_name, pa.confirmed_dosha, pa.assessed_at
     FROM prakriti_assessments pa
     JOIN patients p ON p.user_id = pa.patient_id
     JOIN users up ON up.id = p.user_id
     WHERE p.clinic_id = $1
     ORDER BY pa.assessed_at DESC LIMIT 3`,
    [clinicId]
  );
  assessmentsRes.rows.forEach((r) => {
    recentActivities.push({
      id: `act-ass-${r.id}`,
      type: 'assessment',
      title: 'Prakriti Assessment Completed',
      description: `${r.confirmed_dosha || 'Prakriti'} confirmed for ${r.patient_name}`,
      timestamp: r.assessed_at,
    });
  });

  // Recent Completed Sessions
  const completedSessionsRes = await query(
    `SELECT s.id, up.name AS patient_name, tps.stage_type, s.actual_end_time
     FROM sessions s
     JOIN patients p ON p.user_id = s.patient_id
     JOIN users up ON up.id = p.user_id
     JOIN therapy_plan_stages tps ON tps.id = s.plan_stage_id
     WHERE p.clinic_id = $1 AND s.status = 'completed'
     ORDER BY s.actual_end_time DESC NULLS LAST LIMIT 3`,
    [clinicId]
  );
  completedSessionsRes.rows.forEach((r) => {
    recentActivities.push({
      id: `act-sess-${r.id}`,
      type: 'session_completed',
      title: 'Session Successfully Completed',
      description: `${r.stage_type} session completed for ${r.patient_name}`,
      timestamp: r.actual_end_time || new Date(),
    });
  });

  recentActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    stats: {
      totalPatients,
      activePatients,
      flaggedAlerts,
      completedProtocols,
      todaySessions,
      roomsOccupied,
      roomsAvailable,
    },
    todayScheduledProcedures,
    complicationAlerts,
    recentActivity: recentActivities.slice(0, 6),
  };
}

module.exports = { getDoctorDashboardStats };
