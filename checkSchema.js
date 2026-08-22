const { pool } = require('./src/config/db');

async function checkSchema() {
  try {
    const tables = ['sessions', 'notifications', 'patient_feedbacks', 'therapy_plans'];
    
    for (const table of tables) {
      console.log(`\n--- Schema for ${table} ---`);
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1;
      `, [table]);
      
      if (res.rows.length === 0) {
        console.log(`Table ${table} does not exist.`);
      } else {
        res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

checkSchema();
