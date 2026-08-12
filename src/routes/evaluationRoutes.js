const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticate } = require('../middlewares/auth');
const { parseRequestRow } = require('../utils/helpers');

// =============================================
// Company Evaluations (Public & Analytics)
// =============================================

// GET /api/public/evaluate/request/:id
router.get('/public/evaluate/request/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM requests WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำร้อง' });

    const [evalRows] = await pool.query('SELECT id FROM evaluations WHERE requestId = ?', [req.params.id]);
    if (evalRows.length > 0) {
      return res.json({ success: true, evaluated: true, message: 'นักศึกษาคนนี้ได้รับการประเมินแล้ว' });
    }
    res.json({ success: true, evaluated: false, data: parseRequestRow(rows[0]) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/public/evaluate/:requestId
router.post('/public/evaluate/:requestId', async (req, res) => {
  try {
    const reqId = req.params.requestId;
    const {
      studentId, evaluatorName, evaluatorPosition, evaluatorDepartment,
      q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, q16, q17, q18, q19, q20,
      strengths, improvements, hireFuture, overallScore, projectUsage, otherComments, signature
    } = req.body;

    await pool.query(
      `INSERT INTO evaluations (
        requestId, studentId, evaluatorName, evaluatorPosition, evaluatorDepartment,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, q16, q17, q18, q19, q20,
        strengths, improvements, hireFuture, overallScore, projectUsage, otherComments, signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reqId, studentId, evaluatorName, evaluatorPosition, evaluatorDepartment,
        q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13, q14, q15, q16, q17, q18, q19, q20,
        strengths, improvements, hireFuture, overallScore, projectUsage, otherComments, signature || null
      ]
    );

    await pool.query('UPDATE requests SET status = ? WHERE id = ?', ['ประเมินเสร็จแล้ว', reqId]);
    res.status(201).json({ success: true, message: 'บันทึกผลการประเมินสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/evaluations/request/:requestId
router.get('/evaluations/request/:requestId', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM evaluations WHERE requestId = ?', [req.params.requestId]);
    if (!rows[0]) return res.json({ success: true, data: null });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/evaluations/analytics
router.get('/evaluations/analytics', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const [rows] = await pool.query(`
      SELECT 
        r.department, 
        r.company,
        e.q1, e.q2, e.q3, e.q4, e.q5, e.q6, e.q7, e.q8, e.q9, e.q10,
        e.q11, e.q12, e.q13, e.q14, e.q15, e.q16, e.q17, e.q18, e.q19, e.q20,
        e.hireFuture
      FROM evaluations e
      JOIN requests r ON e.requestId = r.id
      WHERE r.status IN ('ประเมินเสร็จแล้ว', 'ฝึกงานเสร็จแล้ว')
    `);

    const deptStats = {};
    const companyStats = {};
    let totalEvals = 0;

    rows.forEach(row => {
      totalEvals++;
      if (!deptStats[row.department]) {
        deptStats[row.department] = {
          count: 0,
          cat1: { sum: 0, count: 0 },
          cat2: { sum: 0, count: 0 },
          cat3: { sum: 0, count: 0 }
        };
      }
      deptStats[row.department].count++;

      const sumAvg = (start, end, targetObj) => {
        for(let i=start; i<=end; i++) {
          const val = row[`q${i}`];
          if (val && !isNaN(val)) {
            targetObj.sum += parseInt(val);
            targetObj.count++;
          }
        }
      };

      sumAvg(1, 2, deptStats[row.department].cat1);
      sumAvg(3, 14, deptStats[row.department].cat2);
      sumAvg(15, 20, deptStats[row.department].cat3);

      if (row.company) {
        if (!companyStats[row.company]) {
          companyStats[row.company] = { total: 0, hire: 0, maybe: 0, no: 0 };
        }
        companyStats[row.company].total++;
        if (row.hireFuture === 'รับ') companyStats[row.company].hire++;
        else if (row.hireFuture === 'ไม่แน่ใจ') companyStats[row.company].maybe++;
        else if (row.hireFuture === 'ไม่รับ') companyStats[row.company].no++;
      }
    });

    const formattedDeptStats = Object.keys(deptStats).map(dept => {
      const d = deptStats[dept];
      return {
        department: dept,
        count: d.count,
        avgCat1: d.cat1.count > 0 ? (d.cat1.sum / d.cat1.count).toFixed(2) : 0,
        avgCat2: d.cat2.count > 0 ? (d.cat2.sum / d.cat2.count).toFixed(2) : 0,
        avgCat3: d.cat3.count > 0 ? (d.cat3.sum / d.cat3.count).toFixed(2) : 0,
      };
    });

    res.json({ 
      success: true, 
      data: {
        totalEvals,
        departments: formattedDeptStats,
        companies: companyStats
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================
// Advisor Evaluations
// =============================================

// GET /api/advisor-evaluations/request/:requestId
router.get('/advisor-evaluations/request/:requestId', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM advisor_evaluations WHERE requestId = ?', [req.params.requestId]);
    if (!rows[0]) return res.json({ success: true, data: null });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/advisor-evaluations/request/:requestId
router.post('/advisor-evaluations/request/:requestId', authenticate, async (req, res) => {
  try {
    const reqId = req.params.requestId;
    const {
      advisorName,
      c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, companyComments,
      s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, studentComments
    } = req.body;

    const [existing] = await pool.query('SELECT id FROM advisor_evaluations WHERE requestId = ?', [reqId]);
    if (existing.length > 0) {
      await pool.query(
        `UPDATE advisor_evaluations SET 
          advisorName=?, c1=?, c2=?, c3=?, c4=?, c5=?, c6=?, c7=?, c8=?, c9=?, c10=?, c11=?, c12=?, c13=?, c14=?, c15=?, c16=?, c17=?, companyComments=?,
          s1=?, s2=?, s3=?, s4=?, s5=?, s6=?, s7=?, s8=?, s9=?, s10=?, s11=?, s12=?, s13=?, s14=?, s15=?, s16=?, s17=?, s18=?, s19=?, s20=?, studentComments=?
        WHERE requestId=?`,
        [
          advisorName, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, companyComments,
          s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, studentComments, reqId
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO advisor_evaluations (
          requestId, advisorName,
          c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, companyComments,
          s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, studentComments
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reqId, advisorName,
          c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, companyComments,
          s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, studentComments
        ]
      );
    }

    await pool.query(
      `UPDATE requests SET advisor_comment = ? WHERE id = ?`,
      ['ประเมินแบบฟอร์มละเอียดแล้ว (ผลการนิเทศ: ผ่าน)', reqId]
    );

    res.status(201).json({ success: true, message: 'บันทึกผลการนิเทศสำเร็จ' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
