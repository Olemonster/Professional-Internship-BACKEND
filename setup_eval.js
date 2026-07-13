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
      CREATE TABLE IF NOT EXISTS evaluations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        requestId INT NOT NULL,
        studentId VARCHAR(50) NOT NULL,
        evaluatorName VARCHAR(255) NULL,
        evaluatorPosition VARCHAR(255) NULL,
        evaluatorDepartment VARCHAR(255) NULL,
        q1 INT NULL, q2 INT NULL, q3 INT NULL, q4 INT NULL, q5 INT NULL,
        q6 INT NULL, q7 INT NULL, q8 INT NULL, q9 INT NULL, q10 INT NULL,
        q11 INT NULL, q12 INT NULL, q13 INT NULL, q14 INT NULL, q15 INT NULL,
        q16 INT NULL, q17 INT NULL, q18 INT NULL, q19 INT NULL, q20 INT NULL,
        strengths TEXT NULL,
        improvements TEXT NULL,
        hireFuture VARCHAR(50) NULL,
        overallScore VARCHAR(50) NULL,
        projectUsage VARCHAR(100) NULL,
        otherComments TEXT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requestId) REFERENCES requests(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Evaluations table created.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
