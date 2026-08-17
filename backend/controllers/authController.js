const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

function sign(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

exports.register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  const existing = await User.findOne({ email: (email || '').toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'Email is already registered' });
  }

  const user = await User.create({
    email: (email || '').toLowerCase(),
    password,
    name,
  });

  const token = sign(user);
  res.status(201).json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user || !user.active || !(await user.comparePassword(password || ''))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = sign(user);
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});


