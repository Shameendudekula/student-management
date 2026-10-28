const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) throw new Error('MONGO_URI is not set. Copy .env.example to .env and add your MongoDB Atlas connection string.');
  // Close pooled connections after 60 s idle, so a request after a laptop sleep or network change
  // doesn't pick up a dead connection (which shows up as "read ECONNRESET")
  await mongoose.connect(uri, { maxIdleTimeMS: 60_000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
