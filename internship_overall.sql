-- ============================================================
-- internship_overall — Complete Deployment Schema
-- Database: internship_overall
-- Generated: 2026-08-13
-- ============================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET FOREIGN_KEY_CHECKS = 0;
START TRANSACTION;
SET time_zone = "+00:00";
SET NAMES utf8mb4;

-- Safe table creation (will NOT drop existing tables or delete data)

-- 1. user
CREATE TABLE IF NOT EXISTS `user` (
  `id`        int(11)      NOT NULL AUTO_INCREMENT,
  `username`  varchar(191) NOT NULL,
  `email`     varchar(191) NOT NULL,
  `password`  varchar(191) NOT NULL,
  `role`      enum('student','alumni','admin','advisor') NOT NULL DEFAULT 'student',
  `isActive`  tinyint(1)   NOT NULL DEFAULT 1,
  `createdAt` datetime(3)  NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3)  NOT NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_username_key` (`username`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. profile
CREATE TABLE IF NOT EXISTS `profile` (
  `id`            int(11)      NOT NULL AUTO_INCREMENT,
  `profile_id`    varchar(191) NOT NULL,
  `firstname`     varchar(100) NOT NULL DEFAULT '',
  `lastname`      varchar(100) NOT NULL DEFAULT '',
  `faculty_id`    int(11)      NOT NULL DEFAULT 0,
  `department_id` int(11)      NOT NULL DEFAULT 0,
  `address`       text         DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_profile_id` (`profile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. requests
CREATE TABLE IF NOT EXISTS `requests` (
  `id`                     int(11)      NOT NULL AUTO_INCREMENT,
  `studentId`              varchar(50)  NOT NULL,
  `studentName`            varchar(255) DEFAULT NULL,
  `department`             varchar(200) DEFAULT NULL,
  `company`                varchar(255) DEFAULT NULL,
  `position`               varchar(200) DEFAULT NULL,
  `submittedDate`          datetime     DEFAULT NULL,
  `status`                 varchar(100) DEFAULT 'รออาจารย์ที่ปรึกษาอนุมัติ',
  `details`                longtext     DEFAULT NULL CHECK (json_valid(`details`)),
  `admin_comment`          text         DEFAULT NULL,
  `advisor_comment`        text         DEFAULT NULL,
  `dispatchLetter`         longtext     DEFAULT NULL,
  `supervisionAppointment` longtext     DEFAULT NULL CHECK (json_valid(`supervisionAppointment`)),
  `created_at`             timestamp    NOT NULL DEFAULT current_timestamp(),
  `updated_at`             timestamp    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_requests_studentId` (`studentId`),
  KEY `idx_requests_status`    (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. announcements
CREATE TABLE IF NOT EXISTS `announcements` (
  `id`         int(11)      NOT NULL AUTO_INCREMENT,
  `title`      varchar(500) NOT NULL,
  `content`    text         NOT NULL,
  `category`   varchar(100) DEFAULT 'ทั่วไป',
  `coverImage` longtext     DEFAULT NULL,
  `is_pinned`  tinyint(1)   DEFAULT 0,
  `is_active`  tinyint(1)   DEFAULT 1,
  `author`     varchar(255) DEFAULT NULL,
  `created_at` timestamp    NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. daily_checkins
CREATE TABLE IF NOT EXISTS `daily_checkins` (
  `id`              int(11)      NOT NULL AUTO_INCREMENT,
  `studentId`       varchar(50)  NOT NULL,
  `studentName`     varchar(255) DEFAULT NULL,
  `date`            date         NOT NULL,
  `status`          enum('present','late','absent') DEFAULT 'present',
  `note`            text         DEFAULT NULL,
  `work_experience` text         DEFAULT NULL,
  `createdAt`       datetime     DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_date` (`studentId`, `date`),
  KEY `idx_daily_checkins_studentId` (`studentId`),
  KEY `idx_daily_checkins_date`      (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. evaluations
CREATE TABLE IF NOT EXISTS `evaluations` (
  `id`                   int(11)      NOT NULL AUTO_INCREMENT,
  `requestId`            int(11)      NOT NULL,
  `studentId`            varchar(50)  NOT NULL,
  `evaluatorName`        varchar(255) DEFAULT NULL,
  `evaluatorPosition`    varchar(255) DEFAULT NULL,
  `evaluatorDepartment`  varchar(255) DEFAULT NULL,
  `q1`  int(11) DEFAULT NULL, `q2`  int(11) DEFAULT NULL, `q3`  int(11) DEFAULT NULL,
  `q4`  int(11) DEFAULT NULL, `q5`  int(11) DEFAULT NULL, `q6`  int(11) DEFAULT NULL,
  `q7`  int(11) DEFAULT NULL, `q8`  int(11) DEFAULT NULL, `q9`  int(11) DEFAULT NULL,
  `q10` int(11) DEFAULT NULL, `q11` int(11) DEFAULT NULL, `q12` int(11) DEFAULT NULL,
  `q13` int(11) DEFAULT NULL, `q14` int(11) DEFAULT NULL, `q15` int(11) DEFAULT NULL,
  `q16` int(11) DEFAULT NULL, `q17` int(11) DEFAULT NULL, `q18` int(11) DEFAULT NULL,
  `q19` int(11) DEFAULT NULL, `q20` int(11) DEFAULT NULL,
  `strengths`     text         DEFAULT NULL,
  `improvements`  text         DEFAULT NULL,
  `hireFuture`    varchar(50)  DEFAULT NULL,
  `overallScore`  varchar(50)  DEFAULT NULL,
  `projectUsage`  varchar(100) DEFAULT NULL,
  `otherComments` text         DEFAULT NULL,
  `signature`     longtext     DEFAULT NULL,
  `createdAt`     timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `requestId` (`requestId`),
  CONSTRAINT `evaluations_ibfk_1` FOREIGN KEY (`requestId`) REFERENCES `requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. advisor_evaluations
CREATE TABLE IF NOT EXISTS `advisor_evaluations` (
  `id`              int(11)      NOT NULL AUTO_INCREMENT,
  `requestId`       int(11)      NOT NULL,
  `advisorName`     varchar(255) DEFAULT NULL,
  `c1`  int(11) DEFAULT NULL, `c2`  int(11) DEFAULT NULL, `c3`  int(11) DEFAULT NULL,
  `c4`  int(11) DEFAULT NULL, `c5`  int(11) DEFAULT NULL, `c6`  int(11) DEFAULT NULL,
  `c7`  int(11) DEFAULT NULL, `c8`  int(11) DEFAULT NULL, `c9`  int(11) DEFAULT NULL,
  `c10` int(11) DEFAULT NULL, `c11` int(11) DEFAULT NULL, `c12` int(11) DEFAULT NULL,
  `c13` int(11) DEFAULT NULL, `c14` int(11) DEFAULT NULL, `c15` int(11) DEFAULT NULL,
  `c16` int(11) DEFAULT NULL, `c17` int(11) DEFAULT NULL,
  `companyComments` text         DEFAULT NULL,
  `s1`  int(11) DEFAULT NULL, `s2`  int(11) DEFAULT NULL, `s3`  int(11) DEFAULT NULL,
  `s4`  int(11) DEFAULT NULL, `s5`  int(11) DEFAULT NULL, `s6`  int(11) DEFAULT NULL,
  `s7`  int(11) DEFAULT NULL, `s8`  int(11) DEFAULT NULL, `s9`  int(11) DEFAULT NULL,
  `s10` int(11) DEFAULT NULL, `s11` int(11) DEFAULT NULL, `s12` int(11) DEFAULT NULL,
  `s13` int(11) DEFAULT NULL, `s14` int(11) DEFAULT NULL, `s15` int(11) DEFAULT NULL,
  `s16` int(11) DEFAULT NULL, `s17` int(11) DEFAULT NULL, `s18` int(11) DEFAULT NULL,
  `s19` int(11) DEFAULT NULL, `s20` int(11) DEFAULT NULL,
  `studentComments` text         DEFAULT NULL,
  `createdAt`       timestamp    NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `requestId` (`requestId`),
  CONSTRAINT `advisor_evaluations_ibfk_1` FOREIGN KEY (`requestId`) REFERENCES `requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. payment_proofs
CREATE TABLE IF NOT EXISTS `payment_proofs` (
  `id`           int(11)      NOT NULL AUTO_INCREMENT,
  `studentId`    varchar(50)  NOT NULL,
  `studentName`  varchar(255) DEFAULT NULL,
  `date`         varchar(50)  DEFAULT NULL,
  `status`       enum('pending','approved','rejected') DEFAULT 'pending',
  `department`   varchar(200) DEFAULT NULL,
  `slipDataUrl`  longtext     DEFAULT NULL,
  `slipFileName` varchar(255) DEFAULT NULL,
  `created_at`   timestamp    NOT NULL DEFAULT current_timestamp(),
  `updated_at`   timestamp    NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_payment_proofs_studentId` (`studentId`),
  KEY `idx_payment_proofs_status`    (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
