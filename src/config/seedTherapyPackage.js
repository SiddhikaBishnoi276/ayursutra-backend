const { pool } = require('./db');

async function seedTherapyPackage() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const doctorRes = await client.query("SELECT id FROM users WHERE phone = '9000000002'");
    const doctorId = doctorRes.rows[0]?.id;

    let pkgRes = await client.query("SELECT id FROM therapy_packages WHERE name = '7-Day Virechana Protocol' AND clinic_id = 1");
    let packageId = pkgRes.rows[0]?.id;

    if (!packageId) {
      const insertPkg = await client.query(
        `INSERT INTO therapy_packages (clinic_id, name, therapy_type, created_by, is_active)
         VALUES (1, '7-Day Virechana Protocol', 'Virechana', $1, true) RETURNING id`,
        [doctorId]
      );
      packageId = insertPkg.rows[0].id;

      const stages = [
        { stage_type: 'Poorvakarma', sequence_order: 1, day_offset: 0, duration_days: 2, pre: 'Light diet, oil massage (Snehana) daily', post: null },
        { stage_type: 'Pradhanakarma', sequence_order: 2, day_offset: 2, duration_days: 3, pre: 'Fasting before Virechana procedure', post: 'Complete bed rest post-purgation' },
        { stage_type: 'Paschatkarma', sequence_order: 3, day_offset: 5, duration_days: 2, pre: null, post: 'Samsarjana Krama diet: Peya, then Vilepi' },
      ];

      for (const s of stages) {
        await client.query(
          `INSERT INTO therapy_package_stages
             (package_id, stage_type, sequence_order, day_offset, duration_days, pre_instructions, post_instructions)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [packageId, s.stage_type, s.sequence_order, s.day_offset, s.duration_days, s.pre, s.post]
        );
      }
      console.log('✅ Therapy package seeded: 7-Day Virechana Protocol (3 stages)');
    } else {
      console.log('ℹ️ Package already exists, skipping insert.');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Package seeding failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) seedTherapyPackage();
module.exports = seedTherapyPackage;
