const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middlewares/auth');
const { toFrontendUser, USER_SELECT_SQL, DEPARTMENT_MAP, DEPARTMENT_NAME_TO_ID } = require('../utils/helpers');

// GET /api/users — ดึงผู้ใช้ทั้งหมด
router.get('/', authenticate, async (req, res) => {
  try {
    const { role, search } = req.query;
    let sql = `${USER_SELECT_SQL} WHERE 1=1`;
    const params = [];

    if (role) { sql += ' AND u.role = ?'; params.push(role); }
    if (search) {
      sql += ' AND (u.username LIKE ? OR u.email LIKE ? OR p.firstname LIKE ? OR p.lastname LIKE ? OR p.profile_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    sql += ' GROUP BY u.id ORDER BY u.createdAt DESC';
    const [rows] = await pool.query(sql, params);
    let users = rows.map(toFrontendUser);

    if (role === 'student') {
      const allowedPrefixes = ['66', '67', '68', '69'];
      users = users.filter(student => {
        const code = String(student.student_code || student.studentId || student.username || '').trim();
        return allowedPrefixes.some(prefix => code.startsWith(prefix)) || code.startsWith('student');
      });
    }

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(`${USER_SELECT_SQL} WHERE u.id = ? GROUP BY u.id`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    res.json({ success: true, data: toFrontendUser(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/users — สร้างผู้ใช้ใหม่ (Admin เท่านั้น)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { username, email, password, role, name, firstname, lastname, address, faculty_id, department_id, department } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอก username และ password' });
    }

    const emailToUse = (email && email.trim()) ? email.trim() : username.trim();

    const [existing] = await pool.query('SELECT id FROM `user` WHERE username = ? OR email = ?', [username, emailToUse]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Username หรือ Email นี้ถูกใช้งานแล้ว' });
    }

    const targetDeptId = department_id ? Number(department_id) : (department ? (DEPARTMENT_NAME_TO_ID[department] || 0) : 0);
    const targetDeptName = department || (targetDeptId && DEPARTMENT_MAP[targetDeptId] ? DEPARTMENT_MAP[targetDeptId] : '');

    const hashedPassword = await bcrypt.hash(password || '123456', 10);
    const [result] = await pool.query(
      'INSERT INTO `user` (username, email, password, role, department) VALUES (?, ?, ?, ?, ?)',
      [username, emailToUse, hashedPassword, role || 'student', targetDeptName || null]
    );

    let fn = firstname || '';
    let ln = lastname || '';
    if (name && !fn && !ln) {
      const parts = name.trim().split(/\s+/);
      fn = parts[0] || '';
      ln = parts.slice(1).join(' ') || '';
    }

    if (fn || ln || address || faculty_id || targetDeptId) {
      await pool.query(
        `INSERT INTO \`profile\` (profile_id, firstname, lastname, faculty_id, department_id, address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [username, fn, ln, faculty_id || 0, targetDeptId, address || null]
      );
    }

    const [newUser] = await pool.query(`${USER_SELECT_SQL} WHERE u.id = ? GROUP BY u.id`, [result.insertId]);
    res.status(201).json({ success: true, message: 'สร้างผู้ใช้สำเร็จ', data: toFrontendUser(newUser[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/users/import — นำเข้าผู้ใช้หลายคน (Admin)
router.post('/import', authenticate, authorize('admin'), async (req, res) => {
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
        const [existing] = await pool.query('SELECT id FROM `user` WHERE username = ?', [row.username]);
        if (existing.length > 0) {
          errors.push({ index: i, message: `${row.username} ซ้ำกับผู้ใช้เดิม` });
          continue;
        }

        const targetDeptId = row.department_id ? Number(row.department_id) : (row.department ? (DEPARTMENT_NAME_TO_ID[row.department] || 0) : 0);
        const targetDeptName = row.department || (targetDeptId && DEPARTMENT_MAP[targetDeptId] ? DEPARTMENT_MAP[targetDeptId] : '');

        const hashedPassword = await bcrypt.hash(row.password || '123456', 10);
        await pool.query(
          'INSERT INTO `user` (username, email, password, role, department) VALUES (?, ?, ?, ?, ?)',
          [row.username, row.email || row.username, hashedPassword, row.role || 'student', targetDeptName || null]
        );

        let fn = row.firstname || '';
        let ln = row.lastname || '';
        if (row.name && !fn && !ln) {
          const parts = row.name.trim().split(/\s+/);
          fn = parts[0] || '';
          ln = parts.slice(1).join(' ') || '';
        }

        if (fn || ln || row.address || targetDeptId) {
          await pool.query(
            `INSERT INTO \`profile\` (profile_id, firstname, lastname, faculty_id, department_id, address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [row.username, fn, ln, row.faculty_id || 0, targetDeptId, typeof row.address === 'object' ? JSON.stringify(row.address) : (row.address || null)]
          );
        }

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

// PUT /api/users/:id — อัปเดตผู้ใช้
router.put('/:id', authenticate, async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT * FROM `user` WHERE id = ?', [req.params.id]);
    if (!userRows[0]) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    const current = userRows[0];

    const allowedUserKeys = ['username', 'email', 'role', 'isActive', 'phone'];
    const userUpdates = [];
    const userParams = [];

    for (const key of allowedUserKeys) {
      if (req.body[key] !== undefined) {
        userUpdates.push(`\`${key}\` = ?`);
        userParams.push(req.body[key]);
      }
    }

    let targetDeptId = req.body.department_id !== undefined ? Number(req.body.department_id) : (req.body.department ? DEPARTMENT_NAME_TO_ID[req.body.department] : undefined);
    let targetDeptName = req.body.department !== undefined ? req.body.department : (targetDeptId && DEPARTMENT_MAP[targetDeptId] ? DEPARTMENT_MAP[targetDeptId] : undefined);

    if (targetDeptName !== undefined) {
      userUpdates.push('`department` = ?');
      userParams.push(targetDeptName);
    }

    if (req.body.password) {
      userUpdates.push('`password` = ?');
      userParams.push(await bcrypt.hash(req.body.password, 10));
    }

    if (userUpdates.length > 0) {
      userParams.push(req.params.id);
      await pool.query(`UPDATE \`user\` SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
    }

    let fn = req.body.firstname;
    let ln = req.body.lastname;
    if (req.body.name && (fn === undefined || ln === undefined)) {
      const parts = req.body.name.trim().split(/\s+/);
      fn = parts[0] || '';
      ln = parts.slice(1).join(' ') || '';
    }

    const profileId = req.body.username || current.username;
    if (fn !== undefined || ln !== undefined || req.body.address !== undefined || req.body.faculty_id !== undefined || targetDeptId !== undefined || req.body.phone !== undefined) {
      const [pRows] = await pool.query('SELECT id FROM `profile` WHERE profile_id = ?', [profileId]);
      if (pRows.length > 0) {
        const pUpdates = [];
        const pParams = [];
        if (fn !== undefined) { pUpdates.push('`firstname` = ?'); pParams.push(fn); }
        if (ln !== undefined) { pUpdates.push('`lastname` = ?'); pParams.push(ln); }
        if (req.body.address !== undefined) { pUpdates.push('`address` = ?'); pParams.push(req.body.address); }
        if (req.body.faculty_id !== undefined) { pUpdates.push('`faculty_id` = ?'); pParams.push(req.body.faculty_id); }
        if (targetDeptId !== undefined) { pUpdates.push('`department_id` = ?'); pParams.push(targetDeptId); }
        if (req.body.phone !== undefined) { pUpdates.push('`phone` = ?'); pParams.push(req.body.phone); }
        if (pUpdates.length > 0) {
          pParams.push(pRows[0].id);
          await pool.query(`UPDATE \`profile\` SET ${pUpdates.join(', ')} WHERE id = ?`, pParams);
        }
      } else {
        await pool.query(
          `INSERT INTO \`profile\` (profile_id, firstname, lastname, faculty_id, department_id, address, phone)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [profileId, fn || '', ln || '', req.body.faculty_id || 0, targetDeptId || 0, req.body.address || null, req.body.phone || null]
        );
      }
    }

    const [updated] = await pool.query(`${USER_SELECT_SQL} WHERE u.id = ? GROUP BY u.id`, [req.params.id]);
    res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ', data: toFrontendUser(updated[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/users/:id — ลบผู้ใช้และข้อมูลทั้งหมดที่เกี่ยวข้อง (Admin เท่านั้น)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [userRows] = await pool.query('SELECT username, email FROM `user` WHERE id = ?', [req.params.id]);
    if (!userRows[0]) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    const { username, email } = userRows[0];

    const identifiers = [username, email].filter(Boolean);

    // 1. ลบ requests และแบบประเมินที่เชื่อมโยง
    const [reqRows] = await pool.query('SELECT id FROM requests WHERE studentId IN (?)', [identifiers]);
    const reqIds = reqRows.map(r => r.id);
    if (reqIds.length > 0) {
      await pool.query('DELETE FROM advisor_evaluations WHERE requestId IN (?)', [reqIds]);
      await pool.query('DELETE FROM evaluations WHERE requestId IN (?)', [reqIds]);
      await pool.query('DELETE FROM requests WHERE id IN (?)', [reqIds]);
    }

    // 2. ลบ daily_checkins
    await pool.query('DELETE FROM daily_checkins WHERE studentId IN (?)', [identifiers]);

    // 3. ลบ payment_proofs
    await pool.query('DELETE FROM payment_proofs WHERE studentId IN (?)', [identifiers]);

    // 4. ลบ profile
    await pool.query('DELETE FROM `profile` WHERE profile_id IN (?)', [identifiers]);

    // 5. ลบ user
    const [result] = await pool.query('DELETE FROM `user` WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });

    res.json({ success: true, message: 'ลบผู้ใช้และข้อมูลทั้งหมดที่เกี่ยวข้องสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
