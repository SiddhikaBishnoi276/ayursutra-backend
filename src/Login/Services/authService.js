const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dataAccess = require('../../Common/Utils/dataAccess');

const ROLE_MAPPINGS = {
  admin: ['clinic_admin', 'solo_practitioner'],
  clinic_admin: ['clinic_admin', 'solo_practitioner'],
  solo_practitioner: ['solo_practitioner', 'clinic_admin'],
  doctor: ['doctor'],
  therapist: ['therapist'],
  patient: ['patient'],
};

/**
 * Authenticate user with actual email/phone, password, and role check
 */
async function authenticateUser({ email, password, role }) {
  if (!email || !password) {
    const err = new Error('Email and password are required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch user by email or phone
  const user = await dataAccess.findUserByEmailOrPhone(email);
  if (!user) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  // 2. Validate role authorization if role is provided
  if (role) {
    const normalizedRole = role.toLowerCase().trim();
    const allowedDbRoles = ROLE_MAPPINGS[normalizedRole] || [normalizedRole];

    if (!allowedDbRoles.includes(user.role)) {
      const displayRole = user.role === 'clinic_admin' ? 'Admin' : user.role.charAt(0).toUpperCase() + user.role.slice(1);
      const requestedRoleDisplay = role.charAt(0).toUpperCase() + role.slice(1);
      const err = new Error(`Access denied: This account belongs to '${displayRole}' role, cannot login via '${requestedRoleDisplay}' portal.`);
      err.statusCode = 403;
      throw err;
    }
  }

  // 3. Verify password (supports bcrypt hashes and legacy plaintext)
  let isMatch = false;
  if (user.password_hash) {
    const isBcrypt = user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2a$');
    if (isBcrypt) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      isMatch = user.password_hash === password;
    }
  }

  if (!isMatch) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  // 4. Check active state
  if (user.is_active === false) {
    const err = new Error('Account is inactive or suspended. Please contact clinic administrator.');
    err.statusCode = 403;
    throw err;
  }

  // 5. Generate JWT token
  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      clinicId: user.clinic_id,
      email: user.email,
    },
    process.env.JWT_SECRET || 'ayursutra_jwt_secret_key_2026',
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      gender: user.gender,
      clinic_id: user.clinic_id,
      practice_mode: user.practitioner_mode || 'clinic',
    },
  };
}

/**
 * Backward-compatible mock login (for legacy fallback)
 */
async function mockLogin(role) {
  const user = await dataAccess.findUserByRole(role);
  if (!user) {
    const err = new Error(`No active user found in database for role: ${role}`);
    err.statusCode = 404;
    throw err;
  }

  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      clinicId: user.clinic_id,
      email: user.email,
    },
    process.env.JWT_SECRET || 'ayursutra_jwt_secret_key_2026',
    { expiresIn: '7d' }
  );

  return {
    token,
    user_id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    practice_mode: user.practitioner_mode || 'clinic',
    clinic_id: user.clinic_id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      gender: user.gender,
      clinic_id: user.clinic_id,
      practice_mode: user.practitioner_mode || 'clinic',
    },
  };
}

module.exports = { authenticateUser, mockLogin };

