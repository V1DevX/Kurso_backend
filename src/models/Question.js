const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
  question: { type: String, required: true },
  options: [{ type: String }],
  correctAnswer: { type: Number, required: true },
  order: { type: Number, required: true },
});

questionSchema.index({ lessonId: 1, order: 1 });

module.exports = mongoose.model('Question', questionSchema);
