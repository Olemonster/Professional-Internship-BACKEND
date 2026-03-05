# Professional Internship Backend API

ระบบ Backend สำหรับบริหารจัดการฝึกงานนักศึกษา พัฒนาด้วย **Node.js + Express + MySQL** โดยรวมทุก business logic ไว้ใน `src/server.js` ไฟล์เดียว พร้อมสคริปต์ช่วยสร้างฐานข้อมูลและข้อมูลตัวอย่างสำหรับใช้งานทันที

## Highlights

- ⚙️ RESTful API ครอบคลุมการจัดการผู้ใช้ คำร้อง ขออนุมัติ เช็คชื่อ และการชำระเงิน
- 🗄️ ใช้ `mysql2/promise` สร้าง connection pool รองรับพร้อมกันหลายคำขอ
- 🔐 JWT Authentication + Role-based Authorization (student, company, advisor, admin)
- 🚀 `npm run db:init` สร้างฐานข้อมูล `internship_db` และ seed บัญชีตัวอย่างให้อัตโนมัติ
- 🌐 Endpoint สุขภาพ `/api/health` ตรวจสอบสถานะการทำงานของเซิร์ฟเวอร์ได้ทันที

## โครงสร้างโปรเจกต์

```
├── .env.example            # ตัวอย่าง environment variables
├── package.json
└── src/
    ├── database/
    │   ├── init.js        # สคริปต์สร้าง DB + seed ข้อมูล
    │   ├── schema.sql     # คำสั่งสร้างตารางทั้งหมด
    │   └── seed.sql       # (ออปชัน) สำหรับเติมข้อมูลเพิ่ม
    └── server.js          # Express server (รวม middleware + routes)
```

> หมายเหตุ: โฟลเดอร์ controllers/models/middleware ถูกยุบรวมมาอยู่ใน `server.js` เพื่อลดความซับซ้อนและง่ายต่อการ deploy

## ความต้องการระบบ

- Node.js 18+ (แนะนำ LTS)
- MySQL 8.x (หรือ MariaDB ที่รองรับ `utf8mb4`)

## การติดตั้งและเริ่มต้นใช้งาน

### 1. ติดตั้ง dependencies

```bash
npm install
```

### 2. ตั้งค่า Environment Variables

คัดลอกไฟล์ตัวอย่างและปรับค่าที่ต้องการ

```bash
cp .env.example .env
```

| ตัวแปร | ค่าเริ่มต้น | รายละเอียด |
|---------|-------------|-------------|
| `PORT` | 5000 | พอร์ตที่ Express ใช้งาน |
| `NODE_ENV` | development | โหมดรัน (development / production) |
| `DB_HOST` | localhost | ที่อยู่เซิร์ฟเวอร์ MySQL |
| `DB_PORT` | 3306 | พอร์ต MySQL |
| `DB_USER` | root | ชื่อผู้ใช้ฐานข้อมูล |
| `DB_PASSWORD` | your_password_here | รหัสผ่านฐานข้อมูล |
| `DB_NAME` | internship_db | ชื่อฐานข้อมูลหลัก |
| `JWT_SECRET` | your_jwt_secret_key_here | คีย์สำหรับเซ็น JWT |
| `JWT_EXPIRES_IN` | 7d | ระยะเวลาหมดอายุของโทเคน |

### 3. สร้างฐานข้อมูลและ seed ข้อมูลเริ่มต้น

```bash
npm run db:init
```

คำสั่งนี้จะ:
1. สร้างฐานข้อมูล `internship_db`
2. สร้างตารางทั้งหมดตาม `schema.sql`
3. เพิ่มบัญชีทดสอบ เช่น `admin / admin123`, `advisor / password`, `student1 / password`, ฯลฯ

### 4. รันเซิร์ฟเวอร์

```bash
# Development (hot reload ด้วย nodemon)
npm run dev

# Production
npm start
```

ค่าเริ่มต้นเซิร์ฟเวอร์จะพร้อมใช้งานที่ `http://localhost:5000`

## สคริปต์ npm

