const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true, trim: true },
  difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  price: { type: Number, default: 0 },
  language: [{ type: String }],
  autoTranslate: { type: Boolean, default: false },

  visibility: { type: String, enum: ['public', 'link', 'approval'], default: 'public' },
  enrolledStudents: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      enrolledAt: { type: Date, default: Date.now },
    },
  ],
  kickedStudents: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      kickedAt: { type: Date, default: Date.now },
    },
  ],
  pendingRequests: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      requestedAt: { type: Date, default: Date.now },
    },
  ],

  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String },
  appealCount: { type: Number, default: 0 },
  appealNote: { type: String },
  complaints: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reason: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  ],

  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

courseSchema.index({ authorId: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ difficulty: 1 });
courseSchema.index({ rating: -1 });
courseSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Course', courseSchema);
