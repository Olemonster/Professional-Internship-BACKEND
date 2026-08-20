const DEPARTMENT_MAP = {
  1: 'สาขาวิชาวิทยาการคอมพิวเตอร์',
  2: 'สาขาวิชาเทคโนโลยีคอมพิวเตอร์และดิจิทัล',
  3: 'สาขาวิชาสาธารณสุขชุมชน',
  4: 'สาขาวิชาวิทยาศาสตร์การกีฬา',
  5: 'สาขาวิชาเทคโนโลยีการเกษตร',
  6: 'สาขาวิชาเทคโนโลยีและนวัตกรรมอาหาร',
  7: 'สาขาวิชาอาชีวอนามัยและความปลอดภัย',
  8: 'สาขาวิชาวิศวกรรมซอฟต์แวร์',
  9: 'สาขาวิชาวิศวกรรมโลจิสติกส์',
  10: 'สาขาวิศวกรรมการจัดการอุตสาหกรรมและสิ่งแวดล้อม',
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
         MAX(p.address) AS profile_address
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
  return parsed;
};

const normalizeCompanyName = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const addCompanyEntry = (map, entry) => {
  const key = normalizeCompanyName(entry.name);
  if (!key) return;

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
    return;
  }

  map.set(key, { ...entry });
};

module.exports = {
  DEPARTMENT_MAP,
  DEPARTMENT_NAME_TO_ID,
  toFrontendUser,
  USER_SELECT_SQL,
  parseRequestRow,
  normalizeCompanyName,
  addCompanyEntry,
};
