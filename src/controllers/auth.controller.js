const jwt = require('jsonwebtoken');
const { User } = require('../models');

const REFRESH_COOKIE = 'refreshToken';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

const signRefresh = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });

const tokenPayload = (user) => ({
  id: user._id,
  email: user.email,
  role: user.role,
});

// POST /api/auth/register
const register = async (req, res) => {
  const { name, email, password, profession } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ message: 'Password must contain at least one letter and one number' });
  }

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: 'Email already in use' });

  const user = await User.create({
    name,
    email,
    password,
    profession,
    xp: 0,
    level: 1,
    streak: 0,
    hasAuthorProfile: false,
    authorStats: { level: 'novice' },
  });

  const payload = tokenPayload(user);
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);

  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

  return res.status(201).json({
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      level: user.level,
      xp: user.xp,
    },
  });
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const valid = await user.comparePassword(password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

  const payload = tokenPayload(user);
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);

  res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

  return res.json({
    accessToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      level: user.level,
      xp: user.xp,
      avatar: user.avatar,
      profession: user.profession,
    },
  });
};

// POST /api/auth/refresh
const refresh = async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ message: 'No refresh token' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }

  // Confirm user still exists
  const user = await User.findById(payload.id).select('_id email role');
  if (!user) return res.status(401).json({ message: 'User not found' });

  const accessToken = signAccess(tokenPayload(user));

  return res.json({ accessToken });
};

// POST /api/auth/logout
const logout = (req, res) => {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  return res.json({ message: 'Logged out' });
};

module.exports = { register, login, refresh, logout };
