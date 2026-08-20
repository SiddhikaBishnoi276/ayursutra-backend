const { Pool } = require('pg');
require('dotenv').config();

let connectionString = process.env.DATABASE_URL;
if (connectionString && connectionString.includes('sslmode=require')) {
  connectionString = connectionString.replace('sslmode=require', 'sslmode=verify-full');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on('connect', () => {
  console.log('Connected to Neon PostgreSQL database.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
