const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access token required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  // Ban check only on mutating requests — GET is always allowed
  if (req.method !== 'GET') {
    const user = await User.findById(req.user.id).select('banned bannedUntil');
    if (!user) return res.status(401).json({ message: 'User not found' });

    if (user.banned) {
      const expired = user.bannedUntil && user.bannedUntil < new Date();
      if (expired) {
        await User.updateOne({ _id: req.user.id }, { banned: false, bannedUntil: null });
      } else {
        return res.status(403).json({
          message: 'Your account is banned',
          bannedUntil: user.bannedUntil || null,
        });
      }
    }
  }

  next();
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

module.exports = { authenticateToken, requireRole };
