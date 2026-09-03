const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { normalizeCompanyName, addCompanyEntry } = require('../utils/helpers');

// GET /api/public/companies — แคตตาล็อกสถานประกอบการทั้งหมด (ทั้งจากตาราง companies และคำร้องรุ่นพี่)
router.get('/companies', async (req, res) => {
  try {
    const { search, province, businessType } = req.query;
    const map = new Map();

    // 1. ดึงข้อมูลสถานประกอบการทางการจากตาราง companies
    let compSql = 'SELECT * FROM `companies` WHERE 1=1';
    const compParams = [];
    if (search) {
      compSql += ' AND (name LIKE ? OR businessType LIKE ? OR positions LIKE ? OR address LIKE ? OR province LIKE ?)';
      const s = `%${search}%`;
      compParams.push(s, s, s, s, s);
    }
    if (province && province !== 'all') {
      compSql += ' AND province = ?';
      compParams.push(province);
    }
    if (businessType && businessType !== 'all') {
      compSql += ' AND businessType LIKE ?';
      compParams.push(`%${businessType}%`);
    }
    compSql += ' ORDER BY id DESC';

    const [compRows] = await pool.query(compSql, compParams).catch(() => [[]]);
    compRows.forEach((comp) => {
      addCompanyEntry(map, {
        id: comp.id,
        name: comp.name,
        businessType: comp.businessType || 'ไม่ระบุประเภทธุรกิจ',
        address: comp.address || '',
        province: comp.province || '',
        contactPerson: comp.contactPerson || '',
        phone: comp.phone || '',
        email: comp.email || '',
        website: comp.website || '',
        positions: comp.positions || '',
        benefits: comp.benefits || '',
        imageUrl: comp.imageUrl || null,
        note: comp.note || '',
        department: comp.department || '',
        departments: comp.departments || comp.department || '',
        source: 'สถานประกอบการทางการ',
        isOfficial: true,
      });
    });

    // 2. ดึงข้อมูลสถานประกอบการเพิ่มเติมจากรุ่นพี่ที่ฝึกงานจนจบโฟลว์เสร็จสิ้นสมบูรณ์แล้ว
    const [requestRows] = await pool.query(`
      SELECT * FROM requests 
      WHERE status IN ('ฝึกงานเสร็จแล้ว', 'เสร็จสิ้นสมบูรณ์', 'ผ่านการฝึกงาน', 'ประเมินเสร็จแล้ว', 'ประเมินจากสถานประกอบการแล้ว', 'ประเมินจากอาจารย์แล้ว')
      ORDER BY updated_at DESC
    `).catch(() => [[]]);

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

      const normName = normalizeCompanyName(companyName);
      if (map.has(normName)) {
        // If official entry exists, add this request's department to the company's list
        const dept = request.department || rawDetails.department;
        if (dept) {
          const comp = map.get(normName);
          const depts = new Set(comp.departments || []);
          depts.add(dept);
          comp.departments = Array.from(depts);
          comp.department = comp.departments.join(', ');
        }
        return;
      }

      const positionStr = request.position || rawDetails.position || '';
      let addressRaw = rawDetails.companyAddress || request.address || '';
      let provinceStr = rawDetails.province || '';

      if (typeof addressRaw === 'object' && addressRaw !== null) {
        provinceStr = addressRaw.province || provinceStr;
        addressRaw = [
          addressRaw.house ? `เลขที่ ${addressRaw.house}` : '',
          addressRaw.moo ? `หมู่ ${addressRaw.moo}` : '',
          addressRaw.tambon ? `ต.${addressRaw.tambon}` : '',
          addressRaw.amphur ? `อ.${addressRaw.amphur}` : '',
          addressRaw.province ? `จ.${addressRaw.province}` : '',
          addressRaw.postal || '',
          addressRaw.detail || ''
        ].filter(Boolean).join(' ');
      }

      const addressStr = typeof addressRaw === 'string' ? addressRaw : '';
      const phoneStr = rawDetails.phone || rawDetails.supervisorPhone || '';
      const deptStr = request.department || rawDetails.department || '';

      if (search) {
        const s = search.toLowerCase();
        const matches = companyName.toLowerCase().includes(s) || 
                        positionStr.toLowerCase().includes(s) || 
                        addressStr.toLowerCase().includes(s) ||
                        deptStr.toLowerCase().includes(s);
        if (!matches) return;
      }

      addCompanyEntry(map, {
        id: `req-${request.id}`,
        name: companyName,
        businessType: positionStr ? `ตำแหน่งงาน: ${positionStr}` : 'สถานประกอบการจากรุ่นพี่',
        address: addressStr,
        province: provinceStr,
        contactPerson: rawDetails.contactPerson || rawDetails.supervisor || '',
        phone: phoneStr,
        email: rawDetails.email || '',
        website: '',
        positions: positionStr,
        benefits: '',
        imageUrl: rawDetails.imageUrl || null,
        department: deptStr,
        departments: deptStr ? [deptStr] : [],
        source: 'จากรุ่นพี่ที่ฝึกงานเสร็จแล้ว',
        isOfficial: false,
      });
    });

    const data = Array.from(map.values());
    res.json({ success: true, data });
  } catch (error) {
    console.error('Public companies error:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลสถานประกอบการได้' });
  }
});

