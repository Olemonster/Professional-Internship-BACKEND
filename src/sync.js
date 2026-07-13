const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
  await pool.query("UPDATE requests r JOIN evaluations e ON r.id = e.requestId SET r.status = 'ประเมินเสร็จแล้ว' WHERE r.status = 'ออกฝึกงาน'");
  console.log('Sync complete');
  process.exit(0);
}

run();
