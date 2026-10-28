const express = require('express');
const ctrl = require('../controllers/studentController');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

router.route('/').get(ctrl.getStudents).post(ctrl.createStudent);

// Must come before '/:id', otherwise "stats" would be treated as an id
router.get('/stats', ctrl.getStats);

router
  .route('/:id')
  .all(validateObjectId)
  .get(ctrl.getStudent)
  .put(ctrl.updateStudent)
  .delete(ctrl.deleteStudent);

module.exports = router;
