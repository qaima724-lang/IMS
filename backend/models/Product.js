const mongoose = require('mongoose');

/**
 * Per-product unit conversion, relative to the product's baseUnit.
 * Stock is ALWAYS tracked internally in baseUnit. Every transaction
 * quantity gets converted to baseUnit via `factor` before touching stock.
 *
 * Example: baseUnit = Piece
 *   { unit: Carton, factor: 24 }   -> 1 Carton = 24 Piece
 *   { unit: Dozen,  factor: 12 }   -> 1 Dozen  = 12 Piece
 */
const unitConversionSchema = new mongoose.Schema(
  {
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    factor: { type: Number, required: true, min: 0.0001 }, // in terms of baseUnit
  },
  { _id: false }
);

// All prices stored in paisa (integer). See utils/money.js.
const priceLevelSchema = new mongoose.Schema(
  {
    costPricePaisa: { type: Number, required: true, default: 0 },
    wholesalePricePaisa: { type: Number, required: true, default: 0 },
    retailPricePaisa: { type: Number, required: true, default: 0 },
    minSalePricePaisa: { type: Number, default: null }, // floor, optional
    // prices above are "per baseUnit". Optional explicit overrides per unit
    // (e.g. carton price isn't always exactly 24x piece price):
    unitOverrides: [
      {
        unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
        wholesalePricePaisa: Number,
        retailPricePaisa: Number,
      },
    ],
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    barcode: { type: String, trim: true, index: true },

    baseUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    purchaseUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
    saleUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit' },
    unitConversions: [unitConversionSchema],

    pricing: { type: priceLevelSchema, default: () => ({}) },

    reorderLevel: { type: Number, default: 0 }, // in baseUnit
    maxStockLevel: { type: Number, default: null },

    isBatchTracked: { type: Boolean, default: true }, // FMCG default: yes
    taxRatePercent: { type: Number, default: 0 }, // configurable, never hard-coded

    active: { type: Boolean, default: true },
    imageUrl: { type: String },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text' });

/**
 * Resolve a conversion factor to baseUnit for a given unit.
 * Returns 1 if unit === baseUnit, throws if the product has no
 * conversion defined for that unit (fail loudly, never silently assume).
 */
productSchema.methods.factorFor = function (unitId) {
  if (String(unitId) === String(this.baseUnit)) return 1;
  const conv = this.unitConversions.find((c) => String(c.unit) === String(unitId));
  if (!conv) {
    const err = new Error(
      `Product "${this.name}" has no unit conversion defined for the requested unit.`
    );
    err.status = 400;
    throw err;
  }
  return conv.factor;
};

module.exports = mongoose.model('Product', productSchema);
