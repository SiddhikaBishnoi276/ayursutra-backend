const { mockLogin } = require('../Services/authService');

async function mockLoginHandler(req, res) {
  try {
    const { role } = req.body;
    const validRoles = ['clinic_admin', 'doctor', 'therapist', 'patient', 'solo_practitioner'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of ${validRoles.join(', ')}` });
    }
    const session = await mockLogin(role);
    res.json(session);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

module.exports = { mockLoginHandler };
