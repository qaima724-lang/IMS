const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Batch = require('../models/Batch');
const { Customer, Supplier, CashAccount } = require('../models/Misc');
const asyncHandler = require('../utils/asyncHandler');

function dayRange(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(start.getTime() + 86400000);
  return { start, end };
}

exports.summary = asyncHandler(async (req, res) => {
  const { start, end } = dayRange(req.query.date);

  const [salesAgg, purchasesAgg, receivables, payables, cashAccounts, stockValueAgg] = await Promise.all([
    Sale.aggregate([
      { $match: { saleDate: { $gte: start, $lt: end }, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotalPaisa' },
          totalProfit: { $sum: '$grossProfitPaisa' },
          count: { $sum: 1 },
        },
      },
    ]),
    Purchase.aggregate([
      { $match: { purchaseDate: { $gte: start, $lt: end }, status: 'completed' } },
      { $group: { _id: null, totalPurchases: { $sum: '$grandTotalPaisa' }, count: { $sum: 1 } } },
    ]),
    Customer.aggregate([
      { $match: { currentBalancePaisa: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$currentBalancePaisa' } } },
    ]),
    Supplier.aggregate([
      { $match: { currentBalancePaisa: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$currentBalancePaisa' } } },
    ]),
    CashAccount.find({ active: true }),
    Batch.aggregate([
      { $match: { remainingQty: { $gt: 0 } } },
      { $group: { _id: null, value: { $sum: { $multiply: ['$remainingQty', '$costPricePaisa'] } } } },
    ]),
  ]);

  res.json({
    todaySalesPaisa: salesAgg[0]?.totalSales || 0,
    todaySalesCount: salesAgg[0]?.count || 0,
    todayProfitPaisa: salesAgg[0]?.totalProfit || 0,
    todayPurchasesPaisa: purchasesAgg[0]?.totalPurchases || 0,
    receivablesPaisa: receivables[0]?.total || 0,
    payablesPaisa: payables[0]?.total || 0,
    stockValuePaisa: stockValueAgg[0]?.value || 0,
    cashAccounts: cashAccounts.map((a) => ({ id: a._id, name: a.name, type: a.type, balancePaisa: a.currentBalancePaisa })),
  });
});

exports.recentSales = asyncHandler(async (req, res) => {
  const items = await Sale.find({ status: 'completed' }).sort({ createdAt: -1 }).limit(10).populate('customer');
  res.json({ items });
});
