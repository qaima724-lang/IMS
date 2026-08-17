const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Customer = require('../models/Misc').Customer;
const withTransaction = require('../utils/withTransaction');
const inventoryService = require('./inventoryService');
const pricingService = require('./pricingService');
const ledgerService = require('./ledgerService');

/**
 * Complete a POS sale. Everything below happens in ONE Mongo transaction:
 * stock consumption (FIFO), stock movements, customer ledger (if credit),
 * cash/bank posting (if paid), and the Sale document itself. If any step
 * throws, the whole thing rolls back — the spec's "never create an invoice
 * without updating inventory and financial records" rule, enforced by
 * construction rather than by convention.
 *
 * payload = {
 *   invoiceNumber, customer (id|null), warehouse, items: [
 *     { product, quantity, unitId, priceLevel }
 *   ],
 *   invoiceDiscountPaisa, paymentMethod, paidAmountPaisa, paymentAccount,
 *   allowNegativeStock, user
 * }
 */
async function completeSale(payload) {
  return withTransaction(async (session) => {
    const {
      invoiceNumber,
      customer: customerId,
      warehouse,
      items,
      invoiceDiscountPaisa = 0,
      paymentMethod,
      paidAmountPaisa = 0,
      paymentAccount,
      allowNegativeStock = false,
      user,
    } = payload;

    if (!items || !items.length) {
      const e = new Error('Sale must have at least one item');
      e.status = 400;
      throw e;
    }
    if (paymentMethod === 'credit' && !customerId) {
      const e = new Error('Credit sale requires a customer');
      e.status = 400;
      throw e;
    }

    let customer = null;
    if (customerId) {
      customer = await Customer.findById(customerId).session(session);
      if (!customer) throw Object.assign(new Error('Customer not found'), { status: 400 });
    }

    const lineDocs = [];
    let subtotalPaisa = 0;
    let totalCostOfGoodsPaisa = 0;
    let totalTaxPaisa = 0;

    for (const item of items) {
      const product = await Product.findById(item.product).session(session);
      if (!product || !product.active) {
        throw Object.assign(new Error(`Product not found or inactive: ${item.product}`), { status: 400 });
      }

      const { baseQuantity, conversionFactor } = pricingService.toBaseQuantity(
        product,
        item.unitId,
        item.quantity
      );

      const customerOverride = customer?.specialPricePaisaOverrides?.find(
        (o) => String(o.product) === String(product._id)
      )?.pricePaisa;

      const ratePaisa =
        item.customRatePaisa != null
          ? item.customRatePaisa
          : pricingService.resolveUnitPrice(product, item.unitId, item.priceLevel, customerOverride);

      const discountPaisa = item.discountPaisa || 0;
      const grossLine = ratePaisa * item.quantity - discountPaisa;
      const taxPaisa = Math.round((grossLine * (product.taxRatePercent || 0)) / 100);
      const lineTotalPaisa = grossLine + taxPaisa;

      // FIFO consume — this is the piece that must never be done outside a transaction.
      const allocations = await inventoryService.consumeFIFO({
        product: product._id,
        warehouse,
        baseQuantityNeeded: baseQuantity,
        allowNegative: allowNegativeStock,
        session,
      });

      await inventoryService.recordConsumptionMovements({
        product: product._id,
        warehouse,
        allocations,
        type: 'SALE',
        enteredUnit: item.unitId,
        conversionFactor,
        referenceType: 'Sale',
        referenceId: undefined, // filled after Sale doc is created (see below)
        user,
        session,
      });

      const costOfGoodsPaisa = allocations.reduce(
        (sum, a) => sum + Math.round(a.baseQuantity * a.unitCostPaisa),
        0
      );

      subtotalPaisa += grossLine;
      totalTaxPaisa += taxPaisa;
      totalCostOfGoodsPaisa += costOfGoodsPaisa;

      lineDocs.push({
        product: product._id,
        quantity: item.quantity,
        unit: item.unitId,
        conversionFactor,
        baseQuantity,
        priceLevel: item.priceLevel === 'special' || item.customRatePaisa != null ? item.priceLevel || 'custom' : item.priceLevel,
        ratePaisa,
        discountPaisa,
        taxPercent: product.taxRatePercent || 0,
        lineTotalPaisa,
        costOfGoodsPaisa,
        batchAllocations: allocations.map((a) => ({
          batch: a.batch,
          baseQuantity: a.baseQuantity,
          unitCostPaisa: a.unitCostPaisa,
        })),
      });
    }

    const grandTotalPaisa = subtotalPaisa + totalTaxPaisa - invoiceDiscountPaisa;
    const grossProfitPaisa = subtotalPaisa - totalCostOfGoodsPaisa - invoiceDiscountPaisa;
    const outstandingAmountPaisa = Math.max(grandTotalPaisa - paidAmountPaisa, 0);

    if (outstandingAmountPaisa > 0 && customer) {
      const newExposure = customer.currentBalancePaisa + outstandingAmountPaisa;
      if (customer.creditLimitPaisa > 0 && newExposure > customer.creditLimitPaisa) {
        throw Object.assign(
          new Error(
            `Customer credit limit exceeded. Limit: ${customer.creditLimitPaisa / 100}, would become: ${newExposure / 100}.`
          ),
          { status: 400 }
        );
      }
    }

    const [sale] = await Sale.create(
      [
        {
          invoiceNumber,
          customer: customerId || undefined,
          warehouse,
          items: lineDocs,
          subtotalPaisa,
          invoiceDiscountPaisa,
          totalTaxPaisa,
          grandTotalPaisa,
          totalCostOfGoodsPaisa,
          grossProfitPaisa,
          paymentMethod,
          paidAmountPaisa,
          outstandingAmountPaisa,
          paymentAccount: paymentAccount || undefined,
          createdBy: user,
        },
      ],
      { session }
    );

    // Customer ledger: full sale amount is a debit (they owe more);
    // if paid now, a same-transaction credit brings balance back down.
    if (customer) {
      await ledgerService.postCustomerLedger({
        customer: customer._id,
        type: 'SALE',
        debitPaisa: grandTotalPaisa,
        referenceType: 'Sale',
        referenceId: sale._id,
        notes: `Invoice ${invoiceNumber}`,
        user,
        session,
      });
      if (paidAmountPaisa > 0) {
        await ledgerService.postCustomerLedger({
          customer: customer._id,
          type: 'PAYMENT_RECEIVED',
          creditPaisa: paidAmountPaisa,
          referenceType: 'Sale',
          referenceId: sale._id,
          notes: `Payment at sale, invoice ${invoiceNumber}`,
          user,
          session,
        });
      }
    }

    // Cash/bank: only the amount actually collected right now.
    if (paidAmountPaisa > 0 && paymentAccount) {
      await ledgerService.postCashTransaction({
        account: paymentAccount,
        type: 'SALE_RECEIPT',
        amountPaisa: paidAmountPaisa,
        referenceType: 'Sale',
        referenceId: sale._id,
        notes: `Invoice ${invoiceNumber}`,
        user,
        session,
      });
    }

    return sale;
  });
}

module.exports = { completeSale };
