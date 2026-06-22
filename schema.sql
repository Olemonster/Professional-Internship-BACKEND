-- =============================================
-- Database Schema สำหรับระบบบริหารจัดการฝึกงาน
-- สร้างจากโครงสร้างที่ถูกใช้งานในไฟล์ server.js
-- =============================================

-- 1. ตาราง users (เก็บข้อมูลผู้ใช้งานทั้งหมด)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) NOT NULL UNIQUE,  -- ใช้เป็นอีเมล
  `password` VARCHAR(255) NOT NULL,         -- เก็บแบบ Hashed
  `name` VARCHAR(255) NOT NULL,             -- ชื่อ-นามสกุล / ชื่อบริษัท
  `role` VARCHAR(50) NOT NULL DEFAULT 'student', -- admin, student, company
  `studentId` VARCHAR(50) NULL,             -- รหัสนักศึกษา (สำหรับนักศึกษา)
  `department` VARCHAR(255) NULL,           -- สาขาวิชา
  `address` TEXT NULL,                      -- ที่อยู่
  `phone` VARCHAR(50) NULL,                 -- เบอร์โทรศัพท์
  `contactPerson` VARCHAR(255) NULL,        -- ชื่อผู้ติดต่อ (สำหรับบริษัท)
  `avatar` VARCHAR(255) NULL,               -- รูปโปรไฟล์
  `logo` VARCHAR(255) NULL,                 -- โลโก้บริษัท
  `imageUrl` VARCHAR(255) NULL,             -- รูปภาพบริษัท
  `businessType` VARCHAR(255) NULL,         -- ประเภทธุรกิจ (สำหรับบริษัท)
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,-- สถานะการใช้งานบัญชี
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. ตาราง requests (เก็บข้อมูลคำร้องขอฝึกงาน)
CREATE TABLE IF NOT EXISTS `requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studentId` VARCHAR(50) NOT NULL,         -- รหัสนักศึกษา
  `studentName` VARCHAR(255) NULL,          -- ชื่อนักศึกษา
  `department` VARCHAR(255) NULL,           -- สาขาวิชา
  `company` VARCHAR(255) NULL,              -- ชื่อบริษัทที่ขอฝึกงาน
  `companyName` VARCHAR(255) NULL,          -- ชื่อบริษัท (ใช้อ้างอิงร่วมกับ company)
  `position` VARCHAR(255) NULL,             -- ตำแหน่งที่ขอฝึกงาน
  `submittedDate` DATETIME NOT NULL,        -- วันที่ยื่นคำร้อง
  `status` VARCHAR(100) NOT NULL DEFAULT 'รออาจารย์ที่ปรึกษาอนุมัติ', -- สถานะ
  `details` JSON NULL,                      -- เก็บข้อมูลเสริม (เช่น companyAddress, contactPerson)
  `admin_comment` TEXT NULL,                -- ความเห็นแอดมิน
  `advisor_comment` TEXT NULL,              -- ความเห็นอาจารย์ที่ปรึกษา
  `company_comment` TEXT NULL,              -- ความเห็นจากบริษัท
  `dispatchLetter` JSON NULL,               -- ข้อมูลหนังสือส่งตัว
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ตาราง daily_checkins (เก็บข้อมูลการเช็คชื่อรายวัน)
CREATE TABLE IF NOT EXISTS `daily_checkins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studentId` VARCHAR(50) NOT NULL,         -- รหัสนักศึกษา
  `studentName` VARCHAR(255) NULL,          -- ชื่อนักศึกษา
  `date` DATE NOT NULL,                     -- วันที่ลงเวลา
  `status` VARCHAR(50) NOT NULL DEFAULT 'present', -- สถานะการเช็คชื่อ
  `note` TEXT NULL,                         -- หมายเหตุ
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_student_date` (`studentId`, `date`) -- ป้องกันการเช็คชื่อซ้ำในวันเดียวกัน
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. ตาราง payment_proofs (เก็บข้อมูลหลักฐานการชำระเงิน)
CREATE TABLE IF NOT EXISTS `payment_proofs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studentId` VARCHAR(50) NOT NULL,         -- รหัสนักศึกษา
  `studentName` VARCHAR(255) NULL,          -- ชื่อนักศึกษา
  `date` DATE NULL,                         -- วันที่บนสลิป/ทำรายการ
  `department` VARCHAR(255) NULL,           -- สาขาวิชา
  `slipDataUrl` LONGTEXT NULL,              -- URL หรือ Base64 รูปภาพสลิป (ใช้ LONGTEXT เผื่อเป็น Base64 ยาวๆ)
  `slipFileName` VARCHAR(255) NULL,         -- ชื่อไฟล์สลิป
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending', -- สถานะการอนุมัติ (pending, approved, rejected)
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
