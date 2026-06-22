const mysql = require('mysql2/promise');
require('dotenv').config();

async function deleteUsers() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4',
    });

    console.log('✅ เชื่อมต่อ MySQL สำเร็จ กำลังลบข้อมูลเก่า...');
    
    // ลบนักศึกษา, อาจารย์ และ แอดมิน
    const [result] = await connection.query(
      `DELETE FROM users WHERE role IN ('student', 'advisor', 'admin')`
    );
    
    console.log(`🗑️ ลบผู้ใช้งานไปทั้งหมด ${result.affectedRows} บัญชี`);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

deleteUsers();
