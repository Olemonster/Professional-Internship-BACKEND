const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'internship_overall',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

// Auto-migration helper to guarantee studentId and department columns exist for backward compatibility
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query("ALTER TABLE `user` ADD COLUMN `studentId` VARCHAR(191) DEFAULT NULL").catch(() => {});
    await conn.query("ALTER TABLE `user` ADD COLUMN `department` VARCHAR(191) DEFAULT NULL").catch(() => {});
    conn.release();
  } catch (err) {
    console.error('Database initialization notice:', err.message);
  }
})();

module.exports = pool;
