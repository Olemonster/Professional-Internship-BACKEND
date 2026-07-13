const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    
    await pool.query(`
      ALTER TABLE requests 
        ADD COLUMN supervisionAppointment JSON NULL;
    `);
    console.log('requests table altered with supervisionAppointment.');
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('Column already exists.');
      process.exit(0);
    }
    console.error(error);
    process.exit(1);
  }
})();
