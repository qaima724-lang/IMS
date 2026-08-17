const Product = require('../models/Product');
const Batch = require('../models/Batch');
const { Warehouse } = require('../models/Misc');
const withTransaction = require('../utils/withTransaction');
const inventoryService = require('../services/inventoryService');
const asyncHandler = require('../utils/asyncHandler');

exports.openingStock = asyncHandler(async (req, res) => {
  const { product, warehouse, batchNumber, quantity, unitId, manufacturingDate, expiryDate, costPricePaisa } = req.body;
  const batch = await withTransaction(async (session) => {
    const prod = await Product.findById(product).session(session);
    if (!prod) throw Object.assign(new Error('Product not found'), { status: 400 });
    const factor = prod.factorFor(unitId);
    return inventoryService.addStock({
      product,
      warehouse,
      batchNumber: batchNumber || `OPEN-${Date.now()}`,
      manufacturingDate,
      expiryDate,
      enteredQuantity: quantity,
      enteredUnit: unitId,
      conversionFactor: factor,
      costPricePaisa,
      sourceType: 'OPENING',
      user: req.user._id,
      session,
    });
  });
  res.status(201).json({ batch });
});

exports.adjust = asyncHandler(async (req, res) => {
  const { product, warehouse, direction, quantity, unitId, reason, notes, unitCostPaisa } = req.body;
  if (!['damaged', 'broken', 'expired', 'lost', 'theft', 'counting_error', 'warehouse_correction', 'opening_correction', 'other'].includes(reason)) {
    return res.status(400).json({ error: 'Invalid adjustment reason' });
  }
  await withTransaction(async (session) => {
    const prod = await Product.findById(product).session(session);
    if (!prod) throw Object.assign(new Error('Product not found'), { status: 400 });
    const factor = prod.factorFor(unitId);
    const baseQuantity = quantity * factor;
    await inventoryService.adjustStock({
      product,
      warehouse,
      direction,
      baseQuantity,
      reason,
      notes,
      unitCostPaisa,
      enteredUnit: unitId,
      conversionFactor: factor,
      user: req.user._id,
      session,
    });
  });
  res.status(201).json({ ok: true });
});

exports.transfer = asyncHandler(async (req, res) => {
  const { product, fromWarehouse, toWarehouse, quantity, unitId } = req.body;
  if (fromWarehouse === toWarehouse) {
    return res.status(400).json({ error: 'Source and destination warehouse must differ' });
  }
  await withTransaction(async (session) => {
    const prod = await Product.findById(product).session(session);
    if (!prod) throw Object.assign(new Error('Product not found'), { status: 400 });
    const factor = prod.factorFor(unitId);
    const baseQuantity = quantity * factor;
    await inventoryService.transferStock({
      product,
      fromWarehouse,
      toWarehouse,
      baseQuantity,
      enteredUnit: unitId,
      conversionFactor: factor,
      user: req.user._id,
      session,
    });
  });
  res.status(201).json({ ok: true });
});

exports.expiryReport = asyncHandler(async (req, res) => {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400000);
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const in60 = new Date(now.getTime() + 60 * 86400000);

  const batches = await Batch.find({ remainingQty: { $gt: 0 }, expiryDate: { $ne: null } })
    .populate('product warehouse supplier')
    .sort({ expiryDate: 1 });

  const withStatus = batches.map((b) => {
    let status = 'safe';
    if (b.expiryDate < now) status = 'expired';
    else if (b.expiryDate.toDateString() === now.toDateString()) status = 'expiring_today';
    else if (b.expiryDate <= in7) status = 'expiring_7_days';
    else if (b.expiryDate <= in30) status = 'expiring_30_days';
    else if (b.expiryDate <= in60) status = 'expiring_60_days';
    return { ...b.toObject(), expiryStatus: status };
  });

  res.json({ items: withStatus });
});

exports.lowStock = asyncHandler(async (req, res) => {
  const products = await Product.find({ active: true, reorderLevel: { $gt: 0 } }).populate('baseUnit');
  const warehouses = await Warehouse.find({ active: true });

  const results = [];
  for (const p of products) {
    let total = 0;
    for (const w of warehouses) {
      total += await inventoryService.currentStock(p._id, w._id);
    }
    if (total <= p.reorderLevel) {
      results.push({ product: p, currentStock: total, reorderLevel: p.reorderLevel });
    }
  }
  res.json({ items: results });
});
