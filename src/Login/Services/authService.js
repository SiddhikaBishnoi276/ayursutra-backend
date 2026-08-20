const dataAccess = require('../../Common/Utils/dataAccess');

async function mockLogin(role) {
  const user = await dataAccess.findUserByRole(role);
  if (!user) {
    throw new Error(`No active user found in database for role: ${role}`);
  }

  return {
    user_id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    practice_mode: user.practitioner_mode || 'clinic',
    clinic_id: user.clinic_id,
  };
}

module.exports = { mockLogin };
