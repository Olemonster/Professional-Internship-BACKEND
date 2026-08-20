-- ============================================================
-- Official Production SQL Schema for Professional Internship System
-- Database: internship_overall
-- Based on official phpMyAdmin structure (Table: user)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `internship_overall`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `internship_overall`;

-- ------------------------------------------------------------
-- 1. Structure for table `user`
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` ENUM('student', 'alumni', 'admin', 'advisor', 'company') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'student',
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `studentId` VARCHAR(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'รหัสนักศึกษา',
  `department` VARCHAR(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'สาขาวิชา',
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_username_key` (`username`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. Structure for table `profile`
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `profile` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `profile_id` VARCHAR(13) COLLATE utf8mb4_general_ci NOT NULL,
  `firstname` VARCHAR(20) COLLATE utf8mb4_general_ci NOT NULL,
  `lastname` VARCHAR(20) COLLATE utf8mb4_general_ci NOT NULL,
  `faculty_id` INT(11) NOT NULL,
  `department_id` INT(11) NOT NULL,
  `address` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. Compatibility VIEW `users`
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW `users` AS SELECT * FROM `user`;

-- ------------------------------------------------------------
-- 4. Structure for table `requests` (คำร้องฝึกงาน)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studentId` VARCHAR(50) NOT NULL COMMENT 'รหัสนักศึกษา',
  `studentName` VARCHAR(255) DEFAULT NULL,
  `department` VARCHAR(200) DEFAULT NULL,
  `company` VARCHAR(255) DEFAULT NULL COMMENT 'ชื่อบริษัท',
  `position` VARCHAR(200) DEFAULT NULL,
  `submittedDate` DATETIME DEFAULT NULL,
  `status` VARCHAR(100) DEFAULT 'รออาจารย์ที่ปรึกษาอนุมัติ' COMMENT 'สถานะภาษาไทย',
  `details` JSON DEFAULT NULL COMMENT 'ข้อมูลรายละเอียดทั้งหมด',
  `admin_comment` TEXT DEFAULT NULL,
  `advisor_comment` TEXT DEFAULT NULL,
  `dispatchLetter` LONGTEXT DEFAULT NULL COMMENT 'JSON: หนังสือส่งตัว',
  `supervisionAppointment` LONGTEXT DEFAULT NULL COMMENT 'ข้อมูลนัดหมายนิเทศงาน',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_requests_studentId` (`studentId`),
  INDEX `idx_requests_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. Structure for table `daily_checkins` (เช็คชื่อรายวัน)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `daily_checkins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studentId` VARCHAR(50) NOT NULL COMMENT 'รหัสนักศึกษา',
  `studentName` VARCHAR(255) DEFAULT NULL,
  `date` DATE NOT NULL,
  `status` ENUM('present', 'late', 'absent') DEFAULT 'present',
  `note` TEXT DEFAULT NULL,
  `work_experience` TEXT DEFAULT NULL,
  `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_student_date` (`studentId`, `date`),
  INDEX `idx_daily_checkins_studentId` (`studentId`),
  INDEX `idx_daily_checkins_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6. Structure for table `payment_proofs` (หลักฐานชำระเงิน)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payment_proofs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `studentId` VARCHAR(50) NOT NULL,
  `studentName` VARCHAR(255) DEFAULT NULL,
  `date` VARCHAR(50) DEFAULT NULL,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `department` VARCHAR(200) DEFAULT NULL,
  `slipDataUrl` LONGTEXT DEFAULT NULL,
  `slipFileName` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_payment_proofs_studentId` (`studentId`),
  INDEX `idx_payment_proofs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 7. Structure for table `announcements` (ข่าวประกาศ)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `announcements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(500) NOT NULL,
  `content` TEXT NOT NULL,
  `category` ENUM('รับสมัคร', 'ประกาศ', 'กิจกรรม', 'ทั่วไป') DEFAULT 'ทั่วไป',
  `coverImage` LONGTEXT DEFAULT NULL,
  `is_pinned` TINYINT(1) DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `author` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 8. Structure for table `evaluations` (การประเมินโดยบริษัท)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `evaluations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `requestId` INT NOT NULL,
  `studentId` VARCHAR(50) NOT NULL,
  `evaluatorName` VARCHAR(255) DEFAULT NULL,
  `evaluatorPosition` VARCHAR(255) DEFAULT NULL,
  `evaluatorDepartment` VARCHAR(255) DEFAULT NULL,
  `q1` INT DEFAULT NULL, `q2` INT DEFAULT NULL, `q3` INT DEFAULT NULL, `q4` INT DEFAULT NULL, `q5` INT DEFAULT NULL,
  `q6` INT DEFAULT NULL, `q7` INT DEFAULT NULL, `q8` INT DEFAULT NULL, `q9` INT DEFAULT NULL, `q10` INT DEFAULT NULL,
  `q11` INT DEFAULT NULL, `q12` INT DEFAULT NULL, `q13` INT DEFAULT NULL, `q14` INT DEFAULT NULL, `q15` INT DEFAULT NULL,
  `q16` INT DEFAULT NULL, `q17` INT DEFAULT NULL, `q18` INT DEFAULT NULL, `q19` INT DEFAULT NULL, `q20` INT DEFAULT NULL,
  `strengths` TEXT DEFAULT NULL,
  `improvements` TEXT DEFAULT NULL,
  `hireFuture` VARCHAR(50) DEFAULT NULL,
  `overallScore` VARCHAR(50) DEFAULT NULL,
  `projectUsage` VARCHAR(100) DEFAULT NULL,
  `otherComments` TEXT DEFAULT NULL,
  `signature` LONGTEXT DEFAULT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_evaluations_requestId` (`requestId`),
  CONSTRAINT `fk_evaluations_requestId` FOREIGN KEY (`requestId`) REFERENCES `requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 9. Structure for table `advisor_evaluations` (การประเมินโดยอาจารย์)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `advisor_evaluations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `requestId` INT NOT NULL,
  `advisorName` VARCHAR(255) DEFAULT NULL,
  `c1` INT DEFAULT NULL, `c2` INT DEFAULT NULL, `c3` INT DEFAULT NULL, `c4` INT DEFAULT NULL, `c5` INT DEFAULT NULL,
  `c6` INT DEFAULT NULL, `c7` INT DEFAULT NULL, `c8` INT DEFAULT NULL, `c9` INT DEFAULT NULL, `c10` INT DEFAULT NULL,
  `c11` INT DEFAULT NULL, `c12` INT DEFAULT NULL, `c13` INT DEFAULT NULL, `c14` INT DEFAULT NULL, `c15` INT DEFAULT NULL,
  `c16` INT DEFAULT NULL, `c17` INT DEFAULT NULL,
  `companyComments` TEXT DEFAULT NULL,
  `s1` INT DEFAULT NULL, `s2` INT DEFAULT NULL, `s3` INT DEFAULT NULL, `s4` INT DEFAULT NULL, `s5` INT DEFAULT NULL,
  `s6` INT DEFAULT NULL, `s7` INT DEFAULT NULL, `s8` INT DEFAULT NULL, `s9` INT DEFAULT NULL, `s10` INT DEFAULT NULL,
  `s11` INT DEFAULT NULL, `s12` INT DEFAULT NULL, `s13` INT DEFAULT NULL, `s14` INT DEFAULT NULL, `s15` INT DEFAULT NULL,
  `s16` INT DEFAULT NULL, `s17` INT DEFAULT NULL, `s18` INT DEFAULT NULL, `s19` INT DEFAULT NULL, `s20` INT DEFAULT NULL,
  `studentComments` TEXT DEFAULT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_advisor_evaluations_requestId` (`requestId`),
  CONSTRAINT `fk_advisor_evaluations_requestId` FOREIGN KEY (`requestId`) REFERENCES `requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
