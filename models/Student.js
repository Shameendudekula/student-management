const mongoose = require('mongoose');
const { COURSES, GENDERS } = require('../config/constants');

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name must be at most 80 characters'],
    },
    rollNumber: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
      uppercase: true, // "cs2023001" and "CS2023001" count as the same roll number
      match: [/^[A-Z0-9-]{3,20}$/, 'Roll number may only contain letters, digits and "-" (3–20 characters)'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^\+?[0-9 ]{7,15}$/, 'Phone must be 7–15 digits, optionally starting with +'],
    },
    course: {
      type: String,
      required: [true, 'Course is required'],
      enum: { values: COURSES, message: 'Course must be one of: ' + COURSES.join(', ') },
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1, 'Year must be between 1 and 4'],
      max: [4, 'Year must be between 1 and 4'],
      validate: { validator: Number.isInteger, message: 'Year must be a whole number' },
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: { values: GENDERS, message: 'Gender must be one of: ' + GENDERS.join(', ') },
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: (d) => !d || d < new Date(),
        message: 'Date of birth must be in the past',
      },
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Address must be at most 200 characters'],
    },
  },
  // timestamps adds createdAt and updatedAt automatically
  { timestamps: true }
);

// Indexes that speed up the common list queries
studentSchema.index({ course: 1 });
studentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Student', studentSchema);
