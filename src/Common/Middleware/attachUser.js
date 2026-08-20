const dataAccess = require('../Utils/dataAccess');

async function attachUser(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Missing x-user-id header (mock auth)' });
  }

  const user = await dataAccess.findUserById(userId);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid or inactive user' });
  }

  req.user = user;
  next();
}

module.exports = attachUser;
