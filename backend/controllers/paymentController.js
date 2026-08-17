const withTransaction = require('../utils/withTransaction');
const ledgerService = require('../services/ledgerService');
const asyncHandler = require('../utils/asyncHandler');

// Record money received from a customer against their outstanding balance.
exports.receiveFromCustomer = asyncHandler(async (req, res) => {
  const { customer, amountPaisa, account, notes, date } = req.body;
  if (!amountPaisa || amountPaisa <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const result = await withTransaction(async (session) => {
    const balance = await ledgerService.postCustomerLedger({
      customer,
      type: 'PAYMENT_RECEIVED',
      creditPaisa: amountPaisa,
      date,
      referenceType: 'Payment',
      notes,
      user: req.user._id,
      session,
    });
    if (account) {
      await ledgerService.postCashTransaction({
        account,
        type: 'CUSTOMER_PAYMENT',
        amountPaisa,
        date,
        referenceType: 'Payment',
        notes,
        user: req.user._id,
        session,
      });
    }
    return balance;
  });

  res.status(201).json({ newBalancePaisa: result });
});

// Record money paid to a supplier against payable.
exports.payToSupplier = asyncHandler(async (req, res) => {
  const { supplier, amountPaisa, account, notes, date } = req.body;
  if (!amountPaisa || amountPaisa <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const result = await withTransaction(async (session) => {
    const balance = await ledgerService.postSupplierLedger({
      supplier,
      type: 'PAYMENT_MADE',
      debitPaisa: amountPaisa,
      date,
      referenceType: 'Payment',
      notes,
      user: req.user._id,
      session,
    });
    if (account) {
      await ledgerService.postCashTransaction({
        account,
        type: 'SUPPLIER_PAYMENT',
        amountPaisa: -amountPaisa,
        date,
        referenceType: 'Payment',
        notes,
        user: req.user._id,
        session,
      });
    }
    return balance;
  });

  res.status(201).json({ newBalancePaisa: result });
});
