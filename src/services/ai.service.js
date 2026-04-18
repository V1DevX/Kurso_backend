const { Course, Lesson } = require('../models');
const { checkAchievements } = require('./gamification.service');

const SUSPICIOUS_KEYWORDS = [
  'spam', 'scam', 'hack', 'crack', 'xxx',
  'free money', 'click here', 'adult content',
];

// ─────────────────────────────────────────────────────────────────────────────
// MOCK IMPLEMENTATION
// To replace with Claude API: swap this function body with an Anthropic SDK
// call. Keep the same signature and return shape:
//   { score: Number (0–10), issues: String[], recommendation: 'approve'|'review'|'reject' }
// ─────────────────────────────────────────────────────────────────────────────
const moderateContent = async ({ title, description, lessons }) => {
  const issues = [];
  let score = 10;

  if (!title || title.trim().length < 10) {
    issues.push('too_short');
    score -= 2;
  }

  if (!description || description.trim().length < 50) {
    if (!issues.includes('too_short')) issues.push('too_short');
    score -= 2;
  }

  const fullText = `${title ?? ''} ${description ?? ''}`.toLowerCase();
  if (SUSPICIOUS_KEYWORDS.some((kw) => fullText.includes(kw))) {
    issues.push('suspicious_keywords');
    score -= 4;
  }

  if (!lessons || lessons.length === 0) {
    issues.push('no_lessons');
    score -= 3;
  }

  score = Math.max(0, Math.min(10, score));

  let recommendation;
  if (score < 4) recommendation = 'reject';
  else if (score < 7) recommendation = 'review';
  else recommendation = 'approve';

  return { score, issues, recommendation };
};

// Runs AI check on a course; auto-approves if score >= 7 and no complaints.
// Called on course creation and from POST /api/ai/moderate.
const runAutoModeration = async (courseId) => {
  const course = await Course.findById(courseId);
  if (!course) throw new Error('Course not found');

  const lessons = await Lesson.find({ courseId });

  const report = await moderateContent({
    title: course.title,
    description: course.description,
    lessons,
  });

  if (report.recommendation === 'approve' && course.complaints.length === 0) {
    await Course.updateOne({ _id: courseId }, { status: 'approved' });
    await checkAchievements(course.authorId.toString());
  }

  return report;
};

module.exports = { moderateContent, runAutoModeration };
