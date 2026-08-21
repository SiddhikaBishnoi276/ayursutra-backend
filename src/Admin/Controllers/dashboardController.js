const dashboardService = require('../Services/dashboardService');

const getDashboardStats = async (req, res, next) => {
  try {
    const clinicId = req.user.clinic_id || 1; // Default to 1 if not set in req.user during testing
    const stats = await dashboardService.getDashboardStats(clinicId);
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats,
};
