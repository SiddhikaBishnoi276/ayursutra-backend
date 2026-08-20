const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function initDatabase() {
  console.log('🚀 Starting AyurSutra Database Initialization on Neon PostgreSQL...');
  
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Executing schema.sql script...');
    await pool.query(schemaSql);
    console.log('✅ Schema executed successfully!');

    // Query all user-created tables in the public schema to verify
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`\n📊 Total Tables Verified in Neon DB: ${result.rows.length}`);
    console.log('--------------------------------------------------');
    result.rows.forEach((row, index) => {
      console.log(`${(index + 1).toString().padStart(2, ' ')}. ${row.table_name}`);
    });
    console.log('--------------------------------------------------');
    console.log('🎉 All tables and indexes are ready!');

  } catch (error) {
    console.error('❌ Database Initialization failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;
