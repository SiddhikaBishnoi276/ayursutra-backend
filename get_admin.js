const { pool } = require('./src/config/db');
(async () => {
  const admin = await pool.query("SELECT id FROM users WHERE role='clinic_admin' LIMIT 1");
  console.log(admin.rows[0].id);
  process.exit(0);
})();
