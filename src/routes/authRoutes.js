const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const { toFrontendUser, USER_SELECT_SQL } = require('../utils/helpers');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก username และ password' });
    }

    const [rows] = await pool.query(
      `${USER_SELECT_SQL} WHERE u.username = ? OR u.email = ? GROUP BY u.id`,
      [email, email]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'บัญชีถูกระงับการใช้งาน' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'ไม่พบผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret_key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', token, user: toFrontendUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(`${USER_SELECT_SQL} WHERE u.id = ? GROUP BY u.id`, [req.user.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    res.json({ success: true, user: toFrontendUser(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
