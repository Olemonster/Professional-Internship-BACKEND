const mysql = require('mysql2/promise');
require('dotenv').config();

async function alterTable() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Adding signature column to evaluations table...');
    await pool.query('ALTER TABLE evaluations ADD COLUMN signature LONGTEXT DEFAULT NULL AFTER otherComments;');
    console.log('Successfully added signature column.');
    
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column signature already exists.');
      process.exit(0);
    } else {
      console.error('Error altering table:', err);
      process.exit(1);
    }
  }
}

alterTable();
