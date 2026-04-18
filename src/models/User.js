const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  avatar: { type: String },
  profession: { type: String, trim: true },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },

  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1, min: 1, max: 99 },
  streak: { type: Number, default: 0 },
  lastActiveDate: { type: Date },

  achievements: [
    {
      id: { type: String },
      unlockedAt: { type: Date, default: Date.now },
    },
  ],

  hasAuthorProfile: { type: Boolean, default: false },
  authorStats: {
    level: {
      type: String,
      enum: ['novice', 'student', 'mentor', 'expert', 'master'],
      default: 'novice',
    },
    rating: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
    totalCourses: { type: Number, default: 0 },
    joinedAt: { type: Date },
    violations: { type: Number, default: 0 },
  },

  banned: { type: Boolean, default: false },
  bannedUntil: { type: Date, default: null },
  banReason: { type: String },

  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// email index is already created by unique:true on the field definition
userSchema.index({ xp: -1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
