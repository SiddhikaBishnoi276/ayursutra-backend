const { pool } = require('./src/config/db');
async function test() {
  try {
    const userRes = await pool.query("SELECT id, name, email FROM users LIMIT 10");
    console.log('Users:', userRes.rows);
    const tokenRes = await pool.query('SELECT * FROM user_device_tokens');
    console.log('Tokens:', tokenRes.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}
test();
