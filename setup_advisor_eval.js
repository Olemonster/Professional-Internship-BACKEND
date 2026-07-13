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
      CREATE TABLE IF NOT EXISTS advisor_evaluations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        requestId INT NOT NULL,
        advisorName VARCHAR(255) NULL,
        c1 INT NULL, c2 INT NULL, c3 INT NULL, c4 INT NULL, c5 INT NULL,
        c6 INT NULL, c7 INT NULL, c8 INT NULL, c9 INT NULL, c10 INT NULL, c11 INT NULL,
        companyComments TEXT NULL,
        s1 INT NULL, s2 INT NULL, s3 INT NULL, s4 INT NULL, s5 INT NULL,
        s6 INT NULL, s7 INT NULL, s8 INT NULL, s9 INT NULL, s10 INT NULL,
        studentComments TEXT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requestId) REFERENCES requests(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('advisor_evaluations table created.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
