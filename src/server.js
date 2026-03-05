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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
});

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
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running', timestamp: new Date().toISOString() });
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
    let sql = 'SELECT * FROM requests WHERE 1=1';
    const params = [];

    if (studentId) { sql += ' AND studentId = ?'; params.push(studentId); }
    if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
    if (department && department !== 'all') { sql += ' AND department = ?'; params.push(department); }
    if (search) {
      sql += ' AND (studentName LIKE ? OR studentId LIKE ? OR company LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY submittedDate DESC';
    const [rows] = await pool.query(sql, params);
    const data = rows.map((row) => ({
      ...row,
      id: String(row.id),
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    }));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/requests/:id
app.get('/api/requests/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    const row = rows[0];
    res.json({
      success: true,
      data: { ...row, id: String(row.id), details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/requests
app.post('/api/requests', authenticate, async (req, res) => {
  try {
    const { studentId, studentName, department, company, position, submittedDate, status, details } = req.body;
    const [result] = await pool.query(
      `INSERT INTO requests (studentId, studentName, department, company, position, submittedDate, status, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, studentName || null, department || null, company || null, position || null,
       submittedDate || new Date(), status || 'รออาจารย์ที่ปรึกษาอนุมัติ', details ? JSON.stringify(details) : null]
    );
    const [newRow] = await pool.query('SELECT * FROM requests WHERE id = ?', [result.insertId]);
    const row = newRow[0];
    res.status(201).json({
      success: true, message: 'ส่งคำร้องสำเร็จ',
      data: { ...row, id: String(row.id), details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/requests/:id/status
app.patch('/api/requests/:id/status', authenticate, async (req, res) => {
  try {
    const { status, admin_comment, advisor_comment } = req.body;
    const updates = ['status = ?'];
    const params = [status];

    if (admin_comment !== undefined) { updates.push('admin_comment = ?'); params.push(admin_comment); }
    if (advisor_comment !== undefined) { updates.push('advisor_comment = ?'); params.push(advisor_comment); }

    params.push(req.params.id);
    await pool.query(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!updated[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    const row = updated[0];
    res.json({
      success: true, message: 'อัปเดตสถานะคำร้องสำเร็จ',
      data: { ...row, id: String(row.id), details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details }
    });
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
    const { studentId, studentName, date, status, note } = req.body;
    await pool.query(
      `INSERT INTO daily_checkins (studentId, studentName, date, status, note)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), studentName = VALUES(studentName)`,
      [studentId, studentName || null, date, status || 'present', note || null]
    );
    const [rows] = await pool.query('SELECT * FROM daily_checkins WHERE studentId = ? AND date = ?', [studentId, date]);
    res.status(201).json({ success: true, message: 'บันทึกการเช็คชื่อเรียบร้อยแล้ว', data: rows[0] || null });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'คุณเช็คชื่อวันที่นี้แล้ว' });
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