| คำสั่ง | รายละเอียด |
|---------|-------------|
| `npm run dev` | รันเซิร์ฟเวอร์ด้วย nodemon ระหว่างพัฒนา |
| `npm start` | รันเซิร์ฟเวอร์ด้วย Node.js ปกติ |
| `npm run db:init` | เรียก `src/database/init.js` เพื่อสร้าง/รีเซ็ตฐานข้อมูล |

## โครงสร้างฐานข้อมูล (สรุป)

| ตาราง | จุดประสงค์หลัก |
|-------|-----------------|
| `users` | เก็บข้อมูลบัญชีทุกบทบาท พร้อมสถานะ `is_active` |
| `requests` | คำร้องฝึกงานของนักศึกษา + สถานะภาษาไทย + comment admin/advisor |
| `daily_checkins` | บันทึกการเช็คชื่อรายวัน (พร้อม unique key student/date) |
| `payment_proofs` | หลักฐานการชำระเงิน + สถานะ `pending/approved/rejected` |

รายละเอียดคอลัมน์ทั้งหมดดูได้จาก `src/database/schema.sql`

## ภาพรวม API (สกัดจาก `server.js`)

| หมวด | Endpoint | Method | สิทธิ์ |
|-------|----------|--------|--------|
| Health | `/api/health` | GET | Public |
| Public Catalog | `/api/public/companies` | GET | Public |
| Auth | `/api/auth/login` | POST | Public |
| Auth | `/api/auth/me` | GET | ผู้ใช้ที่มีโทเคน |
| Users | `/api/users` | GET | Authenticated (กรองได้ตาม role/department) |
| Users | `/api/users/:id` | GET | Authenticated |
| Users | `/api/users` | POST | Admin |
| Users | `/api/users/import` | POST | Admin |
| Users | `/api/users/:id` | PUT | เจ้าของข้อมูลหรือ Admin (ตรวจก่อนใน client) |
| Users | `/api/users/:id` | DELETE | Admin |
| Requests | `/api/requests` | GET | Authenticated |
| Requests | `/api/requests/:id` | GET | Authenticated |
| Requests | `/api/requests` | POST | Authenticated |
| Requests | `/api/requests/:id/status` | PATCH | Authenticated (ตรวจบทบาท server-side) |
| Requests | `/api/requests/:id` | DELETE | Authenticated |
| Checkins | `/api/checkins` | GET | Authenticated |
| Checkins | `/api/checkins/:id` | GET | Authenticated |
| Checkins | `/api/checkins` | POST | Authenticated |
| Checkins | `/api/checkins/:id` | DELETE | Authenticated |
| Payments | `/api/payments` | GET | Authenticated |
| Payments | `/api/payments/:id` | GET | Authenticated |
| Payments | `/api/payments` | POST | Authenticated |
| Payments | `/api/payments/:id/approve` | PATCH | Authenticated (ควรจำกัด admin ใน client) |
| Payments | `/api/payments/:id/reject` | PATCH | Authenticated |

> หมายเหตุ: แต่ละ endpoint มีการตรวจสอบสิทธิ์จริงผ่าน middleware `authenticate` และ `authorize` ภายใน `server.js` คุณสามารถปรับบทบาทที่อนุญาตได้ตามความต้องการ

## Authentication

- ใช้ JWT Bearer Token แนบใน Header: `Authorization: Bearer <token>`
- Token ออกให้ผ่าน `POST /api/auth/login`
- Middleware `authenticate` จะตรวจสอบโทเคนและแนบข้อมูลผู้ใช้ (`req.user`) ให้ API ถัดไป
- ฟังก์ชัน `authorize(...roles)` ใช้จำกัดบทบาท (เช่น admin เท่านั้น) ก่อนเข้าถึงบาง endpoint

## ข้อมูลสำหรับการทดสอบ (จาก `npm run db:init`)

| บทบาท | Username | Password |
|--------|----------|----------|
| Admin | `admin` | `admin123` |
| Advisor | `advisor` | `password` |
| Student | `student1` / `student2` | `password` |
| Company | `company1` | `password` |

สามารถแก้ไข/เพิ่มบัญชีเพิ่มเติมได้ภายหลังผ่าน API Users หรือแก้ seed script ตามต้องการ

---

หากมีคำถามเพิ่มเติมหรือพบปัญหาในการใช้งาน โปรดเปิด issue หรือแจ้งผู้ดูแลโครงการ 🙌

