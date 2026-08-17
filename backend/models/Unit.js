const mongoose = require('mongoose');

// e.g. Piece, Dozen, Carton, Box, Kg, Litre — global list, reused across products
const unitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // "Carton"
    shortCode: { type: String, required: true, trim: true }, // "CTN"
  },
  { timestamps: true }
);

module.exports = mongoose.model('Unit', unitSchema);
