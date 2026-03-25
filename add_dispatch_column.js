const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'internship_db',
  });
  try {
    await pool.query('ALTER TABLE requests ADD COLUMN dispatchLetter LONGTEXT DEFAULT NULL');
    console.log('SUCCESS: Column dispatchLetter added to requests table');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column dispatchLetter already exists - OK');
    } else {
      console.error('ERROR:', e.message);
    }
  }
  await pool.end();
})();
