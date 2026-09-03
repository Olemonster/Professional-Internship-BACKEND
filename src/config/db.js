const mysql = require('mysql2/promise');
require('dotenv').config();

const poolConfig = (process.env.MYSQL_URL || process.env.DATABASE_URL)
  ? {
      uri: process.env.MYSQL_URL || process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    }
  : {
      host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10),
      user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
      password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'internship_overall',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    };

const pool = mysql.createPool(poolConfig);

// Auto-migration helper to guarantee studentId and department columns exist & max_allowed_packet is increased
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query("ALTER TABLE `user` ADD COLUMN `studentId` VARCHAR(191) DEFAULT NULL").catch(() => {});
    await conn.query("ALTER TABLE `user` ADD COLUMN `department` VARCHAR(191) DEFAULT NULL").catch(() => {});
    await conn.query("ALTER TABLE `user` ADD COLUMN `phone` VARCHAR(50) DEFAULT NULL").catch(() => {});
    await conn.query("CREATE TABLE IF NOT EXISTS `profile` (`id` INT(11) NOT NULL AUTO_INCREMENT, `profile_id` VARCHAR(191) NOT NULL, `firstname` VARCHAR(100) DEFAULT NULL, `lastname` VARCHAR(100) DEFAULT NULL, `faculty_id` INT(11) DEFAULT 0, `department_id` INT(11) DEFAULT 0, `address` TEXT DEFAULT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4").catch(() => {});
    await conn.query("ALTER TABLE `profile` ADD COLUMN `phone` VARCHAR(50) DEFAULT NULL").catch(() => {});
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`companies\` (
        \`id\` INT(11) NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(255) NOT NULL,
        \`businessType\` VARCHAR(255) DEFAULT NULL,
        \`address\` TEXT DEFAULT NULL,
        \`province\` VARCHAR(100) DEFAULT NULL,
        \`contactPerson\` VARCHAR(255) DEFAULT NULL,
        \`phone\` VARCHAR(100) DEFAULT NULL,
        \`email\` VARCHAR(191) DEFAULT NULL,
        \`website\` VARCHAR(255) DEFAULT NULL,
        \`positions\` TEXT DEFAULT NULL,
        \`benefits\` TEXT DEFAULT NULL,
        \`imageUrl\` TEXT DEFAULT NULL,
        \`note\` TEXT DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
    await conn.query("ALTER TABLE `companies` ADD COLUMN `department` VARCHAR(255) DEFAULT NULL").catch(() => {});
    await conn.query("ALTER TABLE `companies` ADD COLUMN `departments` TEXT DEFAULT NULL").catch(() => {});
    await conn.query("DROP VIEW IF EXISTS `users`").catch(() => {});
    // Drop leftover FK constraints from old Prisma schema that reference non-existent tables
    await conn.query("ALTER TABLE `profile` DROP FOREIGN KEY `profile_faculty_id_fkey`").catch(() => {});
    await conn.query("ALTER TABLE `profile` DROP FOREIGN KEY `profile_department_id_fkey`").catch(() => {});
    await conn.query("ALTER TABLE `daily_checkins` ADD COLUMN `supervisor_signature` LONGTEXT DEFAULT NULL").catch(() => {});
    await conn.query("ALTER TABLE `daily_checkins` ADD COLUMN `supervisor_name` VARCHAR(255) DEFAULT NULL").catch(() => {});
    await conn.query("ALTER TABLE `daily_checkins` ADD COLUMN `supervisor_comment` TEXT DEFAULT NULL").catch(() => {});
    await conn.query("ALTER TABLE `requests` ADD COLUMN `internship_start_date` DATE DEFAULT NULL").catch(() => {});
    await conn.query("ALTER TABLE `requests` ADD COLUMN `internship_end_date` DATE DEFAULT NULL").catch(() => {});
    await conn.query("UPDATE `requests` SET `internship_start_date` = DATE(`updated_at`) WHERE `status` = 'ออกฝึกงาน' AND `internship_start_date` IS NULL").catch(() => {});
    await conn.query("SET GLOBAL max_allowed_packet = 67108864").catch(() => {});
    conn.release();
  } catch (err) {
    console.error('Database initialization notice:', err.message);
  }
})();

module.exports = pool;
