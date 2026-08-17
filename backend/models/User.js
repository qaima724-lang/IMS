const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
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


const saltRounds = 12;

// 🔐 Hooks
userSchema.pre("save", async function () {
    this.password = await bcrypt.hash(this.password, saltRounds);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, saltRounds);
};

module.exports = mongoose.model('User', userSchema);
