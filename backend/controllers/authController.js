const jwt = require('jsonwebtoken');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

function sign(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

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

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  // validate
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  // check if user exists
  const userExists = await User.findOne({ email: (email || '').toLowerCase() });
  if (userExists) {
    return res.status(400).json({ error: 'User already exists' });
  }
  // create user
  const user = await User.create({ name, email, password });
  // generate token
  const token = sign(user);
  // response
  res.json({
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});
