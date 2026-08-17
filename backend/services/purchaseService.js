const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const withTransaction = require('../utils/withTransaction');
const inventoryService = require('./inventoryService');
const pricingService = require('./pricingService');
const ledgerService = require('./ledgerService');

/**
 * Complete a purchase entry: for each line, create a batch (adds stock),
 * then post supplier payable and (if paid) cash — all atomic.
 *
 * payload = {
 *   invoiceNumber, supplier, warehouse, items: [
 *     { product, batchNumber, manufacturingDate, expiryDate, quantity, unitId, ratePaisa, discountPaisa }
 *   ],
 *   totalDiscountPaisa, paidAmountPaisa, paymentAccount, user
 * }
 */
async function completePurchase(payload) {
  return withTransaction(async (session) => {
    const {
      invoiceNumber,
      supplier,
      warehouse,
      items,
      totalDiscountPaisa = 0,
      paidAmountPaisa = 0,
      paymentAccount,
      purchaseDate,
      user,
    } = payload;

    if (!items || !items.length) {
      throw Object.assign(new Error('Purchase must have at least one item'), { status: 400 });
    }

    const lineDocs = [];
    let subtotalPaisa = 0;
    let totalTaxPaisa = 0;

    for (const item of items) {
      const product = await Product.findById(item.product).session(session);
      if (!product) throw Object.assign(new Error(`Product not found: ${item.product}`), { status: 400 });

      if (item.expiryDate && item.manufacturingDate && new Date(item.expiryDate) < new Date(item.manufacturingDate)) {
        throw Object.assign(new Error('Expiry date cannot be before manufacturing date'), { status: 400 });
      }

      const { baseQuantity, conversionFactor } = pricingService.toBaseQuantity(product, item.unitId, item.quantity);

      const discountPaisa = item.discountPaisa || 0;
      const gross = item.ratePaisa * item.quantity - discountPaisa;
      const taxPaisa = Math.round((gross * (item.taxPercent || 0)) / 100);
      const netAmountPaisa = gross + taxPaisa;

      const costPerBaseUnitPaisa = Math.round((item.ratePaisa * item.quantity) / baseQuantity);

      const batch = await inventoryService.addStock({
        product: product._id,
        warehouse,
        batchNumber: item.batchNumber,
        supplier,
        purchaseDate,
        manufacturingDate: item.manufacturingDate,
        expiryDate: item.expiryDate,
        enteredQuantity: item.quantity,
        enteredUnit: item.unitId,
        conversionFactor,
        costPricePaisa: costPerBaseUnitPaisa,
        sourceType: 'PURCHASE',
        sourceId: undefined,
        user,
        session,
      });

      subtotalPaisa += gross;
      totalTaxPaisa += taxPaisa;

      lineDocs.push({
        product: product._id,
        batchNumber: item.batchNumber,
        manufacturingDate: item.manufacturingDate,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        unit: item.unitId,
        conversionFactor,
        baseQuantity,
        ratePaisa: item.ratePaisa,
        discountPaisa,
        taxPercent: item.taxPercent || 0,
        netAmountPaisa,
        batch: batch._id,
      });
    }

    const grandTotalPaisa = subtotalPaisa + totalTaxPaisa - totalDiscountPaisa;

    const [purchase] = await Purchase.create(
      [
        {
          invoiceNumber,
          supplier,
          warehouse,
          purchaseDate: purchaseDate || new Date(),
          items: lineDocs,
          subtotalPaisa,
          totalDiscountPaisa,
          totalTaxPaisa,
          grandTotalPaisa,
          paidAmountPaisa,
          paymentAccount: paymentAccount || undefined,
          createdBy: user,
        },
      ],
      { session }
    );

    // Supplier ledger: full amount is a credit (we owe more); if paid now,
    // a same-transaction debit brings the payable back down.
    await ledgerService.postSupplierLedger({
      supplier,
      type: 'PURCHASE',
      creditPaisa: grandTotalPaisa,
      referenceType: 'Purchase',
      referenceId: purchase._id,
      notes: `Invoice ${invoiceNumber}`,
      user,
      session,
    });
    if (paidAmountPaisa > 0) {
      await ledgerService.postSupplierLedger({
        supplier,
        type: 'PAYMENT_MADE',
        debitPaisa: paidAmountPaisa,
        referenceType: 'Purchase',
        referenceId: purchase._id,
        notes: `Payment at purchase, invoice ${invoiceNumber}`,
        user,
        session,
      });
    }

    if (paidAmountPaisa > 0 && paymentAccount) {
      await ledgerService.postCashTransaction({
        account: paymentAccount,
        type: 'PURCHASE_PAYMENT',
        amountPaisa: -paidAmountPaisa,
        referenceType: 'Purchase',
        referenceId: purchase._id,
        notes: `Invoice ${invoiceNumber}`,
        user,
        session,
      });
    }

    return purchase;
  });
}

module.exports = { completePurchase };
