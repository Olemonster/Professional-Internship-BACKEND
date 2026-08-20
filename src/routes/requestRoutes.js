const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const { parseRequestRow } = require('../utils/helpers');

// GET /api/public/requests/:id
router.get('/public/requests/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลคำร้อง' });
    res.json({ success: true, data: parseRequestRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/public/requests/:id/status
router.patch('/public/requests/:id/status', async (req, res) => {
  try {
    const { status, company_comment } = req.body;
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลคำร้อง' });

    const updates = ['status = ?'];
    const params = [status];

    if (company_comment) {
      updates.push('company_comment = ?');
      params.push(company_comment);
    }

    params.push(req.params.id);
    await pool.query(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ', data: parseRequestRow(updated[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/requests
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

// GET /api/requests/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    res.json({ success: true, data: parseRequestRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/requests — ส่งคำร้องใหม่
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      studentId, studentName, department, company, position,
      submittedDate, status, details, dispatchLetter
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO requests (
        studentId, studentName, department, company, position,
        submittedDate, status, details, dispatchLetter
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        studentName || null,
        department || null,
        company || null,
        position || null,
        submittedDate ? new Date(submittedDate) : new Date(),
        status || 'รออาจารย์ที่ปรึกษาอนุมัติ',
        details ? JSON.stringify(details) : null,
        dispatchLetter ? JSON.stringify(dispatchLetter) : null
      ]
    );

    const [newRow] = await pool.query('SELECT * FROM requests WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'ยื่นคำร้องสำเร็จ', data: parseRequestRow(newRow[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/requests/:id — แก้ไขคำร้อง
router.put('/:id', authenticate, async (req, res) => {
  try {
    const {
      studentName, department, company, position,
      status, details, dispatchLetter, admin_comment, advisor_comment
    } = req.body;

    const allowed = {
      studentName, department, company, position, status, admin_comment, advisor_comment
    };
    const updates = [];
    const params = [];

    for (const [k, v] of Object.entries(allowed)) {
      if (v !== undefined) {
        updates.push(`\`${k}\` = ?`);
        params.push(v);
      }
    }

    if (details !== undefined) {
      updates.push('`details` = ?');
      params.push(typeof details === 'object' ? JSON.stringify(details) : details);
    }
    if (dispatchLetter !== undefined) {
      updates.push('`dispatchLetter` = ?');
      params.push(typeof dispatchLetter === 'object' ? JSON.stringify(dispatchLetter) : dispatchLetter);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลที่ต้องอัปเดต' });
    }

    params.push(req.params.id);
    await pool.query(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!updated[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    res.json({ success: true, message: 'อัปเดตคำร้องสำเร็จ', data: parseRequestRow(updated[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/requests/:id/status — อัปเดตสถานะคำร้อง
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status, adminComment, advisorComment, clearAdminComment, clearAdvisorComment } = req.body;
    if (!status) return res.status(400).json({ success: false, message: 'กรุณาระบุสถานะ' });

    const updates = ['status = ?'];
    const params = [status];

    if (adminComment !== undefined) { updates.push('admin_comment = ?'); params.push(adminComment); }
    if (advisorComment !== undefined) { updates.push('advisor_comment = ?'); params.push(advisorComment); }
    if (clearAdminComment) { updates.push('admin_comment = NULL'); }
    if (clearAdvisorComment) { updates.push('advisor_comment = NULL'); }

    params.push(req.params.id);
    await pool.query(`UPDATE requests SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'อัปเดตคำร้องสำเร็จ', data: parseRequestRow(updated[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/requests/:id/appointment — อัปเดตวันนัดนิเทศ
router.patch('/:id/appointment', authenticate, async (req, res) => {
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
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM requests WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });
    res.json({ success: true, message: 'ลบคำร้องสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
