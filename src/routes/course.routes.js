const router = require('express').Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getCourses, getCourse, createCourse, updateCourse, deleteCourse,
  enroll, getStudents, kickStudent, approveRequest, rejectRequest,
} = require('../controllers/course.controller');
const { getLessons, createLesson } = require('../controllers/lesson.controller');
const { getCourseProgress } = require('../controllers/progress.controller');
const { getReviews, createReview } = require('../controllers/review.controller');

// Public
router.get('/', getCourses);
router.get('/:id', getCourse);

// Course CRUD
router.post('/', authenticateToken, createCourse);
router.put('/:id', authenticateToken, updateCourse);
router.delete('/:id', authenticateToken, deleteCourse);

// Enrollment
router.post('/:id/enroll', authenticateToken, enroll);
router.get('/:id/students', authenticateToken, getStudents);
router.delete('/:id/students/:userId', authenticateToken, kickStudent);
router.put('/:id/requests/:userId/approve', authenticateToken, approveRequest);
router.put('/:id/requests/:userId/reject', authenticateToken, rejectRequest);

// Lessons (nested) — public list, progress/watch/submit require auth
router.get('/:courseId/lessons', getLessons);
router.post('/:courseId/lessons', authenticateToken, createLesson);

// Progress
router.get('/:courseId/progress', authenticateToken, getCourseProgress);

// Reviews
router.get('/:id/reviews', getReviews);
router.post('/:id/reviews', authenticateToken, createReview);

module.exports = router;
