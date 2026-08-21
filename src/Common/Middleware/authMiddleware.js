const attachUser = require('./attachUser');

module.exports = {
  protect: attachUser,
  attachUser,
};
