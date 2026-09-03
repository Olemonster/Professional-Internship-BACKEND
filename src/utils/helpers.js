const DEPARTMENT_MAP = {
  1: 'สาขาวิชาวิทยาการคอมพิวเตอร์',
  2: 'สาขาวิชาเทคโนโลยีคอมพิวเตอร์และดิจิทัล',
  3: 'สาขาวิชาสาธารณสุขชุมชน',
  4: 'สาขาวิชาวิทยาศาสตร์การกีฬา',
  5: 'สาขาวิชาเทคโนโลยีการเกษตร',
  6: 'สาขาวิชาเทคโนโลยีและนวัตกรรมอาหาร',
  7: 'สาขาวิชาอาชีวอนามัยและความปลอดภัย',
  8: 'สาขาวิชาวิศวกรรมซอฟต์แวร์และปัญญาประดิษฐ์',
  9: 'สาขาวิชาวิศวกรรมโลจิสติกส์',
  10: 'สาขาวิชาวิศวกรรมการจัดการอุตสาหกรรมและสิ่งแวดล้อม',
  11: 'สาขาวิชาการออกแบบผลิตภัณฑ์และนวัตกรรมวัสดุ',
  12: 'สาขาวิชาเทคโนโลยีโยธาและสถาปัตยกรรม',
};

const DEPARTMENT_NAME_TO_ID = Object.entries(DEPARTMENT_MAP).reduce((acc, [id, name]) => {
  acc[name] = Number(id);
  return acc;
}, {});

const toFrontendUser = (row) => {
  if (!row) return null;
  const fullName = (row.firstname && row.lastname)
    ? `${row.firstname} ${row.lastname}`.trim()
    : (row.name || row.username);

  const deptId = row.department_id
    ? Number(row.department_id)
    : (row.department ? (DEPARTMENT_NAME_TO_ID[row.department] || null) : null);

  const deptName = row.department
    ? row.department
    : (deptId && DEPARTMENT_MAP[deptId] ? DEPARTMENT_MAP[deptId] : '');

  return {
    id:            String(row.id),
    username:      row.username,
    email:         row.email || row.username,
    name:          fullName,
    full_name:     fullName,
    role:          row.role,
    studentId:     row.profile_id || row.studentId || (row.role === 'student' ? row.username : ''),
    student_code:  row.profile_id || row.studentId || (row.role === 'student' ? row.username : ''),
    firstname:     row.firstname || '',
    lastname:      row.lastname || '',
    faculty_id:    row.faculty_id || null,
    department_id: deptId,
    department:    deptName,
    major:         deptName,
    address:       row.address || row.profile_address || '',
    phone:         row.phone || '',
    avatar:        row.avatar || null,
    isActive:      row.isActive,
    is_active:     row.isActive,
    createdAt:     row.createdAt,
    updatedAt:     row.updatedAt,
  };
};

const USER_SELECT_SQL = `
  SELECT u.*, 
         MAX(p.profile_id) AS profile_id, 
         MAX(p.firstname) AS firstname, 
         MAX(p.lastname) AS lastname, 
         MAX(p.faculty_id) AS faculty_id, 
         MAX(p.department_id) AS department_id, 
         MAX(p.address) AS profile_address,
         MAX(p.phone) AS profile_phone
  FROM \`user\` u
  LEFT JOIN \`profile\` p ON (p.profile_id = u.username OR p.profile_id = u.email OR (u.studentId IS NOT NULL AND u.studentId != '' AND p.profile_id = u.studentId))
`;

