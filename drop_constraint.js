const { pool } = require('./src/config/db');
(async () => {
  try {
    await pool.query("ALTER TABLE therapist_specializations DROP CONSTRAINT therapist_specializations_therapy_type_check;");
    console.log("Constraint dropped successfully");
  } catch (e) {
    if (e.message.includes('does not exist')) {
      console.log('Constraint does not exist, already dropped');
    } else {
      console.error(e);
    }
  } finally {
    process.exit(0);
  }
})();
