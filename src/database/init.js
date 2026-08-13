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

    const dbName = process.env.DB_NAME || 'internship_overall';

    // สร้างและเลือกฐานข้อมูลเป้าหมายก่อน
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);

    // 1. อ่านและรัน internship_overall.sql ถ้ามีอยู่
    const overallSqlPath = path.join(__dirname, '../../internship_overall.sql');
    if (fs.existsSync(overallSqlPath)) {
      const overallSql = fs.readFileSync(overallSqlPath, 'utf8');
      await connection.query(overallSql);
      console.log('✅ โหลดตารางจาก internship_overall.sql สำเร็จ');
    }

    // 2. อ่านและรัน SQL schema เพื่อเติมตารางเพิ่มเติมที่ระบบต้องใช้งาน
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await connection.query(sql);
      console.log('✅ สร้าง/เสริมตารางฐานข้อมูลสำเร็จ');
    }
    const adminPassword = await bcrypt.hash('admin123', 10);
    await connection.query(
      `INSERT IGNORE INTO users (username, email, password, name, role)
       VALUES (?, ?, ?, ?, 'admin')`,
      ['admin', 'admin@example.com', adminPassword, 'Admin User']
    );
    console.log('✅ สร้าง Admin เริ่มต้นสำเร็จ (admin / admin123)');

    // เพิ่มข้อมูลตัวอย่าง
    const demoPassword = await bcrypt.hash('password', 10);

    // อาจารย์ที่ปรึกษา
    await connection.query(
      `INSERT IGNORE INTO users (username, email, password, name, role, department) VALUES
       (?, ?, ?, 'Dr. Advisor', 'advisor', 'สาขาวิชาวิทยาการคอมพิวเตอร์')`,
      ['advisor', 'advisor@example.com', demoPassword]
    );

    // นักศึกษาตัวอย่าง
    await connection.query(
      `INSERT IGNORE INTO users (username, email, password, name, role, studentId, department) VALUES
       (?, ?, ?, 'สมชาย ใจดี', 'student', '65000001', 'สาขาวิชาวิทยาการคอมพิวเตอร์')`,
      ['student1', 'student1@example.com', demoPassword]
    );
    await connection.query(
      `INSERT IGNORE INTO users (username, email, password, name, role, studentId, department) VALUES
       (?, ?, ?, 'สมหญิง รักเรียน', 'student', '65000002', 'สาขาวิชาเทคโนโลยีคอมพิวเตอร์และดิจิทัล')`,
      ['student2', 'student2@example.com', demoPassword]
    );

    // บริษัทตัวอย่าง
    await connection.query(
      `INSERT IGNORE INTO users (username, email, password, name, role, address, phone, contactPerson) VALUES
       (?, ?, ?, 'บริษัท เทคโนโลยี จำกัด', 'company', '123 ถ.สุขุมวิท กรุงเทพฯ', '021234567', 'คุณสมศักดิ์')`,
      ['company1', 'company1@example.com', demoPassword]
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
