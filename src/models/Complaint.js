const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'reviewed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

complaintSchema.index({ courseId: 1, status: 1 });
complaintSchema.index({ userId: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
