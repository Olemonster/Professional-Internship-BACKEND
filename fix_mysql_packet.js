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
    // Check current max_allowed_packet
    const [rows] = await pool.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
    console.log('Current max_allowed_packet:', rows[0]?.Value, 'bytes', '(' + Math.round(rows[0]?.Value / 1024 / 1024) + ' MB)');
    
    // Set to 64MB
    await pool.query('SET GLOBAL max_allowed_packet = 67108864');
    console.log('SUCCESS: max_allowed_packet set to 64MB');
    
    const [rows2] = await pool.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
    console.log('New max_allowed_packet:', rows2[0]?.Value, 'bytes', '(' + Math.round(rows2[0]?.Value / 1024 / 1024) + ' MB)');
  } catch (e) {
    console.error('ERROR:', e.message);
  }
  await pool.end();
})();
