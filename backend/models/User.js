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

// Hooks
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 12);
});

// Instance methods
userSchema.methods.comparePassword = async function (plain) {
  return await bcrypt.compare(plain, this.password);
};

// Static methods
userSchema.statics.hashPassword = async function (plain) {
  return await bcrypt.hash(plain, 12);
};

module.exports = mongoose.model('User', userSchema);
