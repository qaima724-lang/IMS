const Purchase = require('../models/Purchase');
const purchaseService = require('../services/purchaseService');
const asyncHandler = require('../utils/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.completePurchase({ ...req.body, user: req.user._id });
  res.status(201).json({ purchase });
});

exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, supplier } = req.query;
  const filter = {};
  if (supplier) filter.supplier = supplier;
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Purchase.find(filter).populate('supplier warehouse').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Purchase.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), limit: Number(limit) });
});

exports.get = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id).populate('supplier warehouse items.product items.unit');
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
  res.json({ purchase });
});
