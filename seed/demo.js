// npm run demo – runs the full app on a temporary in-memory MongoDB filled with the sample data.
// Handy for trying the app without a MongoDB Atlas connection. Data is lost when you stop it.
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Student = require('../models/Student');
const students = require('./students');

const PORT = process.env.PORT || 5050;

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Student.init();
  await Student.insertMany(students);
  app.listen(PORT, () => console.log(`Demo running on http://localhost:${PORT} (in-memory database, ${students.length} sample students)`));

  const shutdown = async () => { await mongoose.disconnect(); await mongo.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
