const router = require('express').Router();
const { authenticateToken } = require('../middleware/auth');
const {
  updateLesson, deleteLesson,
  createQuestions, replaceQuestions, getQuestions,
} = require('../controllers/lesson.controller');
const { watchLesson, submitTest } = require('../controllers/progress.controller');

// Lesson CRUD
router.put('/:id', authenticateToken, updateLesson);
router.delete('/:id', authenticateToken, deleteLesson);

// Questions
router.get('/:lessonId/questions', authenticateToken, getQuestions);
router.post('/:lessonId/questions', authenticateToken, createQuestions);
router.put('/:lessonId/questions', authenticateToken, replaceQuestions);

// Progress
router.post('/:lessonId/watch', authenticateToken, watchLesson);
router.post('/:lessonId/submit', authenticateToken, submitTest);

module.exports = router;
