# Professional Internship Backend API

ระบบ Backend สำหรับบริหารจัดการฝึกงานนักศึกษา พัฒนาด้วย **Node.js + Express + MySQL**

## โครงสร้างโปรเจค

```
src/
├── config/
│   └── db.js                 # MySQL connection pool
├── controllers/
│   ├── authController.js     # Login, Register, Profile
│   ├── userController.js     # CRUD ผู้ใช้ (Admin)
│   ├── studentController.js  # จัดการนักศึกษา
│   ├── companyController.js  # จัดการบริษัท
│   ├── advisorController.js  # จัดการอาจารย์ที่ปรึกษา
│   ├── requestController.js  # คำร้องขอฝึกงาน
│   ├── checkinController.js  # เช็คชื่อรายวัน
│   ├── paymentController.js  # การชำระเงิน
│   └── notificationController.js
├── database/
│   ├── schema.sql            # SQL สร้างตาราง
│   ├── seed.sql              # ข้อมูลตัวอย่าง
│   └── init.js               # Script สร้าง DB อัตโนมัติ
├── middleware/
│   ├── auth.js               # JWT authentication & authorization
│   ├── errorHandler.js       # Global error handler
│   └── validate.js           # Request validation
├── models/
│   ├── User.js
│   ├── Student.js
│   ├── Company.js
│   ├── Advisor.js
│   ├── Request.js
│   ├── DailyCheckin.js
│   ├── Payment.js
│   └── Notification.js
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── studentRoutes.js
│   ├── companyRoutes.js
│   ├── advisorRoutes.js
│   ├── requestRoutes.js
│   ├── checkinRoutes.js
│   ├── paymentRoutes.js
│   └── notificationRoutes.js
└── server.js                 # Entry point
```

## ติดตั้งและเริ่มต้น

### 1. ติดตั้ง Dependencies

```bash
npm install
```

### 2. ตั้งค่า Environment

คัดลอก `.env.example` เป็น `.env` แล้วแก้ไขค่าต่างๆ:

```bash
cp .env.example .env
```

แก้ไข `.env`:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=internship_db
JWT_SECRET=your_secret_key
```

### 3. สร้างฐานข้อมูล

```bash
npm run db:init
```

คำสั่งนี้จะ:
- สร้าง database `internship_db`
- สร้างตารางทั้งหมด (8 ตาราง)
- สร้าง Admin เริ่มต้น (admin@internship.com / admin123)

### 4. รันเซิร์ฟเวอร์

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

เซิร์ฟเวอร์จะรันที่ `http://localhost:5000`

---

## ฐานข้อมูล (8 ตาราง)

| ตาราง | คำอธิบาย |
|-------|---------|
| `users` | ผู้ใช้งานทั้งหมด (4 บทบาท: student, company, advisor, admin) |
| `students` | ข้อมูลนักศึกษา (รหัส, สาขา, สถานะฝึกงาน) |
| `companies` | ข้อมูลบริษัท (ชื่อ, ที่อยู่, จำนวนรับ) |
| `advisors` | ข้อมูลอาจารย์ที่ปรึกษา |
| `requests` | คำร้องขอฝึกงาน |
| `daily_checkins` | เช็คชื่อรายวัน |
| `payments` | การชำระเงิน |
| `notifications` | แจ้งเตือน |

---

## API Endpoints

### Authentication
| Method | Endpoint | คำอธิบาย | สิทธิ์ |
|--------|----------|---------|-------|
| POST | `/api/auth/login` | เข้าสู่ระบบ | Public |
| POST | `/api/auth/register` | สมัครสมาชิก | Public |
| GET | `/api/auth/me` | ดูข้อมูลตัวเอง | All |
| PUT | `/api/auth/change-password` | เปลี่ยนรหัสผ่าน | All |

### Users (Admin only)
| Method | Endpoint | คำอธิบาย |
|--------|----------|---------|
| GET | `/api/users` | ดูผู้ใช้ทั้งหมด |
| GET | `/api/users/:id` | ดูผู้ใช้ตาม ID |
| PUT | `/api/users/:id` | แก้ไขผู้ใช้ |
| DELETE | `/api/users/:id` | ลบผู้ใช้ |
| PATCH | `/api/users/:id/toggle-active` | เปิด/ปิดการใช้งาน |

