const dataAccess = require('../../Common/Utils/dataAccess');

async function getClinicResources(clinicId) {
  return dataAccess.getClinicResources(clinicId);
}

module.exports = { getClinicResources };
