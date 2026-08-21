const { pool } = require('../src/config/db');

async function check() {
  try {
    const dbInfo = await pool.query('SELECT current_database(), current_user, version()');
    console.log('==============================================');
    console.log('📍 DATABASE CONNECTION DETAILS:');
    console.log('==============================================');
    console.log('Host/Endpoint URL:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
    console.log('Current Database:', dbInfo.rows[0].current_database);
    console.log('Current User:', dbInfo.rows[0].current_user);

    console.log('\n==============================================');
    console.log('📊 TABLES IN PUBLIC SCHEMA:');
    console.log('==============================================');
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(tablesRes.rows.map(r => r.table_name));

    console.log('\n==============================================');
    console.log('🔍 1. TABLE: therapist_weekly_shifts');
    console.log('==============================================');
    const shiftCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'therapist_weekly_shifts'
      ORDER BY ordinal_position;
    `);
    console.log('Columns:', shiftCols.rows);
    const shiftCount = await pool.query('SELECT COUNT(*) FROM therapist_weekly_shifts');
    console.log('Row Count:', shiftCount.rows[0].count);
    const sampleShifts = await pool.query('SELECT * FROM therapist_weekly_shifts LIMIT 3');
    console.log('Sample Rows:', sampleShifts.rows);

    console.log('\n==============================================');
    console.log('🔍 2. TABLE: sessions (Time-Range Columns)');
    console.log('==============================================');
    const sessionCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions'
      ORDER BY ordinal_position;
    `);
    console.log('Columns:', sessionCols.rows.map(r => `${r.column_name} (${r.data_type})`));

    console.log('\n==============================================');
    console.log('🔍 3. TABLE: therapy_package_stages (Duration Column)');
    console.log('==============================================');
    const stageCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'therapy_package_stages'
      ORDER BY ordinal_position;
    `);
    console.log('Columns:', stageCols.rows.map(r => `${r.column_name} (${r.data_type})`));

    console.log('\n==============================================');
    console.log('🔍 4. INDEXES VERIFICATION');
    console.log('==============================================');
    const indexRes = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename IN ('sessions', 'therapist_weekly_shifts', 'therapist_availability')
      ORDER BY tablename, indexname;
    `);
    indexRes.rows.forEach(r => console.log(`- ${r.indexname}: ${r.indexdef}`));

  } catch (err) {
    console.error('Error during db inspection:', err);
  } finally {
    await pool.end();
  }
}

check();
