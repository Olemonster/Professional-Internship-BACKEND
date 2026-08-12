const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');

// GET /api/public/announcements (no auth — for HomePage)
router.get('/public/announcements', async (req, res) => {
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
router.get('/public/announcements/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM announcements WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบข่าว' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/announcements (admin — all announcements)
router.get('/announcements', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/announcements (admin — create)
router.post('/announcements', authenticate, authorize('admin'), async (req, res) => {
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
router.put('/announcements/:id', authenticate, authorize('admin'), async (req, res) => {
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
router.delete('/announcements/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบข่าว' });
    res.json({ success: true, message: 'ลบข่าวสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/announcements/:id/toggle (admin — toggle active)
router.patch('/announcements/:id/toggle', authenticate, authorize('admin'), async (req, res) => {
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

module.exports = router;
