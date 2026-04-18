const router = require('express').Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  getPending, approveCourse, rejectCourse, appealCourse,
} = require('../controllers/moderation.controller');

const isModerator = [authenticateToken, requireRole('moderator', 'admin')];

router.get('/pending', ...isModerator, getPending);
router.put('/:courseId/approve', ...isModerator, approveCourse);
router.put('/:courseId/reject', ...isModerator, rejectCourse);

// Author-only; role check handled inside controller
router.post('/:courseId/appeal', authenticateToken, appealCourse);

module.exports = router;
