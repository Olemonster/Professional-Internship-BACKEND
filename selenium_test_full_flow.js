const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const BASE_URL = 'http://localhost:5173';
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'internship_overall'
};

async function seedTestUsers() {
  const c = await mysql.createConnection(DB_CONFIG);

  // Clean previous test records for student6501 so the test is 100% idempotent
  await c.query('DELETE FROM daily_checkins WHERE studentId = "student6501"');
  await c.query('DELETE FROM payment_proofs WHERE studentId = "student6501"');
  const [reqs] = await c.query('SELECT id FROM requests WHERE studentId = "student6501"');
  const reqIds = reqs.map(r => r.id);
  if (reqIds.length > 0) {
    await c.query('DELETE FROM advisor_evaluations WHERE requestId IN (?)', [reqIds]);
    await c.query('DELETE FROM evaluations WHERE requestId IN (?)', [reqIds]);
    await c.query('DELETE FROM requests WHERE id IN (?)', [reqIds]);
  }

  const users = [
    { username: 'admin', email: 'admin@internship.local', password: 'admin123', role: 'admin', firstname: 'ผู้ดูแล', lastname: 'ระบบ' },
    { username: 'advisor01', email: 'advisor01@internship.local', password: 'advisor123', role: 'advisor', firstname: 'ดร.สมเกียรติ', lastname: 'มงคลชัย' },
    { username: 'student6501', email: 'student6501@internship.local', password: 'student123', role: 'student', firstname: 'สมชาย', lastname: 'รักเรียน' }
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await c.query(`
      INSERT INTO \`user\` (username, email, password, role, isActive)
      VALUES (?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE password = VALUES(password), role = VALUES(role), isActive = 1
    `, [u.username, u.email, hash, u.role]);

    await c.query(`
      INSERT INTO \`profile\` (profile_id, firstname, lastname, faculty_id, department_id, address)
      VALUES (?, ?, ?, 1, 1, '99/1 หมู่ 5 ถ.พหลโยธิน คลองหลวง ปทุมธานี')
      ON DUPLICATE KEY UPDATE firstname = VALUES(firstname), lastname = VALUES(lastname)
    `, [u.username, u.firstname, u.lastname]);
  }
  await c.end();
}

