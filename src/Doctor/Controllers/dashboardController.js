const { getDoctorDashboardStats } = require('../Services/dashboardService');

async function getDashboardStatsHandler(req, res) {
  try {
    const stats = await getDoctorDashboardStats(req.user);
    res.json(stats);
  } catch (err) {
    console.error('Error in getDashboardStatsHandler:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getDashboardStatsHandler };
