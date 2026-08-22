const { pool } = require('../src/config/db');

async function runSetup() {
  console.log('Starting DB setup for Notification Engine...');

  try {
    // 1. Add updated_at column to sessions if missing
    await pool.query(`
      ALTER TABLE sessions 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    `);
    console.log('Ensure updated_at exists on sessions.');

    // 2. Create the trigger function to update updated_at
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('Trigger function created.');

    // 3. Attach trigger to sessions table
    await pool.query(`
      DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
      CREATE TRIGGER update_sessions_updated_at
      BEFORE UPDATE ON sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('Trigger attached to sessions table.');

    // 4. Create patient_feedbacks table if missing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patient_feedbacks (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id),
        patient_id UUID,
        rating INTEGER,
        comments TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('patient_feedbacks table created (if missing).');

    // 5. Clean up duplicate entries in notifications to avoid UNIQUE constraint violation
    await pool.query(`
      DELETE FROM notifications a USING notifications b
      WHERE a.id < b.id
        AND a.related_session_id = b.related_session_id
        AND a.recipient_id = b.recipient_id
        AND a.type = b.type;
    `);
    console.log('Cleaned up duplicate notifications.');

    // 6. Add UNIQUE constraint to notifications
    // First, let's make sure the constraint doesn't already exist
    await pool.query(`
      ALTER TABLE notifications DROP CONSTRAINT IF EXISTS unique_session_recipient_type;
    `);
    await pool.query(`
      ALTER TABLE notifications 
      ADD CONSTRAINT unique_session_recipient_type 
      UNIQUE (related_session_id, recipient_id, type);
    `);
    console.log('Added UNIQUE constraint to notifications.');

    console.log('DB setup complete.');
  } catch (error) {
    console.error('Error during setup:', error);
  } finally {
    process.exit(0);
  }
}

runSetup();
