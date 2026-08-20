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

// Auto-migration helper to guarantee studentId and department columns exist & max_allowed_packet is increased
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query("ALTER TABLE `user` ADD COLUMN `studentId` VARCHAR(191) DEFAULT NULL").catch(() => {});
    await conn.query("ALTER TABLE `user` ADD COLUMN `department` VARCHAR(191) DEFAULT NULL").catch(() => {});
    await conn.query("CREATE TABLE IF NOT EXISTS `profile` (`id` INT(11) NOT NULL AUTO_INCREMENT, `profile_id` VARCHAR(191) NOT NULL, `firstname` VARCHAR(100) DEFAULT NULL, `lastname` VARCHAR(100) DEFAULT NULL, `faculty_id` INT(11) DEFAULT 0, `department_id` INT(11) DEFAULT 0, `address` TEXT DEFAULT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4").catch(() => {});
    await conn.query("DROP VIEW IF EXISTS `users`").catch(() => {});
    await conn.query("SET GLOBAL max_allowed_packet = 67108864").catch(() => {});
    conn.release();
  } catch (err) {
    console.error('Database initialization notice:', err.message);
  }
})();

module.exports = pool;
