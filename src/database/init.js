const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true,
      charset: 'utf8mb4',
    });

    console.log('✅ เชื่อมต่อ MySQL สำเร็จ');

    // อ่านและรัน SQL schema (จะ DROP แล้วสร้างใหม่)
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(sql);
    console.log('✅ สร้างฐานข้อมูลและตารางสำเร็จ');

    // เพิ่ม Admin เริ่มต้น
    await connection.query('USE internship_db');
    const adminPassword = await bcrypt.hash('admin123', 10);
    await connection.query(
      `INSERT IGNORE INTO users (username, password, name, role)
       VALUES (?, ?, ?, 'admin')`,
      ['admin', adminPassword, 'Admin User']
    );
    console.log('✅ สร้าง Admin เริ่มต้นสำเร็จ (admin / admin123)');

    // เพิ่มข้อมูลตัวอย่าง
    const demoPassword = await bcrypt.hash('password', 10);

    // อาจารย์ที่ปรึกษา
    await connection.query(
      `INSERT IGNORE INTO users (username, password, name, role, department) VALUES
       (?, ?, 'Dr. Advisor', 'advisor', 'สาขาวิชาวิทยาการคอมพิวเตอร์')`,
      ['advisor', demoPassword]
    );

    // นักศึกษาตัวอย่าง
    await connection.query(
      `INSERT IGNORE INTO users (username, password, name, role, studentId, department) VALUES
       (?, ?, 'สมชาย ใจดี', 'student', '65000001', 'สาขาวิชาวิทยาการคอมพิวเตอร์')`,
      ['student1', demoPassword]
    );
    await connection.query(
      `INSERT IGNORE INTO users (username, password, name, role, studentId, department) VALUES
       (?, ?, 'สมหญิง รักเรียน', 'student', '65000002', 'สาขาวิชาเทคโนโลยีคอมพิวเตอร์และดิจิทัล')`,
      ['student2', demoPassword]
    );

    // บริษัทตัวอย่าง
    await connection.query(
      `INSERT IGNORE INTO users (username, password, name, role, address, phone, contactPerson) VALUES
       (?, ?, 'บริษัท เทคโนโลยี จำกัด', 'company', '123 ถ.สุขุมวิท กรุงเทพฯ', '021234567', 'คุณสมศักดิ์')`,
      ['company1', demoPassword]
    );

    console.log('✅ สร้างข้อมูลตัวอย่างสำเร็จ');
    console.log('\n🎉 เริ่มต้นฐานข้อมูลเสร็จสมบูรณ์!');
    console.log('\n📋 บัญชีทดสอบ:');
    console.log('   Admin:    admin / admin123');
    console.log('   Advisor:  advisor / password');
    console.log('   Student:  student1 / password');
    console.log('   Student:  student2 / password');
    console.log('   Company:  company1 / password');
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initDatabase();
