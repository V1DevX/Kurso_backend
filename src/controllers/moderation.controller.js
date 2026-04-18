const { Course, Lesson } = require('../models');
const { moderateContent, runAutoModeration } = require('../services/ai.service');
const { checkAchievements } = require('../services/gamification.service');

// GET /api/moderation/pending
const getPending = async (req, res) => {
  const courses = await Course.find({ status: 'pending' })
    .populate('authorId', 'name email authorStats')
    .sort({ createdAt: 1 });
  return res.json(courses);
};

// PUT /api/moderation/:courseId/approve
const approveCourse = async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (course.status === 'approved')
    return res.status(400).json({ message: 'Course already approved' });

  course.status = 'approved';
  await course.save();

  // Triggers 'first_course_published' achievement check for the author
  await checkAchievements(course.authorId.toString());

  return res.json({ message: 'Course approved', course });
};

// PUT /api/moderation/:courseId/reject
const rejectCourse = async (req, res) => {
  const { rejectionReason } = req.body;
  if (!rejectionReason?.trim()) {
    return res.status(400).json({ message: 'rejectionReason is required' });
  }

  const course = await Course.findById(req.params.courseId);
  if (!course) return res.status(404).json({ message: 'Course not found' });

  course.status = 'rejected';
  course.rejectionReason = rejectionReason.trim();
  await course.save();

  return res.json({ message: 'Course rejected', course });
};

// POST /api/moderation/:courseId/appeal  (author only)
const appealCourse = async (req, res) => {
  const { courseId } = req.params;
  const { appealNote } = req.body;

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if (course.authorId.toString() !== req.user.id)
    return res.status(403).json({ message: 'Not authorized' });
  if (course.status !== 'rejected')
    return res.status(400).json({ message: 'Only rejected courses can be appealed' });
  if (course.appealCount >= 3)
    return res.status(400).json({ message: 'Maximum appeals (3) reached' });

  course.status = 'pending';
  course.appealCount += 1;
  course.appealNote = appealNote ?? '';
  await course.save();

  return res.json({ message: 'Appeal submitted', appealCount: course.appealCount, course });
};

// POST /api/ai/moderate
const aiModerate = async (req, res) => {
  const { courseId } = req.body;
  if (!courseId) return res.status(400).json({ message: 'courseId is required' });

  const course = await Course.findById(courseId).populate('authorId', 'name email');
  if (!course) return res.status(404).json({ message: 'Course not found' });

  const lessons = await Lesson.find({ courseId });

  const report = await moderateContent({
    title: course.title,
    description: course.description,
    lessons,
  });

  let autoApproved = false;
  if (report.recommendation === 'approve' && course.complaints.length === 0) {
    course.status = 'approved';
    await course.save();
    await checkAchievements(course.authorId._id.toString());
    autoApproved = true;
  }

  return res.json({
    courseId,
    courseStatus: course.status,
    autoApproved,
    report,
  });
};

module.exports = { getPending, approveCourse, rejectCourse, appealCourse, aiModerate };
