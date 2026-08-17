const { Category, Brand, Warehouse, CashAccount } = require('../models/Misc');
const Unit = require('../models/Unit');
const asyncHandler = require('../utils/asyncHandler');

function crudFor(Model, key) {
  return {
    list: asyncHandler(async (req, res) => {
      const items = await Model.find().sort({ name: 1 });
      res.json({ items });
    }),
    create: asyncHandler(async (req, res) => {
      const item = await Model.create(req.body);
      res.status(201).json({ [key]: item });
    }),
    update: asyncHandler(async (req, res) => {
      const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json({ [key]: item });
    }),
  };
}

module.exports = {
  categories: crudFor(Category, 'category'),
  brands: crudFor(Brand, 'brand'),
  units: crudFor(Unit, 'unit'),
  warehouses: crudFor(Warehouse, 'warehouse'),
  cashAccounts: crudFor(CashAccount, 'account'),
};
