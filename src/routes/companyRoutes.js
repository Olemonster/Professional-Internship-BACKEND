const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { normalizeCompanyName, addCompanyEntry } = require('../utils/helpers');

// GET /api/public/companies — แคตตาล็อกบริษัทจากรุ่นพี่ที่ฝึกงานเสร็จแล้ว
router.get('/companies', async (req, res) => {
  try {
    const map = new Map();

    const [requestRows] = await pool.query(`
      SELECT * FROM requests 
      WHERE status IN ('ฝึกงานเสร็จแล้ว', 'ประเมินเสร็จแล้ว', 'ผ่านการฝึกงาน', 'ออกฝึกงาน', 'อนุมัติแล้ว')
      ORDER BY updated_at DESC
    `);

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

      addCompanyEntry(map, {
        name: companyName,
        businessType: request.position ? `ตำแหน่งงาน: ${request.position}` : 'ไม่ระบุประเภทธุรกิจ',
        address: rawDetails.companyAddress || request.address || '',
        contactPerson: rawDetails.contactPerson || rawDetails.supervisor || '',
        phone: rawDetails.phone || rawDetails.supervisorPhone || '',
        source: 'จากรุ่นพี่ที่ฝึกงานเสร็จแล้ว',
        imageUrl: rawDetails.imageUrl || null,
      });
    });

    const data = Array.from(map.values()).slice(0, 30);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Public companies error:', error);
    res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูลบริษัทได้' });
  }
});

module.exports = router;
