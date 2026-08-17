const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  { name: { type: String, required: true, unique: true, trim: true } },
  { timestamps: true }
);

const brandSchema = new mongoose.Schema(
  { name: { type: String, required: true, unique: true, trim: true } },
  { timestamps: true }
);

const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // "Main Shop", "Main Godown"
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const partySchema = {
  name: { type: String, required: true, trim: true },
  businessName: { type: String, trim: true },
  phone: { type: String, trim: true },
  whatsapp: { type: String, trim: true },
  email: { type: String, trim: true },
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  ntn: { type: String, trim: true },
  strn: { type: String, trim: true },
  openingBalancePaisa: { type: Number, default: 0 }, // +ve = they owe us / we owe them, sign convention documented per model
  creditLimitPaisa: { type: Number, default: 0 },
  paymentTermsDays: { type: Number, default: 0 },
  notes: { type: String, trim: true },
  active: { type: Boolean, default: true },
};

const customerSchema = new mongoose.Schema(
  {
    ...partySchema,
    customerType: {
      type: String,
      enum: ['retail', 'wholesale', 'distributor', 'corporate', 'special'],
      default: 'retail',
    },
    // which price level applies by default at POS for this customer
    defaultPriceLevel: {
      type: String,
      enum: ['retail', 'wholesale', 'special'],
      default: 'retail',
    },
    specialPricePaisaOverrides: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        pricePaisa: Number,
      },
    ],
    // running balance: +ve = customer owes us (receivable)
    currentBalancePaisa: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const supplierSchema = new mongoose.Schema(
  {
    ...partySchema,
    // running balance: +ve = we owe supplier (payable)
    currentBalancePaisa: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const cashAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // "Cash", "HBL", "JazzCash"
    type: { type: String, enum: ['cash', 'bank', 'mobile_wallet'], default: 'cash' },
    openingBalancePaisa: { type: Number, default: 0 },
    currentBalancePaisa: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = {
  Category: mongoose.model('Category', categorySchema),
  Brand: mongoose.model('Brand', brandSchema),
  Warehouse: mongoose.model('Warehouse', warehouseSchema),
  Customer: mongoose.model('Customer', customerSchema),
  Supplier: mongoose.model('Supplier', supplierSchema),
  CashAccount: mongoose.model('CashAccount', cashAccountSchema),
};
