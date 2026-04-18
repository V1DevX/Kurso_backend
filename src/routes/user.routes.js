const router = require('express').Router();
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { getMe, updateMe, uploadAvatar, getUserById, getMyCourses, becomeAuthor } = require('../controllers/user.controller');

router.get('/me', authenticateToken, getMe);
router.put('/me', authenticateToken, updateMe);
router.post('/me/avatar', authenticateToken, upload.single('avatar'), uploadAvatar);
router.get('/me/courses', authenticateToken, getMyCourses);
router.post('/me/become-author', authenticateToken, becomeAuthor);

// Public — must come after /me routes to avoid :id capturing "me"
router.get('/:id', getUserById);

module.exports = router;
