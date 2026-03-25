-- =============================================
-- ฐานข้อมูลระบบบริหารจัดการฝึกงานนักศึกษา
-- ออกแบบให้ตรงกับ Frontend (localStorage structure)
-- =============================================

DROP DATABASE IF EXISTS internship_db;

CREATE DATABASE internship_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE internship_db;

-- ---------------------------------------------
-- 1. ตารางผู้ใช้งาน (Users)
-- Frontend เก็บ: id, username, password, name, role, studentId, department, address, phone, contactPerson
-- + alias fields: email, full_name, student_code, major
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE COMMENT 'ใช้เป็น email ด้วย',
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL COMMENT 'ชื่อ-นามสกุล',
  role ENUM('student', 'company', 'advisor', 'admin') NOT NULL,
  studentId VARCHAR(50) DEFAULT NULL COMMENT 'รหัสนักศึกษา',
  department VARCHAR(200) DEFAULT NULL COMMENT 'สาขาวิชา',
  address TEXT DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  contactPerson VARCHAR(200) DEFAULT NULL COMMENT 'ผู้ติดต่อ (สำหรับบริษัท)',
  avatar TEXT DEFAULT NULL COMMENT 'base64 avatar หรือ URL',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------
-- 2. ตารางคำร้อง (Requests)
-- Frontend เก็บ: id, studentId, studentName, department, company, position, submittedDate, status (ภาษาไทย), details (JSON)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  studentId VARCHAR(50) NOT NULL COMMENT 'รหัสนักศึกษา (อ้างอิงจาก users.studentId)',
  studentName VARCHAR(255) DEFAULT NULL,
  department VARCHAR(200) DEFAULT NULL,
  company VARCHAR(255) DEFAULT NULL COMMENT 'ชื่อบริษัท',
  position VARCHAR(200) DEFAULT NULL,
  submittedDate DATETIME DEFAULT NULL,
  status VARCHAR(100) DEFAULT 'รออาจารย์ที่ปรึกษาอนุมัติ' COMMENT 'สถานะภาษาไทย',
  details JSON DEFAULT NULL COMMENT 'ข้อมูลรายละเอียดทั้งหมด',
  admin_comment TEXT DEFAULT NULL,
  advisor_comment TEXT DEFAULT NULL,
  dispatchLetter LONGTEXT DEFAULT NULL COMMENT 'JSON: {fileName, mimeType, dataUrl} หนังสือส่งตัว',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------
-- 3. ตารางเช็คชื่อรายวัน (Daily Check-ins)
-- Frontend เก็บ: id, studentId, studentName, date, status (present/late/absent), note, createdAt
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS daily_checkins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  studentId VARCHAR(50) NOT NULL COMMENT 'รหัสนักศึกษา',
  studentName VARCHAR(255) DEFAULT NULL,
  date DATE NOT NULL,
  status ENUM('present', 'late', 'absent') DEFAULT 'present',
  note TEXT DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_student_date (studentId, date)
) ENGINE=InnoDB;

-- ---------------------------------------------
-- 4. ตารางหลักฐานการชำระเงิน (Payment Proofs)
-- Frontend เก็บ: id, studentId, studentName, date, status (pending/approved/rejected), department, slipDataUrl, slipFileName
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS payment_proofs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  studentId VARCHAR(50) NOT NULL,
  studentName VARCHAR(255) DEFAULT NULL,
  date VARCHAR(50) DEFAULT NULL COMMENT 'วันที่ชำระ (th-TH format)',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  department VARCHAR(200) DEFAULT NULL,
  slipDataUrl LONGTEXT DEFAULT NULL COMMENT 'base64 รูปสลิป',
  slipFileName VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------
-- Indexes
-- ---------------------------------------------
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_studentId ON users(studentId);
CREATE INDEX idx_requests_studentId ON requests(studentId);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_daily_checkins_studentId ON daily_checkins(studentId);
CREATE INDEX idx_daily_checkins_date ON daily_checkins(date);
CREATE INDEX idx_payment_proofs_studentId ON payment_proofs(studentId);
CREATE INDEX idx_payment_proofs_status ON payment_proofs(status);
