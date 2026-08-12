# Professional Internship Backend API

ระบบ Backend สำหรับบริหารจัดการการฝึกงานนักศึกษา พัฒนาด้วย **Node.js + Express + MySQL** ออกแบบด้วยสถาปัตยกรรม **Modular Architecture** แยก Layer ชัดเจน (Config, Middlewares, Routes, Utilities, Cron Jobs) พร้อมระบบทดสอบอัตโนมัติ **Selenium E2E**

---

## 🌟 จุดเด่นของระบบ (Highlights)

- 🏗️ **Modular Architecture**: โค้ดเป็นระเบียบ สั้นกระชับ แยกไฟล์ตามหน้าที่และ Resource
- 🗄️ **Database Schema `internship_overall`**: ฐานข้อมูลมาตรฐาน 8 ตาราง เชื่อมโยง User และ Profile อย่างสมบูรณ์ พร้อมระบบ Cascade Deletion ป้องกันข้อมูลตกค้าง
- 🔐 **JWT Auth & Role-based Access**: รองรับ 4 บทบาท (`student`, `advisor`, `admin`, `public/company`)
- 🤖 **Selenium E2E Test Suite**: รันจำลองกระบวนการฝึกงานครบวงจรตั้งแต่ยื่นคำร้องจนจบการฝึกงานด้วยคำสั่งเดียว
- ⏰ **Automated Cron Jobs**: ระบบตรวจสอบวันเริ่มฝึกงานและอนุมัติเปลี่ยนสถานะคำร้องอัตโนมัติ
- 📊 **Evaluation Analytics**: ระบบประมวลผลสถิติและคะแนนประเมินนักศึกษาแยกตามสาขาวิชาและสถานประกอบการ

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
Professional-Internship-BACKEND/
├── src/
│   ├── config/
│   │   └── db.js                 # MySQL Pool Configuration
│   │
│   ├── middlewares/
│   │   └── auth.js               # JWT Verification & Role Authorization
│   │
│   ├── utils/
│   │   └── helpers.js            # toFrontendUser, Query SQL, Parsers, Formatters
│   │
│   ├── routes/
│   │   ├── authRoutes.js         # /api/auth (Login, Me)
│   │   ├── userRoutes.js         # /api/users (CRUD Users, Import, Profile Sync)
│   │   ├── requestRoutes.js      # /api/requests (คำร้อง, นัดหมายนิเทศ, ปรับสถานะ)
│   │   ├── checkinRoutes.js      # /api/checkins (เช็คชื่อรายวัน & บันทึกงาน)
│   │   ├── paymentRoutes.js      # /api/payments (หลักฐานการชำระเงิน)
│   │   ├── evaluationRoutes.js   # /api/evaluations (แบบประเมินบริษัท & อาจารย์)
│   │   ├── announcementRoutes.js # /api/announcements (ข่าวสารประชาสัมพันธ์)
│   │   ├── companyRoutes.js      # /api/public/companies (แคตตาล็อกบริษัท)
│   │   └── adminRoutes.js        # /api/admin (จัดการลบข้อมูลแบบกลุ่ม)
│   │
│   ├── cron/
│   │   └── internshipCron.js     # Cron Job ตรวจสอบวันเริ่มฝึกงานอัตโนมัติ
│   │
│   └── server.js                 # Entry Point หลัก (87 บรรทัด)
│
├── internship_overall.sql        # Database Schema สำหรับ Deploy
├── selenium_test_full_flow.js    # สคริปต์ทดสอบอัตโนมัติ Selenium E2E
├── package.json
└── README.md
```

---

## ⚙️ ความต้องการของระบบ (Prerequisites)

- **Node.js**: v18+ (แนะนำ Node.js v20 หรือ v22 LTS)
- **MySQL**: 8.x (หรือ MariaDB 10.5+ รองรับ `utf8mb4_unicode_ci`)
- **Google Chrome**: (สำหรับรัน Selenium E2E Test)

---

## 🚀 การติดตั้งและเริ่มต้นใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables
คัดลอกและสร้างไฟล์ `.env`:
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=internship_overall
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
```

