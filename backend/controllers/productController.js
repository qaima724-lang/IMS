const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const inventoryService = require('../services/inventoryService');
const { Warehouse } = require('../models/Misc');

exports.list = asyncHandler(async (req, res) => {
  const { q, category, brand, active, page = 1, limit = 25 } = req.query;
  const filter = {};
  if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { sku: new RegExp(q, 'i') }, { barcode: new RegExp(q, 'i') }];
  if (category) filter.category = category;
  if (brand) filter.brand = brand;
  if (active !== undefined) filter.active = active === 'true';

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category brand baseUnit purchaseUnit saleUnit unitConversions.unit pricing.unitOverrides.unit')
      .sort({ name: 1 })
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  // attach live stock for the default warehouse so the list is useful at a glance
  const defaultWh = await Warehouse.findOne({ isDefault: true });
  const withStock = await Promise.all(
    items.map(async (p) => {
      const stock = defaultWh ? await inventoryService.currentStock(p._id, defaultWh._id) : null;
      return { ...p.toObject(), currentStock: stock };
    })
  );

  res.json({ items: withStock, total, page: Number(page), limit: Number(limit) });
});

exports.get = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate(
    'category brand baseUnit purchaseUnit saleUnit unitConversions.unit'
  );
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

exports.create = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ product });
});

exports.update = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});

// Soft delete only — spec forbids deleting anything with transaction history.
// Phase 1 keeps it simple: deactivate, never hard-delete from this endpoint.
exports.deactivate = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ product });
});