const parseRequestRow = (row) => {
  if (!row) return null;
  const parsed = { ...row };
  if (typeof parsed.details === 'string') {
    try { parsed.details = JSON.parse(parsed.details); } catch (_) {}
  }
  if (typeof parsed.dispatchLetter === 'string') {
    try { parsed.dispatchLetter = JSON.parse(parsed.dispatchLetter); } catch (_) {}
  }
  if (typeof parsed.supervisionAppointment === 'string') {
    try { parsed.supervisionAppointment = JSON.parse(parsed.supervisionAppointment); } catch (_) {}
  }
  if (typeof parsed.supervisionReport === 'string') {
    try { parsed.supervisionReport = JSON.parse(parsed.supervisionReport); } catch (_) {}
  }
  if (parsed.internship_start_date) {
    try {
      const d = new Date(parsed.internship_start_date);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        parsed.internship_start_date = `${year}-${month}-${day}`;
      }
    } catch (_) {}
  }
  if (parsed.internship_end_date) {
    try {
      const d = new Date(parsed.internship_end_date);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        parsed.internship_end_date = `${year}-${month}-${day}`;
      }
    } catch (_) {}
  }
  if (parsed.details && typeof parsed.details === 'object') {
    if (parsed.internship_start_date && !parsed.details.startDate) {
      parsed.details.startDate = parsed.internship_start_date;
    }
    if (parsed.internship_end_date && !parsed.details.endDate) {
      parsed.details.endDate = parsed.internship_end_date;
    }
    if (!parsed.internship_start_date && parsed.details.startDate) {
      parsed.internship_start_date = parsed.details.startDate;
    }
    if (!parsed.internship_end_date && parsed.details.endDate) {
      parsed.internship_end_date = parsed.details.endDate;
    }
  }
  return parsed;
};

const DEPARTMENT_KEYWORDS = {
  'สาขาวิชาวิทยาการคอมพิวเตอร์': ['คอมพิวเตอร์', 'ซอฟต์แวร์', 'โปรแกรมเมอร์', 'developer', 'software', 'programmer', 'web', 'เว็บ', 'it', 'ไอที', 'ระบบ', 'network', 'เน็ตเวิร์ก', 'เทคโนโลยี', 'database', 'frontend', 'backend', 'fullstack'],
  'สาขาวิชาเทคโนโลยีคอมพิวเตอร์และดิจิทัล': ['คอมพิวเตอร์', 'ดิจิทัล', 'ไอที', 'it', 'network', 'ฮาร์ดแวร์', 'ซ่อมบำรุง', 'สารสนเทศ', 'digital', 'graphic', 'กราฟิก'],
  'สาขาวิชาวิศวกรรมซอฟต์แวร์และปัญญาประดิษฐ์': ['วิศวกรรมซอฟต์แวร์', 'ปัญญาประดิษฐ์', 'ai', 'machine learning', 'software engineer', 'data', 'developer', 'โมบายแอป', 'mobile app'],
  'สาขาวิชาสาธารณสุขชุมชน': ['สาธารณสุข', 'รพ.', 'โรงพยาบาล', 'อนามัย', 'รพ.สต.', 'สุขภาพ', 'คลินิก', 'แพทย์', 'health', 'clinic'],
  'สาขาวิชาอาชีวอนามัยและความปลอดภัย': ['อาชีวอนามัย', 'ความปลอดภัย', 'จป', 'safety', 'สิ่งแวดล้อม', 'hse', 'osh', 'ตรวจความปลอดภัย'],
  'สาขาวิชาวิทยาศาสตร์การกีฬา': ['กีฬา', 'ฟิตเนส', 'การออกกำลังกาย', 'sport', 'fitness', 'gym', 'ยิม', 'เทรนเนอร์', 'กายภาพ'],
  'สาขาวิชาเทคโนโลยีการเกษตร': ['เกษตร', 'ฟาร์ม', 'พืช', 'สัตว์', 'เพาะปลูก', 'agri', 'farm', 'การเกษตร', 'ปศุสัตว์'],
  'สาขาวิชาเทคโนโลยีและนวัตกรรมอาหาร': ['อาหาร', 'เบเกอรี่', 'แปรรูปอาหาร', 'food', 'beverage', 'เครื่องดื่ม', 'โภชนาการ', 'ครัว', 'kitchen'],
  'สาขาวิชาวิศวกรรมโลจิสติกส์': ['โลจิสติกส์', 'คลังสินค้า', 'ขนส่ง', 'logistics', 'supply chain', 'warehouse', 'transport', 'ส่งออก', 'กระจายสินค้า'],
  'สาขาวิชาวิศวกรรมการจัดการอุตสาหกรรมและสิ่งแวดล้อม': ['อุตสาหกรรม', 'โรงงาน', 'การผลิต', 'คิวซี', 'qc', 'qa', 'industrial', 'factory', 'production', 'ควบคุมคุณภาพ'],
  'สาขาวิชาการออกแบบผลิตภัณฑ์และนวัตกรรมวัสดุ': ['ออกแบบ', 'ดีไซน์', 'บรรจุภัณฑ์', 'ผลิตภัณฑ์', 'product design', 'graphic design', 'ux', 'ui', 'creative'],
  'สาขาวิชาเทคโนโลยีโยธาและสถาปัตยกรรม': ['โยธา', 'สถาปัตยกรรม', 'ก่อสร้าง', 'สำรวจ', 'แบบแปลน', 'civil', 'architecture', 'construction', 'ช่างโยธา', 'ผังเมือง'],
};

