const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate } = require('../middlewares/auth');

// GET /api/checkins
router.get('/', authenticate, async (req, res) => {
  try {
    const { studentId, date, status, department, search } = req.query;
    let sql = 'SELECT dc.* FROM daily_checkins dc WHERE 1=1';
    const params = [];

    if (studentId) { sql += ' AND dc.studentId = ?'; params.push(studentId); }
    if (date) { sql += ' AND dc.date = ?'; params.push(date); }
    if (status && status !== 'all') { sql += ' AND dc.status = ?'; params.push(status); }
    if (department && department !== 'all') {
      sql += ' AND dc.studentId IN (SELECT r.studentId FROM requests r WHERE r.department = ?)';
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
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM daily_checkins WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเช็คชื่อ' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/checkins — บันทึกเช็คชื่อรายวัน
router.post('/', authenticate, async (req, res) => {
  try {
    const { studentId, studentName, date, status, note, workExperience } = req.body;

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
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM daily_checkins WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลเช็คชื่อ' });
    res.json({ success: true, message: 'ลบเช็คชื่อสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/checkins/student/:studentId
router.delete('/student/:studentId', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM daily_checkins WHERE studentId = ?', [req.params.studentId]);
    res.json({ success: true, message: 'ลบรายงานประจำวันสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
