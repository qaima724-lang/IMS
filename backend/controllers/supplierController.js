const { Supplier } = require('../models/Misc');
const { LedgerEntry } = require('../models/Ledger');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const { q, active } = req.query;
  const filter = {};
  if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }, { businessName: new RegExp(q, 'i') }];
  if (active !== undefined) filter.active = active === 'true';
  const items = await Supplier.find(filter).sort({ name: 1 });
  res.json({ items });
});

exports.create = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  body.currentBalancePaisa = body.openingBalancePaisa || 0;
  const supplier = await Supplier.create(body);
  res.status(201).json({ supplier });
});

exports.update = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
  res.json({ supplier });
});

exports.ledger = asyncHandler(async (req, res) => {
  const entries = await LedgerEntry.find({ party: req.params.id, partyModel: 'Supplier' }).sort({ date: 1, createdAt: 1 });
  res.json({ entries });
});

exports.outstanding = asyncHandler(async (req, res) => {
  const items = await Supplier.find({ currentBalancePaisa: { $gt: 0 } }).sort({ currentBalancePaisa: -1 });
  res.json({ items });
});
