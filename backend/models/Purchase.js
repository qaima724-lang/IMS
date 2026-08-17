const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    batchNumber: { type: String, required: true },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date },

    quantity: { type: Number, required: true }, // in enteredUnit
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    conversionFactor: { type: Number, required: true },
    baseQuantity: { type: Number, required: true }, // quantity * conversionFactor

    ratePaisa: { type: Number, required: true }, // per enteredUnit
    discountPaisa: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    netAmountPaisa: { type: Number, required: true },

    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }, // filled in after batch is created
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    purchaseDate: { type: Date, required: true, default: Date.now },

    items: [purchaseItemSchema],

    subtotalPaisa: { type: Number, required: true },
    totalDiscountPaisa: { type: Number, default: 0 },
    totalTaxPaisa: { type: Number, default: 0 },
    grandTotalPaisa: { type: Number, required: true },

    paidAmountPaisa: { type: Number, default: 0 },
    paymentAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'CashAccount' }, // if paid immediately

    status: { type: String, enum: ['completed', 'cancelled'], default: 'completed' },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Purchase', purchaseSchema);
