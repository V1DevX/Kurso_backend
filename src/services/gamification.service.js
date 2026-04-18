const { User, Course, Progress } = require('../models');

const XP_REWARDS = {
  beginner:     { video: 10, test: 20 },
  intermediate: { video: 15, test: 35 },
  advanced:     { video: 30, test: 70 },
};

// 200 XP per level, capped at 99
const calculateLevel = (xp) => Math.min(99, Math.floor(xp / 200) + 1);

const awardXP = async (userId, amount) => {
  const user = await User.findById(userId).select('xp level streak lastActiveDate');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
  if (lastActive) lastActive.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let newStreak = user.streak;
  const alreadyActiveToday = lastActive && lastActive.getTime() === today.getTime();

  if (!alreadyActiveToday) {
    if (lastActive && lastActive.getTime() === yesterday.getTime()) {
      newStreak = user.streak + 1;
    } else {
      newStreak = 1;
    }
  }

  const newXP = user.xp + amount;
  const newLevel = calculateLevel(newXP);

  await User.updateOne({ _id: userId }, {
    xp: newXP,
    level: newLevel,
    streak: newStreak,
    lastActiveDate: new Date(),
  });

  return { xp: newXP, level: newLevel, streak: newStreak };
};

const checkAchievements = async (userId) => {
  const user = await User.findById(userId).select('achievements streak hasAuthorProfile authorStats');
  if (!user) return [];

  const existing = new Set(user.achievements.map((a) => a.id));
  const toAdd = [];

  if (!existing.has('first_course_published')) {
    const count = await Course.countDocuments({ authorId: userId, status: 'approved' });
    if (count >= 1) toAdd.push('first_course_published');
  }

  if (!existing.has('perfect_score')) {
    const found = await Progress.exists({ userId, testScore: 100 });
    if (found) toAdd.push('perfect_score');
  }

  if (!existing.has('week_streak') && user.streak >= 7) {
    toAdd.push('week_streak');
  }

  if (
    !existing.has('popular_author') &&
    user.hasAuthorProfile &&
    user.authorStats.totalStudents >= 100
  ) {
    toAdd.push('popular_author');
  }

  if (toAdd.length > 0) {
    const now = new Date();
    await User.updateOne(
      { _id: userId },
      { $push: { achievements: { $each: toAdd.map((id) => ({ id, unlockedAt: now })) } } }
    );
  }

  return toAdd;
};

module.exports = { XP_REWARDS, calculateLevel, awardXP, checkAchievements };
