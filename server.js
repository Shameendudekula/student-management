require('dotenv').config({ quiet: true });

const app = require('./app');
const connectDB = require('./config/db');
const Student = require('./models/Student');

const PORT = process.env.PORT || 5050;

async function start() {
  try {
    await connectDB(process.env.MONGO_URI);
    // Make sure the unique indexes on rollNumber and email exist before accepting requests
    await Student.init();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
