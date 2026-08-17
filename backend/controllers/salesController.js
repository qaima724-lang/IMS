const Sale = require('../models/Sale');
const salesService = require('../services/salesService');
const asyncHandler = require('../utils/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
  const sale = await salesService.completeSale({ ...req.body, user: req.user._id });
  res.status(201).json({ sale });
});

exports.list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 25, customer, from, to } = req.query;
  const filter = {};
  if (customer) filter.customer = customer;
  if (from || to) {
    filter.saleDate = {};
    if (from) filter.saleDate.$gte = new Date(from);
    if (to) filter.saleDate.$lte = new Date(to);
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Sale.find(filter).populate('customer warehouse').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Sale.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), limit: Number(limit) });
});

exports.get = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id).populate('customer warehouse items.product items.unit');
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  res.json({ sale });
});
