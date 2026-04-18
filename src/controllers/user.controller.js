const { User, Enrollment, Course } = require('../models');
const { uploadToCloudinary } = require('../middleware/upload');

// GET /api/users/me
const getMe = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json(user);
};

// PUT /api/users/me
const updateMe = async (req, res) => {
  const { name, profession } = req.body;

  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (name !== undefined) user.name = name;
  if (profession !== undefined) user.profession = profession;

  await user.save();
  return res.json(user);
};

// POST /api/users/me/avatar
const uploadAvatar = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const result = await uploadToCloudinary(req.file.buffer, {
    folder: 'kurso/avatars',
    public_id: `user_${req.user.id}`,
    overwrite: true,
    transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }],
  });

  await User.updateOne({ _id: req.user.id }, { avatar: result.secure_url });

  return res.json({ avatar: result.secure_url });
};

// GET /api/users/:id  — public profile
const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select(
    'name avatar profession level xp streak hasAuthorProfile authorStats createdAt'
  );
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json(user);
};

// GET /api/leaderboard
const getLeaderboard = async (req, res) => {
  const users = await User.find()
    .select('name avatar level xp streak profession')
    .sort({ xp: -1 })
    .limit(50)
    .lean();
  return res.json(users);
};

// GET /api/users/me/courses
const getMyCourses = async (req, res) => {
  const userId = req.user.id;

  const [enrollments, authored] = await Promise.all([
    Enrollment.find({ userId, status: 'active' })
      .populate({
        path: 'courseId',
        populate: { path: 'authorId', select: 'name avatar' },
      })
      .sort({ enrolledAt: -1 }),
    Course.find({ authorId: userId }).sort({ createdAt: -1 }),
  ]);

  return res.json({
    enrolled: enrollments.map((e) => e.courseId).filter(Boolean),
    authored,
  });
};

// POST /api/users/me/become-author
const becomeAuthor = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.hasAuthorProfile) return res.json(await User.findById(req.user.id).select('-password'));

  user.hasAuthorProfile = true;
  user.authorStats.joinedAt = new Date();
  await user.save();

  return res.json(await User.findById(req.user.id).select('-password'));
};

module.exports = { getMe, updateMe, uploadAvatar, getUserById, getLeaderboard, getMyCourses, becomeAuthor };
