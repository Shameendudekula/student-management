// API tests: run with `npm test`. They start a temporary in-memory MongoDB,
// so they never touch your real Atlas database.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const Student = require('../models/Student');

let mongo;

const valid = (overrides = {}) => ({
  name: 'Asha Reddy',
  rollNumber: 'CS2023001',
  email: 'asha@example.com',
  phone: '+91 9876543210',
  course: 'Computer Science',
  year: 2,
  gender: 'Female',
  dateOfBirth: '2005-04-12',
  address: 'Anantapur, Andhra Pradesh',
  ...overrides,
});

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Student.init();
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Student.deleteMany({});
});

test('GET /api/health reports ok and a connected database', async () => {
  const res = await request(app).get('/api/health').expect(200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.database, 'connected');
});

test('GET /api/meta returns courses and genders', async () => {
  const res = await request(app).get('/api/meta').expect(200);
  assert.ok(res.body.courses.includes('Computer Science'));
  assert.deepEqual(res.body.genders, ['Male', 'Female', 'Other']);
});

test('POST creates a student (201) and normalises roll number and email', async () => {
  const res = await request(app).post('/api/students').send(valid({ rollNumber: 'cs2023001', email: 'ASHA@Example.com' })).expect(201);
  assert.equal(res.body.data.rollNumber, 'CS2023001');
  assert.equal(res.body.data.email, 'asha@example.com');
  assert.ok(res.body.data.createdAt);
});

test('POST ignores fields that are not editable', async () => {
  const res = await request(app).post('/api/students').send(valid({ createdAt: '1999-01-01', isAdmin: true })).expect(201);
  assert.notEqual(new Date(res.body.data.createdAt).getFullYear(), 1999);
  assert.equal(res.body.data.isAdmin, undefined);
});

test('POST with missing / invalid fields returns 400 with a message per field', async () => {
  const res = await request(app)
    .post('/api/students')
    .send({ name: 'A', email: 'not-an-email', year: 7, course: 'Astrology', gender: 'x', phone: '12' })
    .expect(400);
  assert.equal(res.body.message, 'Validation failed');
  for (const f of ['name', 'rollNumber', 'email', 'year', 'course', 'gender', 'phone']) {
    assert.ok(res.body.errors[f], `expected an error for ${f}`);
  }
});

test('POST with a non-numeric year or future birth date returns 400', async () => {
  let res = await request(app).post('/api/students').send(valid({ year: 'two' })).expect(400);
  assert.ok(res.body.errors.year);
  res = await request(app).post('/api/students').send(valid({ dateOfBirth: '2999-01-01' })).expect(400);
  assert.match(res.body.errors.dateOfBirth, /past/);
});

test('POST with a duplicate roll number or email returns 409', async () => {
  await request(app).post('/api/students').send(valid()).expect(201);
  let res = await request(app).post('/api/students').send(valid({ email: 'other@example.com', rollNumber: 'cs2023001' })).expect(409);
  assert.ok(res.body.errors.rollNumber);
  res = await request(app).post('/api/students').send(valid({ rollNumber: 'CS2023999', email: 'Asha@example.com' })).expect(409);
  assert.ok(res.body.errors.email);
});

test('POST with malformed JSON returns 400', async () => {
  await request(app).post('/api/students').set('Content-Type', 'application/json').send('{"name": ').expect(400);
});

test('GET list supports search, course/year filters and pagination', async () => {
  const courses = ['Computer Science', 'Mechanical', 'Civil'];
  await Student.create(
    Array.from({ length: 12 }, (_, i) =>
      valid({ name: `Student ${i}`, rollNumber: `R${100 + i}`, email: `s${i}@example.com`, course: courses[i % 3], year: (i % 4) + 1 })
    )
  );

  let res = await request(app).get('/api/students?limit=5&page=3').expect(200);
  assert.equal(res.body.data.length, 2);
  assert.deepEqual(res.body.pagination, { page: 3, limit: 5, total: 12, totalPages: 3 });

  res = await request(app).get('/api/students?search=r105').expect(200);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.data[0].rollNumber, 'R105');

  res = await request(app).get('/api/students?search=S7@EXAMPLE').expect(200);
  assert.equal(res.body.data.length, 1);

  res = await request(app).get('/api/students?course=Mechanical').expect(200);
  assert.equal(res.body.pagination.total, 4);
  assert.ok(res.body.data.every((s) => s.course === 'Mechanical'));

  res = await request(app).get('/api/students?course=Mechanical&year=2').expect(200);
  assert.ok(res.body.data.every((s) => s.course === 'Mechanical' && s.year === 2));

  res = await request(app).get('/api/students?sort=name&limit=100').expect(200);
  assert.equal(res.body.data[0].name, 'Student 0');
});

