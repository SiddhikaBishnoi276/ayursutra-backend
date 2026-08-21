const { pool } = require('../../config/db');

const getDashboardStats = async (clinic_id) => {
  const result = {};

  // 1. Sessions stats for today
  const sessionStatsRes = await pool.query(
    `SELECT 
      COUNT(*) AS today_sessions,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_sessions,
      SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled_remaining
     FROM sessions 
     WHERE scheduled_date = CURRENT_DATE 
       AND room_id IN (SELECT id FROM rooms WHERE clinic_id = $1)`,
    [clinic_id]
  );
  result.todaySessions = parseInt(sessionStatsRes.rows[0].today_sessions) || 0;
  result.completedSessions = parseInt(sessionStatsRes.rows[0].completed_sessions) || 0;
  result.scheduledRemaining = parseInt(sessionStatsRes.rows[0].scheduled_remaining) || 0;

  // 2. Staff Stats
  const staffStatsRes = await pool.query(
    `SELECT 
      COUNT(*) AS active_staff_count,
      SUM(CASE WHEN role IN ('doctor', 'solo_practitioner') THEN 1 ELSE 0 END) AS active_doctors,
      SUM(CASE WHEN role = 'therapist' THEN 1 ELSE 0 END) AS active_therapists
     FROM users 
     WHERE clinic_id = $1 AND is_active = TRUE`,
    [clinic_id]
  );
  result.activeStaffCount = parseInt(staffStatsRes.rows[0].active_staff_count) || 0;
  result.activeDoctors = parseInt(staffStatsRes.rows[0].active_doctors) || 0;
  result.activeTherapists = parseInt(staffStatsRes.rows[0].active_therapists) || 0;

  // 3. Rooms Stats
  const roomStatsRes = await pool.query(
    `SELECT 
      COUNT(*) AS total_rooms,
      SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied_rooms,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_rooms,
      SUM(CASE WHEN status = 'under_maintenance' THEN 1 ELSE 0 END) AS maintenance_rooms
     FROM rooms 
     WHERE clinic_id = $1`,
    [clinic_id]
  );
  result.totalRooms = parseInt(roomStatsRes.rows[0].total_rooms) || 0;
  result.occupiedRooms = parseInt(roomStatsRes.rows[0].occupied_rooms) || 0;
  result.availableRooms = parseInt(roomStatsRes.rows[0].available_rooms) || 0;
  result.maintenanceRooms = parseInt(roomStatsRes.rows[0].maintenance_rooms) || 0;
  result.occupancyRate = result.totalRooms > 0 ? Math.round((result.occupiedRooms / result.totalRooms) * 100) : 0;

  // 4. Alerts (Complications + Delivery failures)
  const complicationsRes = await pool.query(
    `SELECT COUNT(*) AS count FROM complication_alerts WHERE status = 'pending'`
  );
  const deliveryFailuresRes = await pool.query(
    `SELECT COUNT(*) AS count FROM credential_delivery_log WHERE status = 'failed'`
  );
  const complicationsCount = parseInt(complicationsRes.rows[0].count) || 0;
  const deliveryFailuresCount = parseInt(deliveryFailuresRes.rows[0].count) || 0;
  result.operationsAlertsCount = complicationsCount + deliveryFailuresCount;
  
  const alertParts = [];
  if (complicationsCount > 0) alertParts.push(`${complicationsCount} complication${complicationsCount > 1 ? 's' : ''}`);
  if (deliveryFailuresCount > 0) alertParts.push(`${deliveryFailuresCount} SMS delivery failure${deliveryFailuresCount > 1 ? 's' : ''}`);
  result.topAlert = alertParts.length > 0 ? alertParts.join(', ') : 'All systems normal';

  // 5. System Health
  result.systemHealth = [
    { name: "Database Connection", status: "Healthy", type: "db" },
    { 
      name: "SMS/WhatsApp Gateway", 
      status: deliveryFailuresCount > 0 ? `${deliveryFailuresCount} Failed Items` : "Healthy", 
      type: "gateway", 
      failedCount: deliveryFailuresCount 
    },
    { name: "Treatment Scheduling Engine", status: "Healthy", type: "engine" }
  ];

  // 6. Stubbed values for complex historical trends
  result.sessionGrowth = "+12%";
  result.averageOccupancy = 78;
  result.dailySessionVolume = result.todaySessions;
  result.noShowRate = 3.5;
  result.performanceScore = 94;
  result.sessionTrend = [18, 22, 15, 29, 25, 32, result.todaySessions];

  return result;
};

module.exports = {
  getDashboardStats,
};
