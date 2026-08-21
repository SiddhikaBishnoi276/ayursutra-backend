const { authenticateUser, mockLogin } = require('../Services/authService');

async function loginHandler(req, res) {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const result = await authenticateUser({ email, password, role });
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: result.token,
      user: result.user,
      user_id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      phone: result.user.phone,
      role: result.user.role,
      clinic_id: result.user.clinic_id,
      practice_mode: result.user.practice_mode,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || 'Authentication failed',
      error: err.message || 'Authentication failed',
    });
  }
}

async function mockLoginHandler(req, res) {
  try {
    const { role, email, password } = req.body;

    // If real credentials are provided, authenticate directly
    if (email && password) {
      const result = await authenticateUser({ email, password, role });
      return res.status(200).json({
        success: true,
        token: result.token,
        user: result.user,
        user_id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        role: result.user.role,
        clinic_id: result.user.clinic_id,
        practice_mode: result.user.practice_mode,
      });
    }

    const validRoles = ['clinic_admin', 'doctor', 'therapist', 'patient', 'solo_practitioner', 'admin'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `role must be one of ${validRoles.join(', ')}`,
      });
    }

    const normalizedRole = role === 'admin' ? 'clinic_admin' : role;
    const session = await mockLogin(normalizedRole);
    return res.status(200).json(session);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message,
      error: err.message,
    });
  }
}

module.exports = { loginHandler, mockLoginHandler };

