-- =============================================
-- ข้อมูลตัวอย่างสำหรับทดสอบ
-- =============================================

USE internship_db;

-- รหัสผ่านทั้งหมดคือ "password123" (bcrypt hash)
-- $2a$10$XXXXXXXXXXX... จะถูกสร้างจาก seed script

-- ตัวอย่างบริษัท (user + company)
INSERT IGNORE INTO users (id, email, password, role, first_name, last_name, phone) VALUES
(2, 'company1@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'company', 'บริษัท', 'เทคโนโลยี', '0812345678'),
(3, 'company2@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'company', 'บริษัท', 'ซอฟต์แวร์', '0823456789');

INSERT IGNORE INTO companies (user_id, company_name, business_type, address, province, max_interns) VALUES
(2, 'บริษัท เทคโนโลยี จำกัด', 'IT', '123 ถ.สุขุมวิท', 'กรุงเทพมหานคร', 5),
(3, 'บริษัท ซอฟต์แวร์เฮาส์ จำกัด', 'Software Development', '456 ถ.พหลโยธิน', 'กรุงเทพมหานคร', 3);

-- ตัวอย่างอาจารย์ที่ปรึกษา
INSERT IGNORE INTO users (id, email, password, role, first_name, last_name, phone) VALUES
(4, 'advisor1@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'advisor', 'ดร.สมชาย', 'ใจดี', '0834567890'),
(5, 'advisor2@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'advisor', 'ผศ.สมหญิง', 'รักเรียน', '0845678901');

INSERT IGNORE INTO advisors (user_id, employee_id, department, position_title, max_students) VALUES
(4, 'EMP001', 'วิทยาการคอมพิวเตอร์', 'อาจารย์', 10),
(5, 'EMP002', 'เทคโนโลยีสารสนเทศ', 'ผู้ช่วยศาสตราจารย์', 8);

-- ตัวอย่างนักศึกษา
INSERT IGNORE INTO users (id, email, password, role, first_name, last_name, phone) VALUES
(6, 'student1@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'สมศักดิ์', 'มานะ', '0856789012'),
(7, 'student2@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'สมหญิง', 'ตั้งใจ', '0867890123'),
(8, 'student3@test.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'วิชัย', 'เก่งมาก', '0878901234');

INSERT IGNORE INTO students (user_id, student_id, department, year, gpa, advisor_id, company_id, internship_status) VALUES
(6, '6401001', 'วิทยาการคอมพิวเตอร์', 4, 3.25, 4, 2, 'in_progress'),
(7, '6401002', 'เทคโนโลยีสารสนเทศ', 4, 3.50, 5, 3, 'in_progress'),
(8, '6401003', 'วิทยาการคอมพิวเตอร์', 4, 2.80, 4, NULL, 'pending');
