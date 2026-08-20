const cron = require('node-cron');
const pool = require('../config/db');

const initCronJobs = () => {
  // รันทุกเที่ยงคืน (0 0 * * *) เพื่อเช็ควันที่เริ่มฝึกงานและอนุมัติอัตโนมัติ
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Running daily check for internship start dates...');
    try {
      const [requests] = await pool.query("SELECT id, details FROM requests WHERE status IN ('รออาจารย์อนุมัติเริ่มฝึกงาน', 'รอแอดมินอนุมัติเริ่มฝึกงาน', 'รอแอดมินอนุมัติการออกฝึกงาน', 'อนุมัติแล้ว')");
      let updatedCount = 0;

      for (const req of requests) {
        if (req.details) {
          let detailsObj = req.details;
          if (typeof req.details === 'string') {
            try { detailsObj = JSON.parse(req.details); } catch (_) {}
          }

          if (detailsObj.startDate) {
            const startDate = new Date(detailsObj.startDate);
            const today = new Date();

            startDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            if (today >= startDate) {
              await pool.query("UPDATE requests SET status = 'ออกฝึกงาน' WHERE id = ?", [req.id]);
              updatedCount++;
            }
          }
        }
      }
      if (updatedCount > 0) {
        console.log(`[Cron] Auto-approved ${updatedCount} requests to 'ออกฝึกงาน'.`);
      }
    } catch (error) {
      console.error('[Cron Error]', error);
    }
  });
};

module.exports = initCronJobs;
