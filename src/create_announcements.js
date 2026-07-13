const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTable() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  console.log('Creating announcements table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      category ENUM('รับสมัคร', 'ประกาศ', 'กิจกรรม', 'ทั่วไป') DEFAULT 'ทั่วไป',
      coverImage LONGTEXT DEFAULT NULL,
      is_pinned TINYINT(1) DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      author VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
  console.log('Table created successfully.');
  process.exit(0);
}

createTable().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
