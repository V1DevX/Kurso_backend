const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true, trim: true },
  order: { type: Number, required: true },
  content: { type: String },
  videoUrl: { type: String },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  xpReward: {
    video: { type: Number },
    test: { type: Number },
  },
  passingThreshold: { type: Number, default: 0, min: 0, max: 100 },
  createdAt: { type: Date, default: Date.now },
});

lessonSchema.index({ courseId: 1, order: 1 });

module.exports = mongoose.model('Lesson', lessonSchema);
