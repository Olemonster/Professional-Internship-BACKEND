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
    const { studentId, studentName, date, status, note, workExperience, supervisorSignature, supervisorName, supervisorComment } = req.body;

    // Check internship start date
    if (studentId) {
      const [reqRows] = await pool.query(
        "SELECT internship_start_date, status, updated_at, submittedDate FROM requests WHERE (studentId = ? OR JSON_UNQUOTE(JSON_EXTRACT(details, '$.student_info.studentId')) = ?) AND status IN ('ออกฝึกงาน', 'ฝึกงานเสร็จแล้ว', 'ประเมินจากสถานประกอบการแล้ว', 'ประเมินจากอาจารย์แล้ว', 'เสร็จสิ้นสมบูรณ์') ORDER BY id DESC LIMIT 1",
        [studentId, studentId]
      );
      if (reqRows[0]) {
        const startDateStr = reqRows[0].internship_start_date 
          ? new Date(reqRows[0].internship_start_date).toISOString().slice(0, 10)
          : new Date(reqRows[0].updated_at || reqRows[0].submittedDate).toISOString().slice(0, 10);
        const checkinDateStr = String(date).split('T')[0];
        if (checkinDateStr < startDateStr) {
          return res.status(400).json({
            success: false,
            message: `ไม่สามารถบันทึกรายงานก่อนวันเริ่มฝึกงานได้ (วันเริ่มฝึกงานคือ: ${startDateStr})`
          });
        }
      }
    }

    const [existing] = await pool.query('SELECT id FROM daily_checkins WHERE studentId = ? AND date = ?', [studentId, date]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'คุณเช็คชื่อของวันนี้ไปแล้ว (จะรีเซ็ตในวันถัดไปหลัง 07:00 น.)' });
    }

    await pool.query(
      `INSERT INTO daily_checkins (studentId, studentName, date, status, note, work_experience, supervisor_signature, supervisor_name, supervisor_comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, studentName || null, date, status || 'present', note || null, workExperience || null, supervisorSignature || null, supervisorName || null, supervisorComment || null]
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

// PATCH /api/checkins/batch-sign — ให้พี่เลี้ยงเซ็นรับรองหลายๆ วันในคราวเดียว
router.patch('/batch-sign', authenticate, async (req, res) => {
  try {
    const { studentId, dates = [], checkinIds = [], supervisorSignature, supervisorName, supervisorComment } = req.body;

    if (!supervisorSignature) {
      return res.status(400).json({ success: false, message: 'กรุณาแนบลายเซ็นพี่เลี้ยง' });
    }

    if ((!dates || dates.length === 0) && (!checkinIds || checkinIds.length === 0)) {
      return res.status(400).json({ success: false, message: 'กรุณาเลือกวันที่ต้องการเซ็นรับรองอย่างน้อย 1 วัน' });
    }

    // Filter out dates strictly before internship_start_date
    let validDates = dates;
    if (studentId && dates.length > 0) {
      const [reqRows] = await pool.query(
        "SELECT internship_start_date, status, updated_at, submittedDate FROM requests WHERE (studentId = ? OR JSON_UNQUOTE(JSON_EXTRACT(details, '$.student_info.studentId')) = ?) AND status IN ('ออกฝึกงาน', 'ฝึกงานเสร็จแล้ว', 'ประเมินจากสถานประกอบการแล้ว', 'ประเมินจากอาจารย์แล้ว', 'เสร็จสิ้นสมบูรณ์') ORDER BY id DESC LIMIT 1",
        [studentId, studentId]
      );
      if (reqRows[0]) {
        const startDateStr = reqRows[0].internship_start_date 
          ? new Date(reqRows[0].internship_start_date).toISOString().slice(0, 10)
          : new Date(reqRows[0].updated_at || reqRows[0].submittedDate).toISOString().slice(0, 10);
        
        validDates = dates.filter(d => String(d).split('T')[0] >= startDateStr);
        if (validDates.length === 0) {
          return res.status(400).json({
            success: false,
            message: `ไม่สามารถเซ็นรับรองวันก่อนวันเริ่มฝึกงานได้ (วันเริ่มฝึกงานคือ: ${startDateStr})`
          });
        }
      }
    }

    // 1. If checkinIds provided
    if (checkinIds.length > 0) {
      await pool.query(
        `UPDATE daily_checkins 
         SET supervisor_signature = ?, supervisor_name = ?, supervisor_comment = ?
         WHERE id IN (?)`,
        [supervisorSignature, supervisorName || null, supervisorComment || null, checkinIds]
      );
    }

    // 2. If dates & studentId provided (for matching existing or creating entries by date)
    if (validDates.length > 0 && studentId) {
      for (const date of validDates) {
        const [existing] = await pool.query('SELECT id FROM daily_checkins WHERE studentId = ? AND date = ?', [studentId, date]);
        if (existing.length > 0) {
          await pool.query(
            `UPDATE daily_checkins 
             SET supervisor_signature = ?, supervisor_name = ?, supervisor_comment = ?
             WHERE studentId = ? AND date = ?`,
            [supervisorSignature, supervisorName || null, supervisorComment || null, studentId, date]
          );
        } else {
          await pool.query(
            `INSERT INTO daily_checkins (studentId, studentName, date, status, note, work_experience, supervisor_signature, supervisor_name, supervisor_comment)
             VALUES (?, ?, ?, 'present', 'บันทึกและลงชื่อรับรองย้อนหลังโดยพี่เลี้ยง', 'ปฏิบัติงานประจำวัน', ?, ?, ?)
             ON DUPLICATE KEY UPDATE supervisor_signature = VALUES(supervisor_signature), supervisor_name = VALUES(supervisor_name), supervisor_comment = VALUES(supervisor_comment)`,
            [studentId, req.body.studentName || null, date, supervisorSignature, supervisorName || null, supervisorComment || null]
          );
        }
      }
    }

    const [rows] = await pool.query('SELECT * FROM daily_checkins WHERE studentId = ? ORDER BY date DESC', [studentId]);
    res.json({
      success: true,
      message: `บันทึกลายเซ็นพี่เลี้ยงรับรองเรียบร้อยแล้ว (${dates.length || checkinIds.length} วัน)`,
      data: rows,
    });
  } catch (error) {
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