test('GET list pages never repeat or skip students that share the same createdAt', async () => {
  const sameTime = new Date('2026-01-01T00:00:00Z');
  await Student.collection.insertMany(
    Array.from({ length: 15 }, (_, i) => ({ ...valid({ rollNumber: `T${i}`, email: `t${i}@example.com` }), createdAt: sameTime }))
  );
  const seen = [];
  for (const page of [1, 2, 3]) {
    const res = await request(app).get(`/api/students?limit=5&page=${page}`).expect(200);
    seen.push(...res.body.data.map((s) => s.rollNumber));
  }
  assert.equal(new Set(seen).size, 15);
});

test('GET list: regex characters in search are matched literally, bad filters return 400', async () => {
  await Student.create(valid());
  const res = await request(app).get('/api/students?search=.*').expect(200);
  assert.equal(res.body.data.length, 0);
  await request(app).get('/api/students?course=Astrology').expect(400);
  await request(app).get('/api/students?year=9').expect(400);
});

test('GET /:id returns the student, 404 when missing, 400 for a malformed id', async () => {
  const created = await Student.create(valid());
  const res = await request(app).get(`/api/students/${created._id}`).expect(200);
  assert.equal(res.body.data.name, 'Asha Reddy');
  await request(app).get(`/api/students/${new mongoose.Types.ObjectId()}`).expect(404);
  await request(app).get('/api/students/abc').expect(400);
});

test('PUT updates a student and re-runs validation', async () => {
  const created = await Student.create(valid());
  let res = await request(app).put(`/api/students/${created._id}`).send(valid({ name: 'Asha R.', year: 3, address: '' })).expect(200);
  assert.equal(res.body.data.name, 'Asha R.');
  assert.equal(res.body.data.year, 3);
  assert.equal(res.body.data.address, null);

  res = await request(app).put(`/api/students/${created._id}`).send({ year: 5 }).expect(400);
  assert.ok(res.body.errors.year);
  await request(app).put(`/api/students/${new mongoose.Types.ObjectId()}`).send(valid()).expect(404);
});

test('PUT to an email or roll number used by another student returns 409', async () => {
  await Student.create(valid());
  const other = await Student.create(valid({ rollNumber: 'CS2023002', email: 'ravi@example.com' }));
  await request(app).put(`/api/students/${other._id}`).send({ email: 'asha@example.com' }).expect(409);
  await request(app).put(`/api/students/${other._id}`).send({ rollNumber: 'CS2023001' }).expect(409);
});

test('DELETE removes the student; deleting again returns 404', async () => {
  const created = await Student.create(valid());
  await request(app).delete(`/api/students/${created._id}`).expect(200);
  assert.equal(await Student.countDocuments(), 0);
  await request(app).delete(`/api/students/${created._id}`).expect(404);
});

test('GET /stats returns totals per course and year', async () => {
  await Student.create([
    valid(),
    valid({ rollNumber: 'ME1', email: 'me1@example.com', course: 'Mechanical', year: 1 }),
    valid({ rollNumber: 'ME2', email: 'me2@example.com', course: 'Mechanical', year: 1 }),
  ]);
  const res = await request(app).get('/api/students/stats').expect(200);
  assert.equal(res.body.total, 3);
  assert.deepEqual(res.body.byCourse[0], { course: 'Mechanical', count: 2 });
  assert.deepEqual(res.body.byYear, [{ year: 1, count: 2 }, { year: 2, count: 1 }]);
});

test('Unknown API routes return 404 JSON; the frontend is served at /', async () => {
  const res = await request(app).get('/api/nope').expect(404);
  assert.match(res.body.message, /Route not found/);
  await request(app).get('/').expect(200).expect('Content-Type', /html/);
});
