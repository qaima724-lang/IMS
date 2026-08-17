const mongoose = require('mongoose');

// Which batches this line item's quantity was actually drawn from (FIFO result)
// — this is what makes "which batch did this sale come from" answerable.
const batchAllocationSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    baseQuantity: { type: Number, required: true },
    unitCostPaisa: { type: Number, required: true }, // this batch's cost, used for COGS
  },
  { _id: false }
);

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true }, // in enteredUnit
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    conversionFactor: { type: Number, required: true },
    baseQuantity: { type: Number, required: true },

    priceLevel: { type: String, enum: ['retail', 'wholesale', 'special', 'custom'], required: true },
    ratePaisa: { type: Number, required: true }, // per enteredUnit, as charged
    discountPaisa: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    lineTotalPaisa: { type: Number, required: true },

    costOfGoodsPaisa: { type: Number, required: true }, // sum of allocations * their cost — for gross profit
    batchAllocations: [batchAllocationSchema],
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, // null = walk-in cash sale
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    saleDate: { type: Date, required: true, default: Date.now },

    items: [saleItemSchema],

    subtotalPaisa: { type: Number, required: true },
    invoiceDiscountPaisa: { type: Number, default: 0 },
    totalTaxPaisa: { type: Number, default: 0 },
    grandTotalPaisa: { type: Number, required: true },
    totalCostOfGoodsPaisa: { type: Number, required: true },
    grossProfitPaisa: { type: Number, required: true },

    paymentMethod: {
      type: String,
      enum: ['cash', 'bank', 'card', 'easypaisa', 'jazzcash', 'credit', 'split'],
      required: true,
    },
    paidAmountPaisa: { type: Number, required: true, default: 0 },
    outstandingAmountPaisa: { type: Number, required: true, default: 0 }, // goes to customer ledger if > 0
    paymentAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'CashAccount' },

    status: { type: String, enum: ['completed', 'cancelled'], default: 'completed' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sale', saleSchema);
