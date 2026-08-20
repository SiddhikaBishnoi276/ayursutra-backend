const { query } = require('../../config/db');

async function listPackages(clinicId) {
  const result = await query(
    `SELECT id, name, therapy_type FROM therapy_packages WHERE clinic_id = $1 AND is_active = true ORDER BY name ASC`,
    [clinicId]
  );
  return result.rows;
}

module.exports = { listPackages };
