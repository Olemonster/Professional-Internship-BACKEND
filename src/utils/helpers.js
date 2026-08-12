const toFrontendUser = (row) => {
  if (!row) return null;
  const fullName = (row.firstname && row.lastname)
    ? `${row.firstname} ${row.lastname}`.trim()
    : (row.name || row.username);

  return {
    id:            String(row.id),
    username:      row.username,
    email:         row.email || row.username,
    name:          fullName,
    full_name:     fullName,
    role:          row.role,
    studentId:     row.profile_id || (row.role === 'student' ? row.username : ''),
    student_code:  row.profile_id || (row.role === 'student' ? row.username : ''),
    firstname:     row.firstname || '',
    lastname:      row.lastname || '',
    faculty_id:    row.faculty_id || null,
    department_id: row.department_id || null,
    department:    row.department || '',
    major:         row.department || '',
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
         p.profile_id, p.firstname, p.lastname, p.faculty_id, p.department_id, p.address AS profile_address
  FROM \`user\` u
  LEFT JOIN \`profile\` p ON (p.profile_id = u.username OR p.profile_id = u.email)
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
  toFrontendUser,
  USER_SELECT_SQL,
  parseRequestRow,
  normalizeCompanyName,
  addCompanyEntry,
};
