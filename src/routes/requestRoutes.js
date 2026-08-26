const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const { parseRequestRow } = require('../utils/helpers');

// Helper to handle single request fetching
const handleGetSingleRequest = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, 
             IF(e.id IS NOT NULL, true, false) AS hasCompanyEval,
             IF(ae.id IS NOT NULL, true, false) AS hasAdvisorEval
      FROM requests r
      LEFT JOIN evaluations e ON r.id = e.requestId
      LEFT JOIN advisor_evaluations ae ON r.id = ae.requestId
      WHERE r.id = ?
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลคำร้อง' });
    res.json({ success: true, data: parseRequestRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/requests — ดึงรายการคำร้องทั้งหมด (Authenticated)
router.get('/', authenticate, async (req, res) => {
  try {
    // Auto-update request statuses
    try {
      await pool.query(`
        UPDATE requests r
        JOIN evaluations e ON r.id = e.requestId
        SET r.status = 'ฝึกงานเสร็จแล้ว'
        WHERE r.status = 'ประเมินเสร็จแล้ว'
          AND e.createdAt <= NOW() - INTERVAL 3 DAY
      `);
      await pool.query(`
        UPDATE requests
        SET status = 'ออกฝึกงาน'
        WHERE status IN ('อนุมัติแล้ว', 'รออาจารย์อนุมัติเริ่มฝึกงาน')
          AND submittedDate <= NOW() - INTERVAL 3 DAY
      `);
    } catch (autoErr) {
      console.error('Auto-update query error:', autoErr);
    }

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

    if (studentId) {
      sql += ' AND r.studentId = ?';
      params.push(studentId);
    }
    if (status && status !== 'all') {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (department && department !== 'all') {
      sql += ' AND r.department = ?';
      params.push(department);
    }
    if (search) {
      sql += ' AND (r.studentName LIKE ? OR r.studentId LIKE ? OR r.company LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    sql += ' ORDER BY r.updated_at DESC, r.id DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows.map(parseRequestRow) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/requests/:id AND /api/public/requests/:id
router.get('/:id', async (req, res, next) => {
  const isPublic = req.baseUrl.includes('public') || req.originalUrl.includes('public');
  if (isPublic) {
    return handleGetSingleRequest(req, res);
  }
  authenticate(req, res, () => handleGetSingleRequest(req, res));
});

// POST /api/requests — ยื่นคำร้องใหม่
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      studentId, studentName, department, company, position,
      submittedDate, details, status
    } = req.body;

    if (!studentId || !company) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลสำคัญให้ครบถ้วน' });
    }

    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details || null);
    const initialStatus = status || 'รออาจารย์ที่ปรึกษาอนุมัติ';

    const [result] = await pool.query(
      `INSERT INTO requests (studentId, studentName, department, company, position, submittedDate, details, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        studentName || null,
        department || null,
        company,
        position || null,
        submittedDate || new Date().toISOString().split('T')[0],
        detailsStr,
        initialStatus
      ]
    );

    const [newRow] = await pool.query('SELECT * FROM requests WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'ยื่นคำร้องสำเร็จ', data: parseRequestRow(newRow[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/requests/:id/status AND /api/public/requests/:id/status
router.patch('/:id/status', async (req, res) => {
  const isPublic = req.baseUrl.includes('public') || req.originalUrl.includes('public');

  const updateStatusHandler = async () => {
    try {
      const { status, comment, admin_comment, advisor_comment, company_comment, dispatchLetter } = req.body;
      const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
      if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });

      const updates = ['status = ?'];
      const params = [status];

      if (status === 'ออกฝึกงาน') {
        updates.push('internship_start_date = IFNULL(internship_start_date, CURDATE())');
      }

      if (dispatchLetter !== undefined) {
        updates.push('dispatchLetter = ?');
        params.push(typeof dispatchLetter === 'object' ? JSON.stringify(dispatchLetter) : dispatchLetter);
      }

      const c = comment || admin_comment || advisor_comment || company_comment;
      if (c) {
        if (req.user?.role === 'admin' || admin_comment) {
          updates.push('admin_comment = ?');
        } else if (req.user?.role === 'advisor' || advisor_comment) {
          updates.push('advisor_comment = ?');
        } else {
          updates.push('company_comment = ?');
        }
        params.push(c);
      }

      params.push(req.params.id);
      await pool.query(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params);

      const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
      res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ', data: parseRequestRow(updated[0]) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  if (isPublic) {
    return updateStatusHandler();
  }
  authenticate(req, res, updateStatusHandler);
});

// PATCH /api/requests/:id/appointment
router.patch('/:id/appointment', authenticate, async (req, res) => {
  try {
    const body = req.body || {};
    const appointmentObj = body.supervisionAppointment || body;
    const apptStr = typeof appointmentObj === 'object' ? JSON.stringify(appointmentObj) : (appointmentObj || null);

    await pool.query('UPDATE requests SET supervisionAppointment = ? WHERE id = ?', [apptStr, req.params.id]);
    const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!updated[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });

    res.json({ success: true, message: 'บันทึกวันนัดหมายสำเร็จ', data: parseRequestRow(updated[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/requests/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { studentId, studentName, department, company, position, status, details, dispatchLetter } = req.body;
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });

    const updates = [];
    const params = [];

    if (studentId !== undefined) { updates.push('studentId = ?'); params.push(studentId); }
    if (studentName !== undefined) { updates.push('studentName = ?'); params.push(studentName); }
    if (department !== undefined) { updates.push('department = ?'); params.push(department); }
    if (company !== undefined) { updates.push('company = ?'); params.push(company); }
    if (position !== undefined) { updates.push('position = ?'); params.push(position); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    if (details !== undefined) {
      updates.push('details = ?');
      params.push(typeof details === 'object' ? JSON.stringify(details) : details);
    }
    if (dispatchLetter !== undefined) {
      updates.push('dispatchLetter = ?');
      params.push(typeof dispatchLetter === 'object' ? JSON.stringify(dispatchLetter) : dispatchLetter);
    }

    if (updates.length > 0) {
      params.push(req.params.id);
      await pool.query(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'แก้ไขคำร้องสำเร็จ', data: parseRequestRow(updated[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/requests/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM advisor_evaluations WHERE requestId = ?', [req.params.id]);
    await pool.query('DELETE FROM evaluations WHERE requestId = ?', [req.params.id]);
    await pool.query('DELETE FROM requests WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'ลบคำร้องสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
