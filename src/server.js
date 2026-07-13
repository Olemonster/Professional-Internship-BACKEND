// =============================================
// ระบบบริหารจัดการฝึกงานนักศึกษา — Backend Server
// รวมทุกอย่างไว้ในไฟล์เดียว (DB, Auth, Models, Routes)
// =============================================

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// =============================================
// Middleware
// =============================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// =============================================
// Database Connection Pool
// =============================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  maxAllowedPacket: 50 * 1024 * 1024,
});

// พยายามเพิ่ม max_allowed_packet อัตโนมัติเผื่อ Database บน Railway ตั้งค่าไว้ต่ำเกินไป (ถ้ามีสิทธิ์ SUPER)
pool.query('SET GLOBAL max_allowed_packet = 67108864').catch(e => console.log('Notice: Could not set max_allowed_packet (might not have SUPER privilege):', e.message));

// =============================================
// Auth Middleware
// =============================================
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
  }
};

const parseRequestRow = (row) => {
  const parsed = { ...row, id: String(row.id) };
  if (typeof parsed.details === 'string') { try { parsed.details = JSON.parse(parsed.details); } catch (_) {} }
  if (typeof parsed.dispatchLetter === 'string') { try { parsed.dispatchLetter = JSON.parse(parsed.dispatchLetter); } catch (_) {} }
  if (typeof parsed.supervisionAppointment === 'string') { try { parsed.supervisionAppointment = JSON.parse(parsed.supervisionAppointment); } catch (_) {} }
  if (typeof parsed.supervisionReport === 'string') { try { parsed.supervisionReport = JSON.parse(parsed.supervisionReport); } catch (_) {} }
  return parsed;
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึง' });
  }
  next();
};

// =============================================
// Helper: แปลง DB row → Frontend-compatible object
// =============================================
const toFrontendUser = (row) => {
  if (!row) return null;
  return {
    id: String(row.id),
    username: row.username,
    email: row.username,
    name: row.name,
    full_name: row.name,
    role: row.role,
    studentId: row.studentId || '',
    student_code: row.studentId || '',
    department: row.department || '',
    major: row.department || '',
    address: row.address || '',
    phone: row.phone || '',
    contactPerson: row.contactPerson || '',
    avatar: row.avatar || null,
    is_active: row.is_active,
  };
};

const normalizeCompanyName = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const addCompanyEntry = (map, entry) => {
  const key = normalizeCompanyName(entry.name);
  if (!key) return;

  if (map.has(key)) {
    const existing = map.get(key);
    if (
      (!existing.businessType || existing.businessType === 'ไม่ระบุประเภทธุรกิจ') &&
      entry.businessType
    ) {
      existing.businessType = entry.businessType;
    }
    if (!existing.address && entry.address) existing.address = entry.address;
    if (!existing.contactPerson && entry.contactPerson) existing.contactPerson = entry.contactPerson;
    if (!existing.phone && entry.phone) existing.phone = entry.phone;
    if (!existing.source && entry.source) existing.source = entry.source;
    if (entry.imageUrl) existing.imageUrl = entry.imageUrl;
    return;
  }

  map.set(key, { ...entry });
};

