const { pool } = require('./db');

async function seedDatabase() {
  console.log('🌱 Starting AyurSutra Database Seeding...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert Clinics
    console.log('🏥 Inserting demo clinics...');
    const clinic1Res = await client.query(`
      INSERT INTO clinics (name, practitioner_mode, address, contact_phone)
      VALUES ('AyurSutra Demo Clinic', 'clinic', '123 Ayurveda Marg, New Delhi', '011-23456789')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `);

    const clinic2Res = await client.query(`
      INSERT INTO clinics (name, practitioner_mode, address, contact_phone)
      VALUES ('Suresh Solo Practice', 'solo', '45 Panchakarma Lane, Bengaluru', '080-98765432')
      ON CONFLICT DO NOTHING
      RETURNING id;
    `);

    // Get clinic IDs
    const clinic1Id = clinic1Res.rows[0]?.id || (await client.query("SELECT id FROM clinics WHERE name = 'AyurSutra Demo Clinic'")).rows[0]?.id;
    const clinic2Id = clinic2Res.rows[0]?.id || (await client.query("SELECT id FROM clinics WHERE name = 'Suresh Solo Practice'")).rows[0]?.id;

    // 2. Insert Users
    console.log('👤 Inserting demo users...');

    // Clinic Admin
    const adminRes = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role, clinic_id, is_active)
      VALUES ('Anjali Verma', 'anjali@demo.ayursutra.com', '9000000001', 'demo_hash_123', 'clinic_admin', $1, true)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, clinic_id = EXCLUDED.clinic_id
      RETURNING id;
    `, [clinic1Id]);
    const adminId = adminRes.rows[0]?.id || (await client.query("SELECT id FROM users WHERE phone = '9000000001'")).rows[0]?.id;

    // Update clinic owner
    await client.query('UPDATE clinics SET owner_user_id = $1 WHERE id = $2', [adminId, clinic1Id]);

    // Doctor
    const doctorRes = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role, gender, clinic_id, is_active)
      VALUES ('Dr. Ravi Sharma', 'ravi@demo.ayursutra.com', '9000000002', 'demo_hash_123', 'doctor', 'Male', $1, true)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, clinic_id = EXCLUDED.clinic_id
      RETURNING id;
    `, [clinic1Id]);
    const doctorId = doctorRes.rows[0]?.id || (await client.query("SELECT id FROM users WHERE phone = '9000000002'")).rows[0]?.id;

    await client.query(`
      INSERT INTO doctor_profiles (user_id, qualification, registration_number)
      VALUES ($1, 'BAMS, MD (Ayurveda)', 'AY-2024-1123')
      ON CONFLICT (user_id) DO UPDATE SET qualification = EXCLUDED.qualification, registration_number = EXCLUDED.registration_number;
    `, [doctorId]);

    // Therapist 1 (Basti)
    const therapist1Res = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role, gender, clinic_id, is_active)
      VALUES ('Suresh Yadav', 'suresh.y@demo.ayursutra.com', '9000000003', 'demo_hash_123', 'therapist', 'Male', $1, true)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, clinic_id = EXCLUDED.clinic_id
      RETURNING id;
    `, [clinic1Id]);
    const therapist1Id = therapist1Res.rows[0]?.id || (await client.query("SELECT id FROM users WHERE phone = '9000000003'")).rows[0]?.id;

    await client.query(`
      INSERT INTO therapist_profiles (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING;
    `, [therapist1Id]);

    await client.query(`
      DELETE FROM therapist_specializations WHERE therapist_id = $1;
    `, [therapist1Id]);

    await client.query(`
      INSERT INTO therapist_specializations (therapist_id, therapy_type)
      VALUES ($1, 'Basti');
    `, [therapist1Id]);

    // Therapist 2 (Virechana)
    const therapist2Res = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role, gender, clinic_id, is_active)
      VALUES ('Priya Nair', 'priya@demo.ayursutra.com', '9000000004', 'demo_hash_123', 'therapist', 'Female', $1, true)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, clinic_id = EXCLUDED.clinic_id
      RETURNING id;
    `, [clinic1Id]);
    const therapist2Id = therapist2Res.rows[0]?.id || (await client.query("SELECT id FROM users WHERE phone = '9000000004'")).rows[0]?.id;

    await client.query(`
      INSERT INTO therapist_profiles (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING;
    `, [therapist2Id]);

    await client.query(`
      DELETE FROM therapist_specializations WHERE therapist_id = $1;
    `, [therapist2Id]);

    await client.query(`
      INSERT INTO therapist_specializations (therapist_id, therapy_type)
      VALUES ($1, 'Virechana');
    `, [therapist2Id]);

    // Solo Practitioner
    const soloRes = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role, gender, clinic_id, is_active)
      VALUES ('Dr. Suresh Solo', 'suresh.solo@demo.ayursutra.com', '9000000005', 'demo_hash_123', 'solo_practitioner', 'Male', $1, true)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, clinic_id = EXCLUDED.clinic_id
      RETURNING id;
    `, [clinic2Id]);
    const soloId = soloRes.rows[0]?.id || (await client.query("SELECT id FROM users WHERE phone = '9000000005'")).rows[0]?.id;

    await client.query(`
      INSERT INTO doctor_profiles (user_id, qualification, registration_number)
      VALUES ($1, 'BAMS', 'AY-2024-9981')
      ON CONFLICT (user_id) DO UPDATE SET qualification = EXCLUDED.qualification, registration_number = EXCLUDED.registration_number;
    `, [soloId]);

    await client.query('UPDATE clinics SET owner_user_id = $1 WHERE id = $2', [soloId, clinic2Id]);

    // Patient
    const patientRes = await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role, gender, clinic_id, is_active)
      VALUES ('Meera Patel', 'meera@demo.ayursutra.com', '9000000006', 'demo_hash_123', 'patient', 'Female', $1, true)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, clinic_id = EXCLUDED.clinic_id
      RETURNING id;
    `, [clinic1Id]);
    const patientUserId = patientRes.rows[0]?.id || (await client.query("SELECT id FROM users WHERE phone = '9000000006'")).rows[0]?.id;

    await client.query(`
      INSERT INTO patients (user_id, clinic_id, age, chief_complaint, diagnosis)
      VALUES ($1, $2, 34, 'Chronic back pain and fatigue', 'Vata imbalance')
      ON CONFLICT (user_id) DO UPDATE SET age = EXCLUDED.age, chief_complaint = EXCLUDED.chief_complaint, diagnosis = EXCLUDED.diagnosis;
    `, [patientUserId, clinic1Id]);

    // 3. Insert Rooms
    console.log('🚪 Inserting demo rooms...');
    await client.query(`
      INSERT INTO rooms (clinic_id, name, status)
      VALUES 
        ($1, 'Droni Room', 'available'),
        ($1, 'Steam Chamber', 'available')
      ON CONFLICT DO NOTHING;
    `, [clinic1Id]);

    await client.query('COMMIT');
    console.log('✅ Seed data inserted successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
