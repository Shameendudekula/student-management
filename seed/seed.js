// npm run seed – replaces all students in the database from MONGO_URI with the sample data
require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Student = require('../models/Student');
const students = require('./students');

async function seed() {
  try {
    await connectDB(process.env.MONGO_URI);
    await Student.init();
    const { deletedCount } = await Student.deleteMany({});
    const inserted = await Student.insertMany(students);
    console.log(`Removed ${deletedCount} existing students, inserted ${inserted.length} sample students.`);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
