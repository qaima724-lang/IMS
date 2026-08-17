const { LedgerEntry, CashTransaction } = require('../models/Ledger');
const { Customer, Supplier, CashAccount } = require('../models/Misc');

/**
 * Post a customer ledger entry and update the customer's running balance
 * in the same transaction. debit = increases what they owe us,
 * credit = decreases it.
 */
async function postCustomerLedger({ customer, date, type, debitPaisa = 0, creditPaisa = 0, referenceType, referenceId, notes, user, session }) {
  const cust = await Customer.findById(customer).session(session);
  if (!cust) throw new Error('Customer not found');

  const newBalance = cust.currentBalancePaisa + debitPaisa - creditPaisa;

  await LedgerEntry.create(
    [
      {
        partyType: 'customer',
        party: customer,
        partyModel: 'Customer',
        date: date || new Date(),
        type,
        debitPaisa,
        creditPaisa,
        balanceAfterPaisa: newBalance,
        referenceType,
        referenceId,
        notes,
        user,
      },
    ],
    { session }
  );

  cust.currentBalancePaisa = newBalance;
  await cust.save({ session });
  return newBalance;
}

/**
 * Post a supplier ledger entry. debit = decreases what we owe them,
 * credit = increases it (mirror convention of customer ledger).
 */
async function postSupplierLedger({ supplier, date, type, debitPaisa = 0, creditPaisa = 0, referenceType, referenceId, notes, user, session }) {
  const sup = await Supplier.findById(supplier).session(session);
  if (!sup) throw new Error('Supplier not found');

  const newBalance = sup.currentBalancePaisa - debitPaisa + creditPaisa;

  await LedgerEntry.create(
    [
      {
        partyType: 'supplier',
        party: supplier,
        partyModel: 'Supplier',
        date: date || new Date(),
        type,
        debitPaisa,
        creditPaisa,
        balanceAfterPaisa: newBalance,
        referenceType,
        referenceId,
        notes,
        user,
      },
    ],
    { session }
  );

  sup.currentBalancePaisa = newBalance;
  await sup.save({ session });
  return newBalance;
}

/** Post a cash/bank account movement. amountPaisa is signed: +in, -out. */
async function postCashTransaction({ account, date, type, amountPaisa, referenceType, referenceId, notes, user, session }) {
  const acc = await CashAccount.findById(account).session(session);
  if (!acc) throw new Error('Cash account not found');

  const newBalance = acc.currentBalancePaisa + amountPaisa;

  await CashTransaction.create(
    [
      {
        account,
        date: date || new Date(),
        type,
        amountPaisa,
        balanceAfterPaisa: newBalance,
        referenceType,
        referenceId,
        notes,
        user,
      },
    ],
    { session }
  );

  acc.currentBalancePaisa = newBalance;
  await acc.save({ session });
  return newBalance;
}

module.exports = { postCustomerLedger, postSupplierLedger, postCashTransaction };
