const mysql = require('mysql2/promise');
require('dotenv').config();

async function alterTable() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4'
  });

  try {
    console.log('Altering daily_checkins table...');
    await pool.query('ALTER TABLE daily_checkins ADD COLUMN work_experience TEXT DEFAULT NULL;');
    console.log('Successfully added work_experience column.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column work_experience already exists.');
    } else {
      console.error('Error altering table:', err.message);
    }
  } finally {
    await pool.end();
    process.exit(0);
  }
}

alterTable();