// POST /api/public/companies/import — นำเข้าข้อมูลสถานประกอบการหลายแห่งผ่าน CSV
router.post('/companies/import', async (req, res) => {
  try {
    const { companies } = req.body;
    if (!Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ success: false, message: 'ข้อมูลนำเข้าว่างเปล่าหรือไม่ถูกต้อง' });
    }

    let inserted = 0;
    let errors = [];

    for (let i = 0; i < companies.length; i++) {
      const c = companies[i];
      const name = (c.name || c['ชื่อสถานประกอบการ'] || c['ชื่อบริษัท'] || '').trim();
      if (!name) continue;

      const businessType = (c.businessType || c['ประเภทธุรกิจ'] || c['ลักษณะงาน'] || '').trim();
      const address = (c.address || c['ที่อยู่'] || '').trim();
      const province = (c.province || c['จังหวัด'] || '').trim();
      const contactPerson = (c.contactPerson || c['ผู้ติดต่อ'] || c['ผู้ประสานงาน'] || '').trim();
      const phone = (c.phone || c['เบอร์โทร'] || c['เบอร์โทรศัพท์'] || '').trim();
      const email = (c.email || c['อีเมล'] || '').trim();
      const website = (c.website || c['เว็บไซต์'] || '').trim();
      const positions = (c.positions || c['ตำแหน่งที่รับ'] || c['ตำแหน่งงาน'] || '').trim();
      const benefits = (c.benefits || c['สวัสดิการ'] || '').trim();
      const note = (c.note || c['หมายเหตุ'] || '').trim();
      const department = (c.department || c['สาขา'] || c['สาขาวิชา'] || '').trim();

      try {
        await pool.query(
          `INSERT INTO \`companies\` (name, businessType, address, province, contactPerson, phone, email, website, positions, benefits, note, department, departments)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [name, businessType || null, address || null, province || null, contactPerson || null, phone || null, email || null, website || null, positions || null, benefits || null, note || null, department || null, department || null]
        );
        inserted++;
      } catch (err) {
        errors.push({ index: i + 1, name, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `นำเข้าข้อมูลสถานประกอบการสำเร็จ ${inserted} รายการ`,
      inserted,
      errors
    });
  } catch (error) {
    console.error('Import companies error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/public/companies — เพิ่มสถานประกอบการใหม่ (1 รายการ)
router.post('/companies', async (req, res) => {
  try {
    const { name, businessType, address, province, contactPerson, phone, email, website, positions, benefits, note, imageUrl, department, departments } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อสถานประกอบการ' });
    }

    const deptStr = Array.isArray(departments) ? departments.join(', ') : (department || null);
    const deptsJson = Array.isArray(departments) ? JSON.stringify(departments) : (departments || deptStr);

    const [result] = await pool.query(
      `INSERT INTO \`companies\` (name, businessType, address, province, contactPerson, phone, email, website, positions, benefits, note, imageUrl, department, departments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), businessType || null, address || null, province || null, contactPerson || null, phone || null, email || null, website || null, positions || null, benefits || null, note || null, imageUrl || null, deptStr, deptsJson]
    );

    const [newRow] = await pool.query('SELECT * FROM `companies` WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'เพิ่มสถานประกอบการสำเร็จ', data: newRow[0] });
  } catch (error) {
    console.error('Add company error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/public/companies/:id — อัปเดตข้อมูลสถานประกอบการ
router.put('/companies/:id', async (req, res) => {
  try {
    const { name, businessType, address, province, contactPerson, phone, email, website, positions, benefits, note, imageUrl, department, departments } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อสถานประกอบการ' });
    }

    const deptStr = Array.isArray(departments) ? departments.join(', ') : (department || null);
    const deptsJson = Array.isArray(departments) ? JSON.stringify(departments) : (departments || deptStr);

    await pool.query(
      `UPDATE \`companies\` SET name = ?, businessType = ?, address = ?, province = ?, contactPerson = ?, phone = ?, email = ?, website = ?, positions = ?, benefits = ?, note = ?, imageUrl = ?, department = ?, departments = ?
       WHERE id = ?`,
      [name.trim(), businessType || null, address || null, province || null, contactPerson || null, phone || null, email || null, website || null, positions || null, benefits || null, note || null, imageUrl || null, deptStr, deptsJson, req.params.id]
    );

    const [updated] = await pool.query('SELECT * FROM `companies` WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ', data: updated[0] });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/public/companies/batch — ลบหลายรายการ
router.post('/companies/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุรายการที่ต้องการลบ' });
    }

    await pool.query('DELETE FROM `companies` WHERE id IN (?)', [ids]);
    res.json({ success: true, message: `ลบสถานประกอบการเรียบร้อยแล้ว ${ids.length} รายการ` });
  } catch (error) {
    console.error('Batch delete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/public/companies/:id — ลบสถานประกอบการ
router.delete('/companies/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM `companies` WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'ลบสถานประกอบการเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/public/contact — ข้อมูลติดต่อแอดมินสำหรับแถบติดต่อด้านบน
router.get('/contact', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.email, u.phone, 
             p.firstname, p.lastname, p.phone as profile_phone
      FROM \`user\` u
      LEFT JOIN \`profile\` p ON (p.profile_id = u.username OR p.profile_id = u.email)
      WHERE u.role = 'admin'
      ORDER BY u.id ASC
      LIMIT 1
    `);

    if (rows.length > 0) {
      const admin = rows[0];
      const fullName = (admin.firstname && admin.lastname) 
        ? `${admin.firstname} ${admin.lastname}`.trim()
        : (admin.username || 'ผู้ดูแลระบบ');
      const phone = admin.phone || admin.profile_phone || '';
      const email = admin.email || '';

      return res.json({
        success: true,
        data: {
          name: fullName,
          email: email,
          phone: phone,
        }
      });
    }

    res.json({
      success: true,
      data: {
        name: 'ผู้ดูแลระบบ',
        email: '',
        phone: ''
      }
    });
  } catch (error) {
    console.error('Public contact error:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลติดต่อได้' });
  }
});

module.exports = router;