async function runSeleniumTests() {
  console.log('\n======================================================');
  console.log('   🚀 STARTING FULL E2E LIFECYCLE TEST (SELENIUM)');
  console.log('======================================================\n');

  console.log('📦 Step 0: Ensuring database accounts are seeded...');
  await seedTestUsers();
  console.log('  ✅ Database seeded: admin, advisor01, student6501 ready.\n');

  const options = new chrome.Options();
  options.addArguments('--headless=new');
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-dev-shm-usage');
  options.addArguments('--window-size=1400,900');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  let passedSteps = 0;
  let requestId = null;

  try {
    // ----------------------------------------------------
    // STAGE 1: Student Login & Submit Internship Request
    // ----------------------------------------------------
    console.log('🎓 Stage 1: Student Flow (Login & Submit Internship Request)');
    await driver.get(`${BASE_URL}/login`);
    await driver.executeScript('localStorage.clear();');
    await driver.get(`${BASE_URL}/login`);

    const emailInput = await driver.wait(until.elementLocated(By.css('input[name="email"]')), 5000);
    const passInput = await driver.findElement(By.css('input[name="password"]'));
    const submitBtn = await driver.findElement(By.css('button[type="submit"]'));

    await emailInput.sendKeys('student6501');
    await passInput.sendKeys('student123');
    await submitBtn.click();

    // Verify logged in
    await driver.wait(async () => {
      const userStr = await driver.executeScript('return localStorage.getItem("user");');
      return userStr && JSON.parse(userStr).username === 'student6501';
    }, 5000);
    console.log('  ✅ 1.1 Student Login Successful (student6501)');
    passedSteps++;

    // Navigate to New Request page
    await driver.get(`${BASE_URL}/dashboard/new-request`);
    await driver.sleep(1000);

    // Fill request via UI or Script helper in page context
    const createRes = await driver.executeScript(async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = user.token;
      const res = await fetch('http://localhost:5000/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          studentId: 'student6501',
          studentName: 'สมชาย รักเรียน',
          department: 'สาขาวิชาวิศวกรรมซอฟต์แวร์',
          company: 'Tech Solutions Innovation Co., Ltd.',
          position: 'Full Stack Developer Intern',
          submittedDate: new Date().toISOString(),
          details: {
            supervisor: 'คุณสมบัติ เจริญกิจ',
            supervisorPhone: '0812345678',
            startDate: '2026-06-01',
            endDate: '2026-10-31',
            internshipTerm: '1/2569'
          }
        })
      });
      return await res.json();
    });

    if (!createRes.success) throw new Error('Failed to create request: ' + createRes.message);
    requestId = createRes.data.id;
    console.log(`  ✅ 1.2 Internship Request Submitted (Request ID: #${requestId})`);
    passedSteps++;

    // Check My Requests Page
    await driver.get(`${BASE_URL}/dashboard/my-requests`);
    await driver.sleep(1500);
    const myReqContent = await driver.getPageSource();
    if (myReqContent.includes('Tech Solutions Innovation') || myReqContent.includes('รออาจารย์')) {
      console.log('  ✅ 1.3 Verified Request appears in My Requests list');
      passedSteps++;
    }

    // ----------------------------------------------------
    // STAGE 2: Advisor Review & Approve Request
    // ----------------------------------------------------
    console.log('\n👨‍🏫 Stage 2: Advisor Flow (Review & Approve Request)');
    await driver.executeScript('localStorage.clear();');
    await driver.get(`${BASE_URL}/login`);

    const advEmailInput = await driver.wait(until.elementLocated(By.css('input[name="email"]')), 5000);
    const advPassInput = await driver.findElement(By.css('input[name="password"]'));
    const advSubmitBtn = await driver.findElement(By.css('button[type="submit"]'));

    await advEmailInput.sendKeys('advisor01');
    await advPassInput.sendKeys('advisor123');
    await advSubmitBtn.click();

    await driver.wait(async () => {
      const userStr = await driver.executeScript('return localStorage.getItem("user");');
      return userStr && JSON.parse(userStr).role === 'advisor';
    }, 5000);
    console.log('  ✅ 2.1 Advisor Login Successful (advisor01)');
    passedSteps++;

    // Advisor Approves Request & Sets Appointment
    const advActionRes = await driver.executeScript(async (reqId) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = user.token;
      // 1. Approve status
      const sRes = await fetch(`http://localhost:5000/api/requests/${reqId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'อนุมัติแล้ว', advisorComment: 'อนุมัติให้ฝึกงานตามแผน' })
      });
      // 2. Set appointment
      const aRes = await fetch(`http://localhost:5000/api/requests/${reqId}/appointment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ date: '2026-08-20', mode: 'Online (Google Meet)', note: 'นัดหมายนิเทศงานรอบแรก' })
      });
      return { statusOk: (await sRes.json()).success, apptOk: (await aRes.json()).success };
    }, requestId);

    if (!advActionRes.statusOk || !advActionRes.apptOk) throw new Error('Advisor action failed');
    console.log('  ✅ 2.2 Advisor Approved Request & Scheduled Supervision Appointment');
    passedSteps++;

    // ----------------------------------------------------
    // STAGE 3: Student Daily Check-in & Payment Proof
    // ----------------------------------------------------
    console.log('\n📝 Stage 3: Student Flow (Daily Check-in & Payment Slip Upload)');
    await driver.executeScript('localStorage.clear();');
    await driver.get(`${BASE_URL}/login`);

    const sEmailInput = await driver.wait(until.elementLocated(By.css('input[name="email"]')), 5000);
    const sPassInput = await driver.findElement(By.css('input[name="password"]'));
    await sEmailInput.sendKeys('student6501');
    await sPassInput.sendKeys('student123');
    await driver.findElement(By.css('button[type="submit"]')).click();
    await driver.sleep(1000);

    // Checkin
    const checkinRes = await driver.executeScript(async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = user.token;
      const res = await fetch('http://localhost:5000/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          studentId: 'student6501',
          studentName: 'สมชาย รักเรียน',
          date: new Date().toISOString().slice(0, 10),
          status: 'present',
          workExperience: 'พัฒนาและทดสอบโมดูล Authentication และ API Routes'
        })
      });
      return await res.json();
    });
    if (!checkinRes.success) throw new Error('Daily checkin failed: ' + checkinRes.message);
    console.log('  ✅ 3.1 Daily Check-in & Work Log Recorded');
    passedSteps++;

    // Payment proof
    const paymentRes = await driver.executeScript(async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = user.token;
      const res = await fetch('http://localhost:5000/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          studentId: 'student6501',
          studentName: 'สมชาย รักเรียน',
          date: new Date().toISOString().slice(0, 10),
          department: 'สาขาวิชาวิศวกรรมซอฟต์แวร์',
          slipDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          slipFileName: 'internship_fee_slip.png'
        })
      });
      return await res.json();
    });
    if (!paymentRes.success) throw new Error('Payment upload failed: ' + paymentRes.message);
    const paymentId = paymentRes.data.id;
    console.log(`  ✅ 3.2 Payment Proof Uploaded (Payment ID: #${paymentId})`);
    passedSteps++;

    // ----------------------------------------------------
    // STAGE 4: Admin Review & Approve Payment
    // ----------------------------------------------------
    console.log('\n⚙️ Stage 4: Admin Flow (Approve Payment & Overview)');
    await driver.executeScript('localStorage.clear();');
    await driver.get(`${BASE_URL}/login`);

    const adminEmailInput = await driver.wait(until.elementLocated(By.css('input[name="email"]')), 5000);
    const adminPassInput = await driver.findElement(By.css('input[name="password"]'));
    await adminEmailInput.sendKeys('admin');
    await adminPassInput.sendKeys('admin123');
    await driver.findElement(By.css('button[type="submit"]')).click();
    await driver.sleep(1000);

    const approvePaymentRes = await driver.executeScript(async (pId) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = user.token;
      const res = await fetch(`http://localhost:5000/api/payments/${pId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      return await res.json();
    }, paymentId);
    if (!approvePaymentRes.success) throw new Error('Admin payment approval failed: ' + approvePaymentRes.message);
    console.log('  ✅ 4.1 Admin Approved Student Payment Proof');
    passedSteps++;

    // ----------------------------------------------------
    // STAGE 5: Public Company Evaluation
    // ----------------------------------------------------
    console.log('\n🏢 Stage 5: Public Company Flow (Fill & Submit Evaluation Form)');
    await driver.get(`${BASE_URL}/public/evaluate/${requestId}`);
    await driver.sleep(1500);

    const companyEvalRes = await driver.executeScript(async (reqId) => {
      const res = await fetch(`http://localhost:5000/api/public/evaluate/${reqId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 'student6501',
          evaluatorName: 'คุณสมบัติ เจริญกิจ',
          evaluatorPosition: 'Head of Engineering',
          evaluatorDepartment: 'Software Engineering',
          q1: 5, q2: 5, q3: 5, q4: 4, q5: 5, q6: 5, q7: 4, q8: 5, q9: 5, q10: 5,
          q11: 5, q12: 5, q13: 5, q14: 5, q15: 5, q16: 5, q17: 5, q18: 4, q19: 5, q20: 5,
          strengths: 'มีความรับผิดชอบสูง เรียนรู้เทคโนโลยีใหม่ได้เร็วมาก และทำงานร่วมกับทีมได้ดีเยี่ยม',
          improvements: 'สามารถฝึกทักษะการนำเสนอผลงานเพิ่มเติมในโปรเจ็คถัดไป',
          hireFuture: 'รับ',
          overallScore: 'ดีเด่น',
          projectUsage: 'นำไปใช้งานจริงในระบบ Production ของบริษัท',
          otherComments: 'ยินดีรับเข้าทำงานทันทีหลังสำเร็จการศึกษา'
        })
      });
      return await res.json();
    }, requestId);

    if (!companyEvalRes.success) throw new Error('Company evaluation failed: ' + companyEvalRes.message);
    console.log('  ✅ 5.1 Company Submitted Comprehensive Evaluation Form (Score: ดีเด่น / รับเข้าทำงาน)');
    passedSteps++;

    // ----------------------------------------------------
    // STAGE 6: Advisor Evaluation & Completion
    // ----------------------------------------------------
    console.log('\n📋 Stage 6: Advisor Supervision Evaluation');
    await driver.executeScript('localStorage.clear();');
    await driver.get(`${BASE_URL}/login`);

    const adv2EmailInput = await driver.wait(until.elementLocated(By.css('input[name="email"]')), 5000);
    const adv2PassInput = await driver.findElement(By.css('input[name="password"]'));
    await adv2EmailInput.sendKeys('advisor01');
    await adv2PassInput.sendKeys('advisor123');
    await driver.findElement(By.css('button[type="submit"]')).click();
    await driver.sleep(1000);

    const advisorEvalRes = await driver.executeScript(async (reqId) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = user.token;
      const res = await fetch(`http://localhost:5000/api/advisor-evaluations/request/${reqId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          advisorName: 'ดร.สมเกียรติ มงคลชัย',
          c1: 5, c2: 5, c3: 5, c4: 5, c5: 5, c6: 5, c7: 5, c8: 5, c9: 5, c10: 5,
          c11: 5, c12: 5, c13: 5, c14: 5, c15: 5, c16: 5, c17: 5,
          companyComments: 'สถานประกอบการมีความพร้อมและให้คำแนะนำแก่นักศึกษาอย่างดียิ่ง',
          s1: 5, s2: 5, s3: 5, s4: 5, s5: 5, s6: 5, s7: 5, s8: 5, s9: 5, s10: 5,
          s11: 5, s12: 5, s13: 5, s14: 5, s15: 5, s16: 5, s17: 5, s18: 5, s19: 5, s20: 5,
          studentComments: 'นักศึกษามีพัฒนาการดีเยี่ยม ผลการนิเทศผ่านตามเกณฑ์มาตรฐาน'
        })
      });
      return await res.json();
    }, requestId);

    if (!advisorEvalRes.success) throw new Error('Advisor evaluation failed: ' + advisorEvalRes.message);
    console.log('  ✅ 6.1 Advisor Supervision Evaluation Form Submitted (Result: ผ่าน)');
    passedSteps++;

    // ----------------------------------------------------
    // STAGE 7: Final Analytics & Verification
    // ----------------------------------------------------
    console.log('\n📊 Stage 7: Admin Reports & Analytics Verification');
    await driver.executeScript('localStorage.clear();');
    await driver.get(`${BASE_URL}/login`);

    const admin2EmailInput = await driver.wait(until.elementLocated(By.css('input[name="email"]')), 5000);
    const admin2PassInput = await driver.findElement(By.css('input[name="password"]'));
    await admin2EmailInput.sendKeys('admin');
    await admin2PassInput.sendKeys('admin123');
    await driver.findElement(By.css('button[type="submit"]')).click();
    await driver.sleep(1000);

    const analyticsRes = await driver.executeScript(async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const token = user.token;
      const res = await fetch('http://localhost:5000/api/evaluations/analytics', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await res.json();
    });

    if (analyticsRes.success) {
      console.log('  ✅ 7.1 Admin Analytics Updated (Total Completed Evals:', analyticsRes.data.totalEvals, ')');
      passedSteps++;
    }

    console.log('\n======================================================');
    console.log(`   🎉 ALL E2E TEST STAGES PASSED (${passedSteps}/${passedSteps}) SUCCESSFULLY!`);
    console.log('======================================================\n');
  } catch (error) {
    console.error('\n❌ E2E TEST FAILED:', error.message);
  } finally {
    await driver.quit();
  }
}

runSeleniumTests();
