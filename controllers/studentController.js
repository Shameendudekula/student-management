const Student = require('../models/Student');
const { COURSES } = require('../config/constants');

// Only these fields can be set from a request body. Anything else (_id, createdAt, …) is ignored,
// so a client can't overwrite fields it shouldn't control.
const EDITABLE_FIELDS = ['name', 'rollNumber', 'email', 'phone', 'course', 'year', 'gender', 'dateOfBirth', 'address'];
const OPTIONAL_FIELDS = ['dateOfBirth', 'address'];
const SORT_OPTIONS = ['name', '-name', 'rollNumber', '-rollNumber', 'year', '-year', 'createdAt', '-createdAt'];

function pickEditable(body = {}) {
  const data = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] === undefined) continue;
    // An empty optional field means "clear it", not "save an empty string"
    data[field] = OPTIONAL_FIELDS.includes(field) && body[field] === '' ? null : body[field];
  }
  return data;
}

// ?search=a&search=b arrives as an array; just use the first value
const firstValue = (v) => (Array.isArray(v) ? v[0] : v);

// Escape regex special characters so a search like "a+b" is matched literally
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/students?search=&course=&year=&page=&limit=&sort=
exports.getStudents = async (req, res) => {
  const search = String(firstValue(req.query.search) ?? '').trim();
  const course = firstValue(req.query.course);
  const year = firstValue(req.query.year);
  const sort = SORT_OPTIONS.includes(firstValue(req.query.sort)) ? firstValue(req.query.sort) : '-createdAt';
  const page = Math.max(1, parseInt(firstValue(req.query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(firstValue(req.query.limit), 10) || 10));

  const filter = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { rollNumber: rx }, { email: rx }];
  }
  if (course) {
    if (!COURSES.includes(course)) return res.status(400).json({ message: `Unknown course "${course}"` });
    filter.course = course;
  }
  if (year) {
    if (!['1', '2', '3', '4'].includes(String(year))) return res.status(400).json({ message: 'Year filter must be 1–4' });
    filter.year = Number(year);
  }

  // Tie-breaker on _id so students with equal sort values (e.g. same createdAt after seeding)
  // always come back in the same order and never repeat or vanish between pages
  const sortSpec = `${sort} ${sort.startsWith('-') ? '-_id' : '_id'}`;

  // Run the page query and the count in parallel
  const [students, total] = await Promise.all([
    Student.find(filter).sort(sortSpec).skip((page - 1) * limit).limit(limit).lean(),
    Student.countDocuments(filter),
  ]);

  res.json({
    data: students,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

// GET /api/students/stats – numbers for the dashboard cards
exports.getStats = async (req, res) => {
  const [total, byCourse, byYear] = await Promise.all([
    Student.countDocuments(),
    Student.aggregate([{ $group: { _id: '$course', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Student.aggregate([{ $group: { _id: '$year', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);

  res.json({
    total,
    byCourse: byCourse.map((c) => ({ course: c._id, count: c.count })),
    byYear: byYear.map((y) => ({ year: y._id, count: y.count })),
  });
};

// GET /api/students/:id
exports.getStudent = async (req, res) => {
  const student = await Student.findById(req.params.id).lean();
  if (!student) return res.status(404).json({ message: 'Student not found' });
  res.json({ data: student });
};

// POST /api/students
exports.createStudent = async (req, res) => {
  const student = await Student.create(pickEditable(req.body));
  res.status(201).json({ message: 'Student added', data: student });
};

// PUT /api/students/:id
exports.updateStudent = async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });

  // Assign then save() so every schema validator runs, exactly as on create
  student.set(pickEditable(req.body));
  await student.save();
  res.json({ message: 'Student updated', data: student });
};

// DELETE /api/students/:id
exports.deleteStudent = async (req, res) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  res.json({ message: 'Student deleted', data: { _id: student._id } });
};
