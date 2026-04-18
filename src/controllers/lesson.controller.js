const { Lesson, Course, Enrollment, Question } = require('../models');
const { XP_REWARDS } = require('../services/gamification.service');

// Returns { error, message } on failure, { course } on success
const assertAuthor = async (courseId, userId) => {
  const course = await Course.findById(courseId).select('authorId');
  if (!course) return { error: 404, message: 'Course not found' };
  if (course.authorId.toString() !== userId) return { error: 403, message: 'Not authorized' };
  return { course };
};

// GET /api/courses/:courseId/lessons  — public
const getLessons = async (req, res) => {
  const { courseId } = req.params;
  const lessons = await Lesson.find({ courseId }).sort({ order: 1 });
  return res.json(lessons);
};

// POST /api/courses/:courseId/lessons
const createLesson = async (req, res) => {
  const { courseId } = req.params;
  const { title, order, content, videoUrl, difficulty, xpReward, passingThreshold } = req.body;

  const { error, message } = await assertAuthor(courseId, req.user.id);
  if (error) return res.status(error).json({ message });

  const defaultXP = XP_REWARDS[difficulty] || XP_REWARDS.beginner;

  const lesson = await Lesson.create({
    courseId,
    title,
    order,
    content,
    videoUrl,
    difficulty,
    xpReward: xpReward || defaultXP,
    passingThreshold: passingThreshold ?? 0,
  });

  return res.status(201).json(lesson);
};

// PUT /api/lessons/:id
const updateLesson = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

  const { error, message } = await assertAuthor(lesson.courseId, req.user.id);
  if (error) return res.status(error).json({ message });

  const allowed = ['title', 'order', 'content', 'videoUrl', 'difficulty', 'xpReward', 'passingThreshold'];
  for (const field of allowed) {
    if (req.body[field] !== undefined) lesson[field] = req.body[field];
  }

  await lesson.save();
  return res.json(lesson);
};

// DELETE /api/lessons/:id
const deleteLesson = async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

  const { error, message } = await assertAuthor(lesson.courseId, req.user.id);
  if (error) return res.status(error).json({ message });

  await lesson.deleteOne();
  await Question.deleteMany({ lessonId: req.params.id });

  return res.json({ message: 'Lesson deleted' });
};

// POST /api/lessons/:lessonId/questions
const createQuestions = async (req, res) => {
  const { lessonId } = req.params;
  const questions = req.body;

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: 'questions must be a non-empty array' });
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

  const { error, message } = await assertAuthor(lesson.courseId, req.user.id);
  if (error) return res.status(error).json({ message });

  const docs = questions.map((q, i) => ({
    lessonId,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    order: q.order ?? i,
  }));

  const created = await Question.insertMany(docs);
  return res.status(201).json(created);
};

// PUT /api/lessons/:lessonId/questions  — replaces all questions
const replaceQuestions = async (req, res) => {
  const { lessonId } = req.params;
  const questions = req.body;

  if (!Array.isArray(questions)) {
    return res.status(400).json({ message: 'questions must be an array' });
  }

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

  const { error, message } = await assertAuthor(lesson.courseId, req.user.id);
  if (error) return res.status(error).json({ message });

  await Question.deleteMany({ lessonId });
  if (questions.length === 0) return res.json([]);

  const docs = questions.map((q, i) => ({
    lessonId,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    order: q.order ?? i,
  }));

  const created = await Question.insertMany(docs);
  return res.json(created);
};

// GET /api/lessons/:lessonId/questions
const getQuestions = async (req, res) => {
  const questions = await Question.find({ lessonId: req.params.lessonId }).sort({ order: 1 });
  return res.json(questions);
};

module.exports = {
  getLessons, createLesson, updateLesson, deleteLesson,
  createQuestions, replaceQuestions, getQuestions,
};
