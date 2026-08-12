const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');

// POST /api/admin/delete-student-data — ลบข้อมูลนักศึกษาแบบกลุ่ม/เลือกตามเงื่อนไข
router.post('/delete-student-data', authenticate, authorize('admin'), async (req, res) => {
  const {
    studentIds,
    deleteRequests = true,
    deleteCheckins = true,
    deletePayments = true,
    deleteUser = false,
  } = req.body;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุรายชื่อนักศึกษาที่ต้องการลบ' });
  }

  try {
    for (const sid of studentIds) {
      const studentIdStr = String(sid);

      // 1. Delete Requests & linked evaluation tables
      if (deleteRequests) {
        const [reqRows] = await pool.query(
          'SELECT id FROM requests WHERE studentId = ?',
          [studentIdStr]
        );
        const reqIds = reqRows.map(r => r.id);
        if (reqIds.length > 0) {
          await pool.query('DELETE FROM advisor_evaluations WHERE requestId IN (?)', [reqIds]);
          await pool.query('DELETE FROM evaluations WHERE requestId IN (?)', [reqIds]);
          await pool.query('DELETE FROM requests WHERE id IN (?)', [reqIds]);
        }
      }

      // 2. Delete Daily Checkins
      if (deleteCheckins) {
        await pool.query('DELETE FROM daily_checkins WHERE studentId = ?', [studentIdStr]);
      }

      // 3. Delete Payment Proofs
      if (deletePayments) {
        await pool.query('DELETE FROM payment_proofs WHERE studentId = ?', [studentIdStr]);
      }

      // 4. Delete User Account & Profile if requested
      if (deleteUser) {
        await pool.query('DELETE FROM `profile` WHERE profile_id = ?', [studentIdStr]);
        await pool.query('DELETE FROM `user` WHERE username = ? OR email = ?', [studentIdStr, studentIdStr]);
      }
    }

    return res.json({ success: true, message: 'ลบข้อมูลที่เลือกเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('Error deleting student data:', err);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล: ' + err.message });
  }
});

module.exports = router;
