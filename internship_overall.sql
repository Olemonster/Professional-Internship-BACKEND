-- ============================================================
-- SQL Script สำหรับสร้างตาราง user และ profile 
-- ใน Database: internship_overall
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
-- คำสั่ง ALTER TABLE กรณีมีตาราง profile อยู่แล้วในระบบ
-- ------------------------------------------------------------
-- ALTER TABLE `profile` ADD COLUMN `address` TEXT DEFAULT NULL AFTER `department_id`;

