const { Lesson, Enrollment, Question, Progress, Course } = require('../models');
const { XP_REWARDS, awardXP, checkAchievements } = require('../services/gamification.service');

// POST /api/lessons/:lessonId/watch
const watchLesson = async (req, res) => {
  const { lessonId } = req.params;
  const userId = req.user.id;

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

  const enrolled = await Enrollment.exists({ userId, courseId: lesson.courseId, status: 'active' });
  if (!enrolled) return res.status(403).json({ message: 'Not enrolled in this course' });

  let progress = await Progress.findOne({ userId, lessonId });

  if (progress?.videoWatched) {
    return res.json({ alreadyWatched: true, progress });
  }

  const xpAmount = lesson.xpReward?.video ?? XP_REWARDS[lesson.difficulty].video;

  if (!progress) {
    progress = await Progress.create({
      userId,
      courseId: lesson.courseId,
      lessonId,
      videoWatched: true,
      xpEarned: xpAmount,
    });
  } else {
    progress.videoWatched = true;
    progress.xpEarned += xpAmount;
    await progress.save();
  }

  const gamification = await awardXP(userId, xpAmount);
  const newAchievements = await checkAchievements(userId);

  return res.json({ progress, gamification, newAchievements });
};

// POST /api/lessons/:lessonId/submit
const submitTest = async (req, res) => {
  const { lessonId } = req.params;
  const { answers } = req.body;
  const userId = req.user.id;

  if (!Array.isArray(answers)) {
    return res.status(400).json({ message: 'answers must be an array' });
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

  const enrolled = await Enrollment.exists({ userId, courseId: lesson.courseId, status: 'active' });
  if (!enrolled) return res.status(403).json({ message: 'Not enrolled in this course' });

  const questions = await Question.find({ lessonId }).sort({ order: 1 });
  if (questions.length === 0) {
    return res.status(400).json({ message: 'No questions found for this lesson' });
  }

  const correct = questions.reduce(
    (acc, q, i) => acc + (answers[i] === q.correctAnswer ? 1 : 0),
    0
  );
  const score = Math.round((correct / questions.length) * 100);
  const status = score >= lesson.passingThreshold ? 'green' : 'yellow';

  let progress = await Progress.findOne({ userId, lessonId });
  const isFirstSubmission = !progress || progress.testScore === null;

  const xpAmount = isFirstSubmission
    ? (lesson.xpReward?.test ?? XP_REWARDS[lesson.difficulty].test)
    : 0;

  if (!progress) {
    progress = await Progress.create({
      userId,
      courseId: lesson.courseId,
      lessonId,
      testScore: score,
      status,
      xpEarned: xpAmount,
      completedAt: status === 'green' ? new Date() : undefined,
    });
  } else {
    progress.testScore = score;
    progress.status = status;
    if (isFirstSubmission) progress.xpEarned += xpAmount;
    if (status === 'green' && !progress.completedAt) progress.completedAt = new Date();
    await progress.save();
  }

  let gamification = null;
  let newAchievements = [];
  if (isFirstSubmission && xpAmount > 0) {
    gamification = await awardXP(userId, xpAmount);
    newAchievements = await checkAchievements(userId);
  }

  return res.json({
    score,
    correct,
    total: questions.length,
    status,
    progress,
    gamification,
    newAchievements,
  });
};

// GET /api/courses/:courseId/progress
const getCourseProgress = async (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;

  const course = await Course.findById(courseId).select('authorId');
  if (!course) return res.status(404).json({ message: 'Course not found' });

  const isAuthor = course.authorId.toString() === userId;
  if (!isAuthor) {
    const enrolled = await Enrollment.exists({ userId, courseId, status: 'active' });
    if (!enrolled) return res.status(403).json({ message: 'Not enrolled' });
  }

  const progress = await Progress.find({ userId, courseId }).populate(
    'lessonId',
    'title order difficulty'
  );

  return res.json(progress);
};

module.exports = { watchLesson, submitTest, getCourseProgress };
