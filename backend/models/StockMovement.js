const mongoose = require('mongoose');

/**
 * Append-only. Nothing ever updates or deletes a StockMovement.
 * Stock history / "why is stock what it is" must be reconstructable
 * entirely from this collection.
 */
const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }, // null for non-batch-tracked products
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },

    type: {
      type: String,
      enum: [
        'OPENING',
        'PURCHASE',
        'SALE',
        'PURCHASE_RETURN',
        'SALE_RETURN',
        'ADJUSTMENT_IN',
        'ADJUSTMENT_OUT',
        'TRANSFER_IN',
        'TRANSFER_OUT',
      ],
      required: true,
    },

    // signed quantity in BASE unit: +ve = stock in, -ve = stock out
    baseQuantity: { type: Number, required: true },

    // what the user actually typed, for display/audit ("5 Cartons")
    enteredQuantity: { type: Number, required: true },
    enteredUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    conversionFactor: { type: Number, required: true },

    unitCostPaisa: { type: Number }, // cost per baseUnit at time of movement (for COGS/valuation)

    referenceType: { type: String }, // 'Sale' | 'Purchase' | 'StockAdjustment' | etc
    referenceId: { type: mongoose.Schema.Types.ObjectId },

    reason: { type: String }, // for adjustments: Damaged/Expired/Lost/...
    notes: { type: String },

    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

stockMovementSchema.index({ product: 1, warehouse: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
