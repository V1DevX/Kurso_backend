const router = require('express').Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getStats, getUsers, banUser, unbanUser, changeRole } = require('../controllers/admin.controller');

router.use(authenticateToken, requireRole('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.put('/users/:id/ban', banUser);
router.put('/users/:id/unban', unbanUser);
router.put('/users/:id/role', changeRole);

module.exports = router;
