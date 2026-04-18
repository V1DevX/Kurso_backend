const { Course, User, Enrollment } = require('../models');
const { checkAchievements } = require('../services/gamification.service');
const { runAutoModeration } = require('../services/ai.service');

// GET /api/courses
const getCourses = async (req, res) => {
  const { category, difficulty, language, search, page = 1, limit = 12 } = req.query;

  const filter = { visibility: 'public', status: 'approved' };

  if (category) filter.category = category;
  if (difficulty) filter.difficulty = difficulty;
  if (language) filter.language = { $in: [language] };
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum  = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const skip     = (pageNum - 1) * limitNum;

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate('authorId', 'name avatar authorStats')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Course.countDocuments(filter),
  ]);

  return res.json({
    courses,
    pagination: {
      total,
      page:  pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
    },
  });
};

// GET /api/courses/:id
const getCourse = async (req, res) => {
  const course = await Course.findById(req.params.id).populate(
    'authorId',
    'name avatar profession authorStats'
  );
  if (!course) return res.status(404).json({ message: 'Course not found' });
  return res.json(course);
};

// POST /api/courses
const createCourse = async (req, res) => {
  const userId = req.user.id;
  const { title, description, category, difficulty, price, language, autoTranslate, visibility } =
    req.body;

  const course = await Course.create({
    title,
    description,
    authorId: userId,
    category,
    difficulty,
    price,
    language,
    autoTranslate,
    visibility: visibility || 'public',
    status: 'pending',
  });

  // Bootstrap author profile on first course creation
  const user = await User.findById(userId).select('hasAuthorProfile');
  if (!user.hasAuthorProfile) {
    await User.updateOne({ _id: userId }, {
      hasAuthorProfile: true,
      'authorStats.joinedAt': new Date(),
    });
  }
  await User.updateOne({ _id: userId }, { $inc: { 'authorStats.totalCourses': 1 } });

  // Fire-and-forget: auto-approve if AI score >= 7, otherwise stays pending for human review
  runAutoModeration(course._id).catch((err) =>
    console.error('[AutoMod] course', course._id, err.message)
  );

  return res.status(201).json(course);
};

// PUT /api/courses/:id
const updateCourse = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (course.authorId.toString() !== req.user.id)
    return res.status(403).json({ message: 'Not authorized' });

  const allowed = [
    'title', 'description', 'category', 'difficulty',
    'price', 'language', 'autoTranslate', 'visibility',
  ];
  for (const field of allowed) {
    if (req.body[field] !== undefined) course[field] = req.body[field];
  }

  await course.save();
  return res.json(course);
};

// DELETE /api/courses/:id
const deleteCourse = async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (course.authorId.toString() !== req.user.id)
    return res.status(403).json({ message: 'Not authorized' });

  await course.deleteOne();
  await User.updateOne({ _id: req.user.id }, { $inc: { 'authorStats.totalCourses': -1 } });

  return res.json({ message: 'Course deleted' });
};

// POST /api/courses/:id/enroll
const enroll = async (req, res) => {
  const courseId = req.params.id;
  const userId = req.user.id;

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (course.status !== 'approved')
    return res.status(403).json({ message: 'Course is not available for enrollment' });
  if (course.authorId.toString() === userId)
    return res.status(400).json({ message: 'Author cannot enroll in own course' });

  const existing = await Enrollment.findOne({ userId, courseId });
  if (existing) {
    const messages = {
      active:  'Already enrolled',
      kicked:  'You have been removed from this course',
      pending: 'Enrollment request already pending',
    };
    return res.status(409).json({ message: messages[existing.status] });
  }

  if (course.visibility === 'public' || course.visibility === 'link') {
    await Enrollment.create({ userId, courseId, status: 'active' });
    await Course.updateOne(
      { _id: courseId },
      { $push: { enrolledStudents: { userId, enrolledAt: new Date() } } }
    );
    await User.updateOne({ _id: course.authorId }, { $inc: { 'authorStats.totalStudents': 1 } });
    await checkAchievements(course.authorId.toString());
    return res.status(201).json({ status: 'active' });
  }

  await Enrollment.create({ userId, courseId, status: 'pending' });
  await Course.updateOne(
    { _id: courseId },
    { $push: { pendingRequests: { userId, requestedAt: new Date() } } }
  );
  return res.status(201).json({ status: 'pending' });
};

// GET /api/courses/:id/students
const getStudents = async (req, res) => {
  const course = await Course.findById(req.params.id).populate(
    'enrolledStudents.userId',
    'name email avatar profession'
  );
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (course.authorId.toString() !== req.user.id)
    return res.status(403).json({ message: 'Not authorized' });

  return res.json(course.enrolledStudents);
};

// DELETE /api/courses/:id/students/:userId
const kickStudent = async (req, res) => {
  const { id: courseId, userId } = req.params;

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (course.authorId.toString() !== req.user.id)
    return res.status(403).json({ message: 'Not authorized' });

  const enrollment = await Enrollment.findOne({ userId, courseId, status: 'active' });
  if (!enrollment) return res.status(404).json({ message: 'Student not found in this course' });

  enrollment.status = 'kicked';
  await enrollment.save();

  await Course.updateOne(
    { _id: courseId },
    {
      $pull: { enrolledStudents: { userId } },
      $push: { kickedStudents: { userId, kickedAt: new Date() } },
    }
  );
  await User.updateOne({ _id: course.authorId }, { $inc: { 'authorStats.totalStudents': -1 } });

  return res.json({ message: 'Student removed' });
};

// PUT /api/courses/:id/requests/:userId/approve
const approveRequest = async (req, res) => {
  const { id: courseId, userId } = req.params;

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (course.authorId.toString() !== req.user.id)
    return res.status(403).json({ message: 'Not authorized' });

  const enrollment = await Enrollment.findOne({ userId, courseId, status: 'pending' });
  if (!enrollment) return res.status(404).json({ message: 'Pending request not found' });

  enrollment.status = 'active';
  await enrollment.save();

  await Course.updateOne(
    { _id: courseId },
    {
      $pull: { pendingRequests: { userId } },
      $push: { enrolledStudents: { userId, enrolledAt: new Date() } },
    }
  );
  await User.updateOne({ _id: course.authorId }, { $inc: { 'authorStats.totalStudents': 1 } });
  await checkAchievements(course.authorId.toString());

  return res.json({ message: 'Request approved' });
};

// PUT /api/courses/:id/requests/:userId/reject
const rejectRequest = async (req, res) => {
  const { id: courseId, userId } = req.params;

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (course.authorId.toString() !== req.user.id)
    return res.status(403).json({ message: 'Not authorized' });

  await Enrollment.deleteOne({ userId, courseId, status: 'pending' });
  await Course.updateOne({ _id: courseId }, { $pull: { pendingRequests: { userId } } });

  return res.json({ message: 'Request rejected' });
};

module.exports = {
  getCourses, getCourse, createCourse, updateCourse, deleteCourse,
  enroll, getStudents, kickStudent, approveRequest, rejectRequest,
};
