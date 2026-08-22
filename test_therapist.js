const { pool } = require('./src/config/db');
const staffService = require('./src/Admin/Services/staffService');
(async () => {
  try {
    const admin = await pool.query("SELECT id, clinic_id FROM users WHERE role='clinic_admin' LIMIT 1");
    const adminUser = admin.rows[0];
    const newStaff = await staffService.createStaff({
      name: 'Test Therapist JS',
      email: 'test.therapist.js@example.com',
      phone: '+918888888888',
      password: 'Password@123',
      gender: 'Male',
      role: 'therapist',
      clinic_id: adminUser.clinic_id,
      created_by: adminUser.id,
      specializations: []
    });
    console.log('Success:', newStaff.id);
  } catch(e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
})();
