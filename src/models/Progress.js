const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  videoWatched: { type: Boolean, default: false },
  testScore: { type: Number, default: null },
  status: { type: String, enum: ['gray', 'yellow', 'green'], default: 'gray' },
  xpEarned: { type: Number, default: 0 },
  completedAt: { type: Date },
});

progressSchema.index({ userId: 1, courseId: 1 });
progressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);
