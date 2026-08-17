const mongoose = require('mongoose');

/**
 * One Batch = one lot of stock that entered on a specific date, at a
 * specific cost, from a specific supplier, with its own expiry.
 * FIFO consumption always drains the oldest (earliest createdAt / purchaseDate)
 * batch with remainingQty > 0 for a product+warehouse first.
 *
 * remainingQty is the ONLY field InventoryService mutates on this doc,
 * and only via atomic findOneAndUpdate with a `remainingQty >= consumeQty`
 * guard — see InventoryService.consumeFIFO.
 */
const batchSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    batchNumber: { type: String, required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },

    purchaseDate: { type: Date, required: true, default: Date.now },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date, index: true },

    // all quantities in the product's BASE unit
    quantityReceived: { type: Number, required: true },
    remainingQty: { type: Number, required: true },

    costPricePaisa: { type: Number, required: true }, // per baseUnit, this batch's actual cost (for FIFO COGS)

    status: { type: String, enum: ['active', 'depleted', 'recalled'], default: 'active' },

    // reference back to the purchase (or 'OPENING' for opening stock) that created it
    sourceType: { type: String, enum: ['PURCHASE', 'OPENING'], required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true }
);

batchSchema.index({ product: 1, warehouse: 1, remainingQty: 1, purchaseDate: 1 });

module.exports = mongoose.model('Batch', batchSchema);