### Students
| Method | Endpoint | คำอธิบาย | สิทธิ์ |
|--------|----------|---------|-------|
| GET | `/api/students` | ดูนักศึกษาทั้งหมด | Admin, Advisor |
| GET | `/api/students/me` | ดูข้อมูลตัวเอง | Student |
| GET | `/api/students/departments` | ดูรายชื่อสาขา | All |
| GET | `/api/students/:id` | ดูนักศึกษาตาม ID | Admin, Advisor, Company |
| PUT | `/api/students/:id` | แก้ไขข้อมูล | Admin |

### Companies
| Method | Endpoint | คำอธิบาย | สิทธิ์ |
|--------|----------|---------|-------|
| GET | `/api/companies` | ดูบริษัททั้งหมด | All (logged in) |
| GET | `/api/companies/me` | ดูข้อมูลบริษัทตัวเอง | Company |
| GET | `/api/companies/:id` | ดูบริษัทตาม ID | All (logged in) |
| PUT | `/api/companies/:id` | แก้ไขข้อมูล | Admin, Company |
| PATCH | `/api/companies/:id/verify` | ยืนยันบริษัท | Admin |

### Advisors
| Method | Endpoint | คำอธิบาย | สิทธิ์ |
|--------|----------|---------|-------|
| GET | `/api/advisors` | ดูอาจารย์ทั้งหมด | Admin |
| GET | `/api/advisors/me` | ดูข้อมูลตัวเอง | Advisor |
| GET | `/api/advisors/me/students` | ดูนักศึกษาที่ดูแล | Advisor |

### Requests (คำร้อง)
| Method | Endpoint | คำอธิบาย | สิทธิ์ |
|--------|----------|---------|-------|
| GET | `/api/requests` | ดูคำร้องทั้งหมด | Admin, Advisor |
| GET | `/api/requests/me` | ดูคำร้องของตัวเอง | Student |
| GET | `/api/requests/summary` | สรุปสถานะคำร้อง | Admin |
| POST | `/api/requests` | ส่งคำร้อง | Student |
| PATCH | `/api/requests/:id/status` | อัปเดตสถานะ | Admin, Advisor |

### Check-ins (เช็คชื่อ)
| Method | Endpoint | คำอธิบาย | สิทธิ์ |
|--------|----------|---------|-------|
| GET | `/api/checkins` | ดูเช็คชื่อทั้งหมด | Admin, Advisor, Company |
| GET | `/api/checkins/summary` | ภาพรวมรายบุคคล | Admin |
| GET | `/api/checkins/summary/:studentId` | สรุปของนักศึกษา | Admin, Advisor, Student |
| POST | `/api/checkins` | เช็คชื่อ (นักศึกษา) | Student |
| POST | `/api/checkins/admin` | บันทึกเช็คชื่อ (Admin) | Admin |
| PATCH | `/api/checkins/:id/checkout` | เช็คเอาท์ | Student, Company |

### Payments (การชำระเงิน)
| Method | Endpoint | คำอธิบาย | สิทธิ์ |
|--------|----------|---------|-------|
| GET | `/api/payments` | ดูทั้งหมด | Admin |
| GET | `/api/payments/me` | ดูของตัวเอง | Student |
| POST | `/api/payments` | ส่งหลักฐาน | Student |
| PATCH | `/api/payments/:id/verify` | ตรวจสอบ | Admin |

### Notifications (แจ้งเตือน)
| Method | Endpoint | คำอธิบาย | สิทธิ์ |
|--------|----------|---------|-------|
| GET | `/api/notifications` | ดูแจ้งเตือน | All |
| PATCH | `/api/notifications/:id/read` | อ่านแจ้งเตือน | All |
| PATCH | `/api/notifications/read-all` | อ่านทั้งหมด | All |

---

## Authentication

ใช้ JWT Bearer Token:

```
Authorization: Bearer <token>
```

ได้ token จาก `/api/auth/login` หรือ `/api/auth/register`
