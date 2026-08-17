const mongoose = require('mongoose');

/**
 * One row per financial event against a customer or supplier.
 * Append-only — corrections are made with a new reversing entry, never
 * an edit or delete, per the spec's "financial records never silently deleted" rule.
 */
const ledgerEntrySchema = new mongoose.Schema(
  {
    partyType: { type: String, enum: ['customer', 'supplier'], required: true },
    party: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'partyModel' },
    partyModel: { type: String, enum: ['Customer', 'Supplier'], required: true },

    date: { type: Date, required: true, default: Date.now },
    type: {
      type: String,
      enum: ['SALE', 'SALE_RETURN', 'PAYMENT_RECEIVED', 'PURCHASE', 'PURCHASE_RETURN', 'PAYMENT_MADE', 'OPENING', 'ADJUSTMENT'],
      required: true,
    },

    debitPaisa: { type: Number, default: 0 }, // customer: increases receivable | supplier: decreases payable
    creditPaisa: { type: Number, default: 0 }, // customer: decreases receivable | supplier: increases payable
    balanceAfterPaisa: { type: Number, required: true },

    referenceType: { type: String },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    notes: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ party: 1, date: -1 });

const cashTransactionSchema = new mongoose.Schema(
  {
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'CashAccount', required: true, index: true },
    date: { type: Date, required: true, default: Date.now },
    type: {
      type: String,
      enum: ['SALE_RECEIPT', 'CUSTOMER_PAYMENT', 'PURCHASE_PAYMENT', 'SUPPLIER_PAYMENT', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPENING'],
      required: true,
    },
    amountPaisa: { type: Number, required: true }, // +ve = in, -ve = out
    balanceAfterPaisa: { type: Number, required: true },
    referenceType: { type: String },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    notes: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = {
  LedgerEntry: mongoose.model('LedgerEntry', ledgerEntrySchema),
  CashTransaction: mongoose.model('CashTransaction', cashTransactionSchema),
};
