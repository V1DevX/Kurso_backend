const router = require('express').Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { aiModerate } = require('../controllers/moderation.controller');

router.post('/moderate', authenticateToken, requireRole('moderator', 'admin'), aiModerate);

module.exports = router;
