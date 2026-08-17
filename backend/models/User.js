const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Phase 1: flat roles. Spec's granular permission matrix is a Phase-10 add-on
    // that can slot in later — role string stays, permissions table gets added.
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'manager', 'cashier', 'inventory_manager', 'accountant'],
      default: 'cashier',
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

module.exports = mongoose.model('User', userSchema);