// =============================================
// Health Check
// =============================================
app.get('/api/health', async (req, res) => {
  try {
    // เช็คการเชื่อมต่อ Database โดยรันคำสั่ง SELECT 1
    await pool.query('SELECT 1');
    res.json({ 
      success: true, 
      message: 'API and Database are running', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Database connection error in health check:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'API is running but Database connection failed', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// =============================================
// AUTH Routes
// =============================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก username และ password' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [email]);
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'บัญชีถูกระงับการใช้งาน' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', token, user: toFrontendUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    res.json({ success: true, user: toFrontendUser(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================
// Public Companies Catalog (no auth)
// =============================================
app.get('/api/public/companies', async (req, res) => {
  try {
    const map = new Map();

    const [companyRows] = await pool.query("SELECT * FROM users WHERE role = 'company'");
    companyRows.forEach((company) => {
      addCompanyEntry(map, {
        name: company.name || company.username,
        businessType: company.businessType || 'ไม่ระบุประเภทธุรกิจ',
        address: company.address || '',
        contactPerson: company.contactPerson || '',
        phone: company.phone || '',
        source: 'จากบัญชีบริษัท',
        imageUrl: company.logo || company.imageUrl || null,
      });
    });

    const [requestRows] = await pool.query('SELECT * FROM requests');
    requestRows.forEach((request) => {
      const rawDetails =
        typeof request.details === 'string'
          ? (() => {
              try {
                return JSON.parse(request.details);
              } catch (_) {
                return {};
              }
            })()
          : request.details || {};
      const companyName =
        request.companyName || request.company || rawDetails.companyName || rawDetails.company || '';
      if (!companyName) return;
      addCompanyEntry(map, {
        name: companyName,
        businessType: request.position ? `ตำแหน่งยอดฮิต: ${request.position}` : 'ไม่ระบุประเภทธุรกิจ',
        address: rawDetails.companyAddress || request.address || '',
        contactPerson: rawDetails.contactPerson || '',
        phone: rawDetails.phone || '',
        source: 'จากคำร้องรุ่นพี่',
        imageUrl: rawDetails.imageUrl || null,
      });
    });

    const data = Array.from(map.values()).slice(0, 24);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Public companies error:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลบริษัทได้' });
  }
});

// =============================================
// USERS Routes
// =============================================

// GET /api/users — ดึงผู้ใช้ทั้งหมด (ทุก role อ่านได้)
app.get('/api/users', authenticate, async (req, res) => {
  try {
    const { role, department, search } = req.query;
    let sql = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (role) { sql += ' AND role = ?'; params.push(role); }
    if (department && department !== 'all') { sql += ' AND department = ?'; params.push(department); }
    if (search) {
      sql += ' AND (name LIKE ? OR username LIKE ? OR studentId LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows.map(toFrontendUser) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/users/:id
app.get('/api/users/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    res.json({ success: true, data: toFrontendUser(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/users — สร้างผู้ใช้ใหม่ (Admin เท่านั้น)
app.post('/api/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { username, password, name, role, studentId, department, address, phone, contactPerson } = req.body;

    // ตรวจสอบ username ซ้ำ
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Username นี้ถูกใช้งานแล้ว' });
    }

    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    const [result] = await pool.query(
      `INSERT INTO users (username, password, name, role, studentId, department, address, phone, contactPerson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, name, role, studentId || null, department || null, address || null, phone || null, contactPerson || null]
    );

    const [newUser] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'สร้างผู้ใช้สำเร็จ', data: toFrontendUser(newUser[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/users/import — นำเข้าผู้ใช้หลายคน (Admin)
app.post('/api/users/import', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { users: userList } = req.body;
    if (!Array.isArray(userList) || userList.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลผู้ใช้' });
    }

    let created = 0;
    const errors = [];

    for (let i = 0; i < userList.length; i++) {
      try {
        const row = userList[i];
        const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [row.username]);
        if (existing.length > 0) {
          errors.push({ index: i, message: `${row.username} ซ้ำกับผู้ใช้เดิม` });
          continue;
        }
        const hashedPassword = await bcrypt.hash(row.password || '123456', 10);
        await pool.query(
          `INSERT INTO users (username, password, name, role, studentId, department, address, phone, contactPerson)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.username, hashedPassword, row.name, row.role || 'student', row.studentId || null, row.department || null, row.address || null, row.phone || null, row.contactPerson || null]
        );
        created++;
      } catch (err) {
        errors.push({ index: i, message: err.message });
      }
    }

    res.json({ success: true, message: `เพิ่มผู้ใช้สำเร็จ ${created} รายการ`, created, errors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/users/:id — อัปเดตผู้ใช้ (ทุก role อัปเดตตัวเองได้)
app.put('/api/users/:id', authenticate, async (req, res) => {
  try {
    const allowed = ['username', 'name', 'role', 'studentId', 'department', 'address', 'phone', 'contactPerson', 'avatar', 'is_active'];
    const updates = [];
    const params = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }
    if (req.body.password) {
      updates.push('password = ?');
      params.push(await bcrypt.hash(req.body.password, 10));
    }

    if (updates.length === 0) return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลที่ต้องอัปเดต' });

    params.push(req.params.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!updated[0]) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ', data: toFrontendUser(updated[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/users/:id — ลบผู้ใช้ (Admin เท่านั้น)
app.delete('/api/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    res.json({ success: true, message: 'ลบผู้ใช้สำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================
// REQUESTS Routes
// =============================================

// GET /api/requests
app.get('/api/requests', authenticate, async (req, res) => {
  try {
    const { studentId, status, department, search } = req.query;
    let sql = `
      SELECT r.*, 
             IF(e.id IS NOT NULL, true, false) AS hasCompanyEval,
             IF(ae.id IS NOT NULL, true, false) AS hasAdvisorEval
      FROM requests r
      LEFT JOIN evaluations e ON r.id = e.requestId
      LEFT JOIN advisor_evaluations ae ON r.id = ae.requestId
      WHERE 1=1
    `;
    const params = [];

    if (studentId) { sql += ' AND r.studentId = ?'; params.push(studentId); }
    if (status && status !== 'all') { sql += ' AND r.status = ?'; params.push(status); }
    if (department && department !== 'all') { sql += ' AND r.department = ?'; params.push(department); }
    if (search) {
      sql += ' AND (r.studentName LIKE ? OR r.studentId LIKE ? OR r.company LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY r.submittedDate DESC';
    const [rows] = await pool.query(sql, params);
    const data = rows.map(parseRequestRow);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================
// PUBLIC Routes (no auth required)
// =============================================

// GET /api/public/requests/:id
app.get('/api/public/requests/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    res.json({ success: true, data: parseRequestRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/public/requests/:id/status (for company accept/reject)
app.patch('/api/public/requests/:id/status', async (req, res) => {
  try {
    const { status, company_comment } = req.body;
    const allowed = ['อนุมัติแล้ว', 'ปฏิเสธ'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
    }
    const updates = ['status = ?'];
    const params = [status];
    if (company_comment !== undefined) { updates.push('company_comment = ?'); params.push(company_comment); }
    params.push(req.params.id);
    await pool.query(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params);
    const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!updated[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    res.json({ success: true, message: 'อัปเดตสถานะคำร้องสำเร็จ', data: parseRequestRow(updated[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/requests/:id
app.get('/api/requests/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    res.json({ success: true, data: parseRequestRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/requests
app.post('/api/requests', authenticate, async (req, res) => {
  try {
    const { studentId, studentName, department, company, position, submittedDate, status, details } = req.body;
    
    // แปลงฟอร์แมตวันที่ให้เป็น YYYY-MM-DD HH:mm:ss สำหรับ MySQL
    const d = submittedDate ? new Date(submittedDate) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const [result] = await pool.query(
      `INSERT INTO requests (studentId, studentName, department, company, position, submittedDate, status, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, studentName || null, department || null, company || null, position || null,
       formattedDate, status || 'รออาจารย์ที่ปรึกษาอนุมัติ', details ? JSON.stringify(details) : null]
    );
    const [newRow] = await pool.query('SELECT * FROM requests WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'ส่งคำร้องสำเร็จ', data: parseRequestRow(newRow[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/requests/:id/status
app.patch('/api/requests/:id/status', authenticate, async (req, res) => {
  try {
    const { status, admin_comment, advisor_comment, dispatchLetter } = req.body;
    const updates = ['status = ?'];
    const params = [status];

    if (admin_comment !== undefined) { updates.push('admin_comment = ?'); params.push(admin_comment); }
    if (advisor_comment !== undefined) { updates.push('advisor_comment = ?'); params.push(advisor_comment); }
    if (dispatchLetter !== undefined) { updates.push('dispatchLetter = ?'); params.push(JSON.stringify(dispatchLetter)); }

    params.push(req.params.id);
    await pool.query(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!updated[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    res.json({ success: true, message: 'อัปเดตสถานะคำร้องสำเร็จ', data: parseRequestRow(updated[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/requests/:id/appointment
app.patch('/api/requests/:id/appointment', authenticate, async (req, res) => {
  try {
    const { date, mode, note } = req.body;
    const appointmentData = { date, mode, note, updatedAt: new Date().toISOString() };
    await pool.query(
      'UPDATE requests SET supervisionAppointment = ? WHERE id = ?',
      [JSON.stringify(appointmentData), req.params.id]
    );
    res.json({ success: true, message: 'อัปเดตวันนัดนิเทศสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/requests/:id
app.delete('/api/requests/:id', authenticate, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM requests WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    res.json({ success: true, message: 'ลบคำร้องสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================
// CHECKINS Routes
// =============================================

// GET /api/checkins
app.get('/api/checkins', authenticate, async (req, res) => {
  try {
    const { studentId, date, status, department, search } = req.query;
    let sql = 'SELECT dc.* FROM daily_checkins dc WHERE 1=1';
    const params = [];

    if (studentId) { sql += ' AND dc.studentId = ?'; params.push(studentId); }
    if (date) { sql += ' AND dc.date = ?'; params.push(date); }
    if (status && status !== 'all') { sql += ' AND dc.status = ?'; params.push(status); }
    if (department && department !== 'all') {
      sql += ' AND dc.studentId IN (SELECT u.studentId FROM users u WHERE u.department = ?)';
      params.push(department);
    }
    if (search) {
      sql += ' AND (dc.studentName LIKE ? OR dc.studentId LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s);
    }

    sql += ' ORDER BY dc.date DESC, dc.createdAt DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/checkins/:id
app.get('/api/checkins/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM daily_checkins WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเช็คชื่อ' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/checkins
app.post('/api/checkins', authenticate, async (req, res) => {
  try {
    const { studentId, studentName, date, status, note, workExperience } = req.body;
    
    // Check if already checked in today
    const [existing] = await pool.query('SELECT id FROM daily_checkins WHERE studentId = ? AND date = ?', [studentId, date]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'คุณเช็คชื่อของวันนี้ไปแล้ว (จะรีเซ็ตในวันถัดไปหลัง 07:00 น.)' });
    }

    await pool.query(
      `INSERT INTO daily_checkins (studentId, studentName, date, status, note, work_experience)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [studentId, studentName || null, date, status || 'present', note || null, workExperience || null]
    );
    const [rows] = await pool.query('SELECT * FROM daily_checkins WHERE studentId = ? AND date = ?', [studentId, date]);
    res.status(201).json({ success: true, message: 'บันทึกการเช็คชื่อเรียบร้อยแล้ว', data: rows[0] || null });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'คุณเช็คชื่อของวันนี้ไปแล้ว (จะรีเซ็ตในวันถัดไปหลัง 07:00 น.)' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/checkins/:id
app.delete('/api/checkins/:id', authenticate, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM daily_checkins WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเช็คชื่อ' });
    res.json({ success: true, message: 'ลบเช็คชื่อสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================
// PAYMENTS Routes
// =============================================

// GET /api/payments
app.get('/api/payments', authenticate, async (req, res) => {
  try {
    const { studentId, status, department } = req.query;
    let sql = 'SELECT * FROM payment_proofs WHERE 1=1';
    const params = [];

    if (studentId) { sql += ' AND studentId = ?'; params.push(studentId); }
    if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
    if (department && department !== 'all') { sql += ' AND department = ?'; params.push(department); }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payments/:id
app.get('/api/payments/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payment_proofs WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลการชำระเงิน' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments
app.post('/api/payments', authenticate, async (req, res) => {
  try {
    const { studentId, studentName, date, department, slipDataUrl, slipFileName } = req.body;
    const [result] = await pool.query(
      `INSERT INTO payment_proofs (studentId, studentName, date, department, slipDataUrl, slipFileName)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [studentId, studentName || null, date || null, department || null, slipDataUrl || null, slipFileName || null]
    );
    const [newRow] = await pool.query('SELECT * FROM payment_proofs WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'ส่งหลักฐานการชำระเงินสำเร็จ', data: newRow[0] || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/payments/:id/approve
app.patch('/api/payments/:id/approve', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE payment_proofs SET status = ? WHERE id = ?', ['approved', req.params.id]);
    const [updated] = await pool.query('SELECT * FROM payment_proofs WHERE id = ?', [req.params.id]);
    if (!updated[0]) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลการชำระเงิน' });
    res.json({ success: true, message: 'อนุมัติการชำระเงินเรียบร้อย', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/payments/:id/reject
app.patch('/api/payments/:id/reject', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE payment_proofs SET status = ? WHERE id = ?', ['rejected', req.params.id]);
    const [updated] = await pool.query('SELECT * FROM payment_proofs WHERE id = ?', [req.params.id]);
    if (!updated[0]) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลการชำระเงิน' });
    res.json({ success: true, message: 'ปฏิเสธการชำระเงินเรียบร้อย', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// =============================================
// EVALUATIONS Routes
// =============================================

// GET /api/public/evaluate/request/:id (Check if request exists and get info for form)
app.get('/api/public/evaluate/request/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    
    // ตรวจสอบว่าเคยประเมินหรือยัง
    const [evalRows] = await pool.query('SELECT id FROM evaluations WHERE requestId = ?', [req.params.id]);
    if (evalRows.length > 0) {
      return res.json({ success: true, evaluated: true, message: 'นักศึกษาคนนี้ได้รับการประเมินแล้ว' });
    }
    res.json({ success: true, evaluated: false, data: parseRequestRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/public/evaluate/:requestId
app.post('/api/public/evaluate/:requestId', async (req, res) => {
  try {
    const reqId = req.params.requestId;
    const {
      studentId, evaluatorName, evaluatorPosition, evaluatorDepartment,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, q16, q17, q18, q19, q20,
      strengths, improvements, hireFuture, overallScore, projectUsage, otherComments, signature
    } = req.body;
    
    await pool.query(
      `INSERT INTO evaluations (
        requestId, studentId, evaluatorName, evaluatorPosition, evaluatorDepartment,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, q16, q17, q18, q19, q20,
        strengths, improvements, hireFuture, overallScore, projectUsage, otherComments, signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reqId, studentId, evaluatorName, evaluatorPosition, evaluatorDepartment,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, q16, q17, q18, q19, q20,
        strengths, improvements, hireFuture, overallScore, projectUsage, otherComments, signature || null
      ]
    );

    // Update the request status
    await pool.query('UPDATE requests SET status = ? WHERE id = ?', ['ประเมินเสร็จแล้ว', reqId]);

    res.status(201).json({ success: true, message: 'บันทึกผลการประเมินสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/evaluations/request/:requestId (auth needed - for admin/advisor)
app.get('/api/evaluations/request/:requestId', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM evaluations WHERE requestId = ?', [req.params.requestId]);
    if (!rows[0]) return res.json({ success: true, data: null });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/evaluations/analytics (auth admin needed)
app.get('/api/evaluations/analytics', authenticate, async (req, res) => {
  try {
    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const [rows] = await pool.query(`
      SELECT 
        r.department, 
        r.company,
        e.q1, e.q2, e.q3, e.q4, e.q5, e.q6, e.q7, e.q8, e.q9, e.q10,
        e.q11, e.q12, e.q13, e.q14, e.q15, e.q16, e.q17, e.q18, e.q19, e.q20,
        e.hireFuture
      FROM evaluations e
      JOIN requests r ON e.requestId = r.id
      WHERE r.status IN ('ประเมินเสร็จแล้ว', 'ฝึกงานเสร็จแล้ว')
    `);

    // Aggregate Data
    const deptStats = {};
    const companyStats = {};
    let totalEvals = 0;

    rows.forEach(row => {
      totalEvals++;
      // Department Stats
      if (!deptStats[row.department]) {
        deptStats[row.department] = {
          count: 0,
          cat1: { sum: 0, count: 0 }, // ผลสำเร็จของงาน (1-2)
          cat2: { sum: 0, count: 0 }, // ความรู้ความสามารถ (3-14)
          cat3: { sum: 0, count: 0 }  // ลักษณะส่วนบุคคล (15-20)
        };
      }
      deptStats[row.department].count++;
      
      const sumAvg = (start, end, targetObj) => {
        for(let i=start; i<=end; i++) {
          const val = row[`q${i}`];
          if (val && !isNaN(val)) {
            targetObj.sum += parseInt(val);
            targetObj.count++;
          }
        }
      };

      sumAvg(1, 2, deptStats[row.department].cat1);
      sumAvg(3, 14, deptStats[row.department].cat2);
      sumAvg(15, 20, deptStats[row.department].cat3);

      // Company Stats
      if (row.company) {
        if (!companyStats[row.company]) {
          companyStats[row.company] = { total: 0, hire: 0, maybe: 0, no: 0 };
        }
        companyStats[row.company].total++;
        if (row.hireFuture === 'รับ') companyStats[row.company].hire++;
        else if (row.hireFuture === 'ไม่แน่ใจ') companyStats[row.company].maybe++;
        else if (row.hireFuture === 'ไม่รับ') companyStats[row.company].no++;
      }
    });

    // Format output
    const formattedDeptStats = Object.keys(deptStats).map(dept => {
      const d = deptStats[dept];
      return {
        department: dept,
        count: d.count,
        avgCat1: d.cat1.count > 0 ? (d.cat1.sum / d.cat1.count).toFixed(2) : 0,
        avgCat2: d.cat2.count > 0 ? (d.cat2.sum / d.cat2.count).toFixed(2) : 0,
        avgCat3: d.cat3.count > 0 ? (d.cat3.sum / d.cat3.count).toFixed(2) : 0,
      }
    });

    res.json({ 
      success: true, 
      data: {
        totalEvals,
        departments: formattedDeptStats,
        companies: companyStats
      } 
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// =============================================
// ADVISOR EVALUATIONS Routes
// =============================================

// GET /api/advisor-evaluations/request/:requestId
app.get('/api/advisor-evaluations/request/:requestId', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM advisor_evaluations WHERE requestId = ?', [req.params.requestId]);
    if (!rows[0]) return res.json({ success: true, data: null });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/advisor-evaluations/request/:requestId
app.post('/api/advisor-evaluations/request/:requestId', authenticate, async (req, res) => {
  try {
    const reqId = req.params.requestId;
    const {
      advisorName,
      c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, companyComments,
      s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, studentComments
    } = req.body;
    
    // Check if exists
    const [existing] = await pool.query('SELECT id FROM advisor_evaluations WHERE requestId = ?', [reqId]);
    if (existing.length > 0) {
      await pool.query(
        `UPDATE advisor_evaluations SET 
          advisorName=?, c1=?, c2=?, c3=?, c4=?, c5=?, c6=?, c7=?, c8=?, c9=?, c10=?, c11=?, c12=?, c13=?, c14=?, c15=?, c16=?, c17=?, companyComments=?,
          s1=?, s2=?, s3=?, s4=?, s5=?, s6=?, s7=?, s8=?, s9=?, s10=?, s11=?, s12=?, s13=?, s14=?, s15=?, s16=?, s17=?, s18=?, s19=?, s20=?, studentComments=?
        WHERE requestId=?`,
        [
          advisorName, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, companyComments,
          s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, studentComments, reqId
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO advisor_evaluations (
          requestId, advisorName,
          c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, companyComments,
          s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, studentComments
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reqId, advisorName,
          c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, companyComments,
          s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, studentComments
        ]
      );
    }

    // Also update supervisionReport json in requests table so list query doesn't break
    await pool.query(
      `UPDATE requests SET supervisionReport = ? WHERE id = ?`,
      [JSON.stringify({ result: 'ผ่าน', note: 'ประเมินแบบฟอร์มละเอียดแล้ว' }), reqId]
    );

    res.status(201).json({ success: true, message: 'บันทึกผลการนิเทศสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================
// ANNOUNCEMENTS Routes
// =============================================

// GET /api/public/announcements (no auth — for HomePage)
app.get('/api/public/announcements', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM announcements WHERE is_active = 1 ORDER BY is_pinned DESC, created_at DESC LIMIT 20'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/public/announcements/:id (no auth — single announcement detail)
app.get('/api/public/announcements/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM announcements WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบข่าว' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/announcements (admin — all announcements)
app.get('/api/announcements', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/announcements (admin — create)
app.post('/api/announcements', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, content, category, coverImage, is_pinned } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุหัวข้อและเนื้อหา' });
    }
    const author = req.user?.name || req.user?.username || 'Admin';
    const [result] = await pool.query(
      'INSERT INTO announcements (title, content, category, coverImage, is_pinned, author) VALUES (?, ?, ?, ?, ?, ?)',
      [title, content, category || 'ทั่วไป', coverImage || null, is_pinned ? 1 : 0, author]
    );
    const [created] = await pool.query('SELECT * FROM announcements WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'สร้างข่าวประชาสัมพันธ์สำเร็จ', data: created[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/announcements/:id (admin — update)
app.put('/api/announcements/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, content, category, coverImage, is_pinned } = req.body;
    await pool.query(
      'UPDATE announcements SET title = ?, content = ?, category = ?, coverImage = ?, is_pinned = ? WHERE id = ?',
      [title, content, category || 'ทั่วไป', coverImage || null, is_pinned ? 1 : 0, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
    if (!updated[0]) return res.status(404).json({ success: false, message: 'ไม่พบข่าว' });
    res.json({ success: true, message: 'อัปเดตข่าวสำเร็จ', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/announcements/:id (admin — delete)
app.delete('/api/announcements/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบข่าว' });
    res.json({ success: true, message: 'ลบข่าวสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/announcements/:id/toggle (admin — toggle active)
app.patch('/api/announcements/:id/toggle', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT is_active FROM announcements WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบข่าว' });
    const newStatus = rows[0].is_active ? 0 : 1;
    await pool.query('UPDATE announcements SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
    res.json({ success: true, message: newStatus ? 'เปิดแสดงข่าวแล้ว' : 'ซ่อนข่าวแล้ว', is_active: newStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================
// 404 + Error Handler
// =============================================
app.use((req, res) => {
  res.status(404).json({ success: false, message: `ไม่พบเส้นทาง ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
});

// =============================================
// Start Server
// =============================================
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📋 API Health: http://localhost:${PORT}/api/health`);
});

module.exports = app;
