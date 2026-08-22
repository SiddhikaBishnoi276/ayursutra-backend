const { pool } = require('./src/config/db');
async function test() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log('Tables:', res.rows.map(r => r.table_name));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}
test();