const inferDepartments = (text = '') => {
  const t = String(text || '').toLowerCase();
  const matched = [];
  for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
    if (keywords.some(k => t.includes(k.toLowerCase()))) {
      matched.push(dept);
    }
  }
  return matched;
};

const normalizeCompanyName = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const addCompanyEntry = (map, entry) => {
  const key = normalizeCompanyName(entry.name);
  if (!key) return;

  const extractDepts = (item) => {
    let list = [];
    if (Array.isArray(item.departments)) {
      list = list.concat(item.departments);
    } else if (typeof item.departments === 'string' && item.departments.trim()) {
      try {
        const parsed = JSON.parse(item.departments);
        if (Array.isArray(parsed)) list = list.concat(parsed);
        else list.push(item.departments);
      } catch (_) {
        list = list.concat(item.departments.split(',').map(s => s.trim()));
      }
    }
    if (item.department && typeof item.department === 'string') {
      list = list.concat(item.department.split(',').map(s => s.trim()));
    }
    if (list.length === 0) {
      const combinedText = `${item.name || ''} ${item.businessType || ''} ${item.positions || ''}`;
      const inferred = inferDepartments(combinedText);
      if (inferred.length > 0) list = list.concat(inferred);
    }
    return Array.from(new Set(list.filter(Boolean)));
  };

  const incomingDepts = extractDepts(entry);

  if (map.has(key)) {
    const existing = map.get(key);
    if (
      (!existing.businessType || existing.businessType === 'ไม่ระบุประเภทธุรกิจ') &&
      entry.businessType
    ) {
      existing.businessType = entry.businessType;
    }
    if (!existing.address && entry.address) existing.address = entry.address;
    if (!existing.contactPerson && entry.contactPerson) existing.contactPerson = entry.contactPerson;
    if (!existing.phone && entry.phone) existing.phone = entry.phone;
    if (!existing.source && entry.source) existing.source = entry.source;
    if (entry.imageUrl) existing.imageUrl = entry.imageUrl;

    const merged = new Set([...(existing.departments || []), ...incomingDepts]);
    existing.departments = Array.from(merged);
    existing.department = existing.departments.join(', ');
    return;
  }

  entry.departments = incomingDepts;
  entry.department = incomingDepts.join(', ');

  map.set(key, { ...entry });
};

module.exports = {
  DEPARTMENT_MAP,
  DEPARTMENT_NAME_TO_ID,
  DEPARTMENT_KEYWORDS,
  inferDepartments,
  toFrontendUser,
  USER_SELECT_SQL,
  parseRequestRow,
  normalizeCompanyName,
  addCompanyEntry,
};
