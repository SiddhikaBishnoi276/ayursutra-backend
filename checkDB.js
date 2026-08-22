const { pool } = require('./src/config/db');
async function checkDB() {
  try {
    const res = await pool.query(`SELECT conname, pg_get_constraintdef(c.oid) as constraint_def FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE conrelid = 'user_device_tokens'::regclass;`);
    console.log('Constraints:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
checkDB();
