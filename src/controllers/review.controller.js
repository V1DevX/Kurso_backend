const { Review, Course, Enrollment } = require('../models');
const { awardXP, checkAchievements } = require('../services/gamification.service');

// GET /api/courses/:id/reviews
const getReviews = async (req, res) => {
  const reviews = await Review.find({ courseId: req.params.id })
    .populate('userId', 'name avatar')
    .sort({ createdAt: -1 });
  return res.json(reviews);
};

// POST /api/courses/:id/reviews
const createReview = async (req, res) => {
  const courseId = req.params.id;
  const userId = req.user.id;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'rating must be between 1 and 5' });
  }

  const course = await Course.findById(courseId);
  if (!course) return res.status(404).json({ message: 'Course not found' });

  if (course.authorId.toString() === userId) {
    return res.status(400).json({ message: 'Cannot review your own course' });
  }

  const enrolled = await Enrollment.exists({ userId, courseId, status: 'active' });
  if (!enrolled) return res.status(403).json({ message: 'Must be enrolled to leave a review' });

  const existing = await Review.findOne({ userId, courseId });
  if (existing) return res.status(409).json({ message: 'Already reviewed this course' });

  const review = await Review.create({ courseId, userId, rating, comment });

  // Recalculate course rating incrementally
  const newTotal = course.totalReviews + 1;
  const newRating = parseFloat(
    ((course.rating * course.totalReviews + rating) / newTotal).toFixed(2)
  );
  await Course.updateOne({ _id: courseId }, { rating: newRating, totalReviews: newTotal });

  // Award XP: 10 per star
  const xpGained = await awardXP(userId, rating * 10);
  await checkAchievements(userId);

  return res.status(201).json({ review, xpGained });
};

// DELETE /api/reviews/:id  — own review only
const deleteReview = async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: 'Review not found' });
  if (review.userId.toString() !== req.user.id)
    return res.status(403).json({ message: 'Not authorized' });

  const course = await Course.findById(review.courseId);
  if (course && course.totalReviews > 1) {
    const newTotal = course.totalReviews - 1;
    const newRating = parseFloat(
      ((course.rating * course.totalReviews - review.rating) / newTotal).toFixed(2)
    );
    await Course.updateOne({ _id: review.courseId }, { rating: newRating, totalReviews: newTotal });
  } else if (course) {
    await Course.updateOne({ _id: review.courseId }, { rating: 0, totalReviews: 0 });
  }

  await review.deleteOne();
  return res.json({ message: 'Review deleted' });
};

module.exports = { getReviews, createReview, deleteReview };
