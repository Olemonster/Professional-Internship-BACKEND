const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate } = require('../middlewares/auth');

// GET /api/payments
router.get('/', authenticate, async (req, res) => {
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
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payment_proofs WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลการชำระเงิน' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments — ส่งหลักฐานการชำระเงิน
router.post('/', authenticate, async (req, res) => {
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
router.patch('/:id/approve', authenticate, async (req, res) => {
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
router.patch('/:id/reject', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE payment_proofs SET status = ? WHERE id = ?', ['rejected', req.params.id]);
    const [updated] = await pool.query('SELECT * FROM payment_proofs WHERE id = ?', [req.params.id]);
    if (!updated[0]) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลการชำระเงิน' });
    res.json({ success: true, message: 'ปฏิเสธการชำระเงินเรียบร้อย', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/payments/student/:studentId
router.delete('/student/:studentId', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM payment_proofs WHERE studentId = ?', [req.params.studentId]);
    res.json({ success: true, message: 'ลบหลักฐานชำระเงินสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