### 3. นำเข้าฐานข้อมูล (Import Database)
นำเข้าไฟล์ [internship_overall.sql](file:///g:/Professional%20Internship/Professional-Internship-BACKEND/internship_overall.sql) เข้าสู่ MySQL:
```bash
mysql -u root -p internship_overall < internship_overall.sql
```

### 4. รันเซิร์ฟเวอร์ (Start Server)
```bash
# โหมดพัฒนา (Hot-reload ด้วย Nodemon)
npm run dev

# โหมด Production
npm start
```
เซิร์ฟเวอร์จะพร้อมใช้งานที่ `http://localhost:5000` (Health Check: `http://localhost:5000/api/health`)

---

## 🧪 การทดสอบระบบ (Testing)

### 1. รันการทดสอบ E2E อัตโนมัติด้วย Selenium
ทดสอบจำลองผู้ใช้งานจริงครบทุก Role บนเบราว์เซอร์ Chrome:
```bash
npm run test:e2e
```
*ระบบจะทำการ seed บัญชีทดสอบ เคลียร์ข้อมูลเก่า และจำลองการทำงานตั้งแต่สร้างคำร้องจนประเมินผลเสร็จสิ้น (11/11 ขั้นตอน)*

---

## 🗄️ โครงสร้างฐานข้อมูล `internship_overall` (8 ตาราง)

| # | ตาราง | หน้าที่หลัก |
|---|---|---|
| 1 | `user` | บัญชีผู้ใช้งาน (`username`, `email`, `password`, `role`, `isActive`) |
| 2 | `profile` | ข้อมูลโปรไฟล์ (`profile_id`, `firstname`, `lastname`, `address`) |
| 3 | `requests` | ข้อมูลคำร้องฝึกงาน, สถานะ, หนังสือนำส่ง, วันนัดนิเทศ |
| 4 | `announcements` | ข่าวสารและประกาศประชาสัมพันธ์ |
| 5 | `daily_checkins` | บันทึกการเข้างานรายวันและบันทึกประสบการณ์การทำงาน |
| 6 | `evaluations` | ผลการประเมินนักศึกษาจากสถานประกอบการ (20 ข้อ + ความเห็น) |
| 7 | `advisor_evaluations` | ผลการประเมินการนิเทศจากอาจารย์ที่ปรึกษา |
| 8 | `payment_proofs` | หลักฐานสลิปการชำระเงินค่าธรรมเนียมฝึกงาน |

---

## 📡 รายการ RESTful API Endpoints

### 🔐 Authentication
- `POST /api/auth/login` — เข้าสู่ระบบ (รับ JWT Token + User Data)
- `GET /api/auth/me` — ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน

### 👥 Users Management
- `GET /api/users` — ดึงรายชื่อผู้ใช้ทั้งหมด (กรองตาม role / ค้นหา)
- `GET /api/users/:id` — ดึงข้อมูลผู้ใช้รายบุคคล
- `POST /api/users` — สร้างผู้ใช้ใหม่ (Admin)
- `POST /api/users/import` — นำเข้าผู้ใช้แบบกลุ่ม (Admin)
- `PUT /api/users/:id` — อัปเดตข้อมูลผู้ใช้และโปรไฟล์
- `DELETE /api/users/:id` — ลบผู้ใช้พร้อมข้อมูลที่เกี่ยวข้องทั้งหมด (Cascade)

### 📝 Requests (คำร้องขอฝึกงาน)
- `GET /api/requests` — ดึงรายการคำร้องทั้งหมด (กรองตาม studentId / status / dept)
- `GET /api/requests/:id` — ดึงรายละเอียดคำร้อง
- `POST /api/requests` — ยื่นคำร้องใหม่
- `PUT /api/requests/:id` — แก้ไขคำร้อง
- `PATCH /api/requests/:id/status` — อัปเดตสถานะคำร้องและคอมเมนต์
- `PATCH /api/requests/:id/appointment` — กำหนดวันนัดหมายนิเทศงาน
- `DELETE /api/requests/:id` — ลบคำร้อง

### 🕒 Daily Check-ins (การเช็คชื่อ)
- `GET /api/checkins` — ดึงประวัติการเช็คชื่อ
- `POST /api/checkins` — บันทึกการเช็คชื่อและงานรายวัน (1 ครั้ง/วัน)
- `DELETE /api/checkins/:id` — ลบรายการเช็คชื่อ

### 💳 Payments (การชำระเงิน)
- `GET /api/payments` — ดึงรายการหลักฐานชำระเงิน
- `POST /api/payments` — อัปโหลดสลิปชำระเงิน
- `PATCH /api/payments/:id/approve` — อนุมัติสลิปชำระเงิน (Admin)
- `PATCH /api/payments/:id/reject` — ปฏิเสธสลิปชำระเงิน (Admin)

### 📊 Evaluations (การประเมินผล)
- `GET /api/public/evaluate/request/:id` — ข้อมูลคำร้องสำหรับแบบประเมินบริษัท (Public)
- `POST /api/public/evaluate/:id` — บันทึกแบบประเมินจากบริษัท (Public)
- `GET /api/advisor-evaluations/request/:id` — ดึงแบบประเมินของอาจารย์
- `POST /api/advisor-evaluations/request/:id` — บันทึกแบบประเมินของอาจารย์
- `GET /api/evaluations/analytics` — รายงานสรุปคะแนนประเมินและสถิติการรับเข้าทำงาน (Admin)

### 📢 Announcements & Public
- `GET /api/public/announcements` — ข่าวประชาสัมพันธ์หน้าแรก (Public)
- `GET /api/public/companies` — แคตตาล็อกบริษัทจากรุ่นพี่ที่ฝึกงานเสร็จแล้ว (Public)
- `GET /api/announcements` — รายการข่าวทั้งหมด (Admin)
- `POST /api/announcements` — เพิ่มข่าวใหม่ (Admin)
- `PUT /api/announcements/:id` — แก้ไขข่าว (Admin)
- `DELETE /api/announcements/:id` — ลบข่าว (Admin)

---

## 🔑 บัญชีทดสอบเริ่มต้น (Default Test Accounts)

| Role | Username | Password | ชื่อ - นามสกุล |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | ผู้ดูแล ระบบ |
| **Advisor** | `advisor01` | `advisor123` | ดร.สมเกียรติ มงคลชัย |
| **Student** | `student6501` | `student123` | สมชาย รักเรียน |
