// Single source of truth for dropdown values. The frontend loads these from GET /api/meta
// so the form options and the database validation can never drift apart.
const COURSES = [
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Electrical',
  'Mechanical',
  'Civil',
];

const GENDERS = ['Male', 'Female', 'Other'];

module.exports = { COURSES, GENDERS };
