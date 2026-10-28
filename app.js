const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const studentRoutes = require('./routes/studentRoutes');
const { COURSES, GENDERS } = require('./config/constants');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// The app is built here and started in server.js, so tests can use it without opening a port
const app = express();

// The frontend is served by this same server, so CORS only matters if CLIENT_URL is set
// (e.g. a frontend hosted elsewhere during development)
app.use(cors(process.env.CLIENT_URL ? { origin: process.env.CLIENT_URL.split(',') } : undefined));
app.use(express.json({ limit: '100kb' }));

// API
app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({ status: 'ok', database: dbStates[mongoose.connection.readyState] || 'unknown', uptime: Math.round(process.uptime()) });
});
app.get('/api/meta', (req, res) => res.json({ courses: COURSES, genders: GENDERS }));
app.use('/api/students', studentRoutes);
app.use('/api', notFound);

// Frontend (public/index.html, css, js)
app.use(express.static(path.join(__dirname, 'public')));

app.use(errorHandler);

module.exports = app;
