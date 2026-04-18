const { User, Course, Enrollment } = require('../models');

// GET /api/admin/stats
const getStats = async (req, res) => {
  const [
    totalUsers,
    bannedUsers,
    totalCourses,
    pendingCourses,
    approvedCourses,
    rejectedCourses,
    totalEnrollments,
    xpResult,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ banned: true }),
    Course.countDocuments(),
    Course.countDocuments({ status: 'pending' }),
    Course.countDocuments({ status: 'approved' }),
    Course.countDocuments({ status: 'rejected' }),
    Enrollment.countDocuments({ status: 'active' }),
    User.aggregate([{ $group: { _id: null, total: { $sum: '$xp' } } }]),
  ]);

  res.json({
    users: { total: totalUsers, banned: bannedUsers },
    courses: { total: totalCourses, pending: pendingCourses, approved: approvedCourses, rejected: rejectedCourses },
    enrollments: totalEnrollments,
    totalXp: xpResult[0]?.total || 0,
  });
};

// GET /api/admin/users?page=1&search=
const getUsers = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const search = req.query.search?.trim();

  const filter = search
    ? { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] }
    : {};

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({ users, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
};

// PUT /api/admin/users/:id/ban
const banUser = async (req, res) => {
  const { bannedUntil, banReason } = req.body;

  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'Cannot ban yourself' });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.role === 'admin') return res.status(403).json({ message: 'Cannot ban another admin' });

  user.banned = true;
  user.bannedUntil = bannedUntil ? new Date(bannedUntil) : null;
  user.banReason = banReason || '';
  await user.save();

  res.json({ message: 'User banned', banned: true, bannedUntil: user.bannedUntil });
};

// PUT /api/admin/users/:id/unban
const unbanUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  user.banned = false;
  user.bannedUntil = null;
  user.banReason = '';
  await user.save();

  res.json({ message: 'User unbanned', banned: false });
};

// PUT /api/admin/users/:id/role
const changeRole = async (req, res) => {
  const { role } = req.body;
  if (!['user', 'moderator', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'Cannot change your own role' });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  ).select('-password');

  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};

module.exports = { getStats, getUsers, banUser, unbanUser, changeRole };
