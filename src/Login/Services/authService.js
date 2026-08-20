const dataAccess = require('../../Common/Utils/dataAccess');

async function mockLogin(role) {
  const user = await dataAccess.findUserByRole(role);
  if (!user) throw new Error(`No demo user found for role: ${role}`);

  return {
    user_id: user.id,
    name: user.full_name,
    role: user.role,
    practice_mode: user.practice_mode,
    clinic_id: user.clinic_id,
  };
}

module.exports = { mockLogin };
