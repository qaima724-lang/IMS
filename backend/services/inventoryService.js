const mongoose = require('mongoose');
const Batch = require('../models/Batch');
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const { roundQty } = require('../utils/money');

/**
 * THE inventory transaction engine. Nothing outside this file should ever
 * write to Batch.remainingQty or insert a StockMovement directly.
 *
 * All methods accept an optional `session` (a Mongo ClientSession) so
 * callers (SalesService, PurchaseService) can compose several of these
 * calls plus their own ledger/cash writes into one atomic transaction.
 */

/**
 * Add stock: creates a new batch and an OPENING or PURCHASE movement.
 * Used by opening stock entry and by purchase completion.
 */
async function addStock({
  product,
  warehouse,
  batchNumber,
  supplier,
  purchaseDate,
  manufacturingDate,
  expiryDate,
  enteredQuantity,
  enteredUnit,
  conversionFactor,
  costPricePaisa,
  sourceType, // 'PURCHASE' | 'OPENING'
  sourceId,
  user,
  session,
}) {
  const baseQuantity = roundQty(enteredQuantity * conversionFactor);

  const [batch] = await Batch.create(
    [
      {
        product,
        warehouse,
        batchNumber,
        supplier: supplier || undefined,
        purchaseDate: purchaseDate || new Date(),
        manufacturingDate,
        expiryDate,
        quantityReceived: baseQuantity,
        remainingQty: baseQuantity,
        costPricePaisa,
        status: 'active',
        sourceType,
        sourceId,
      },
    ],
    { session }
  );

  await StockMovement.create(
    [
      {
        product,
        batch: batch._id,
        warehouse,
        type: sourceType, // OPENING or PURCHASE share the same movement type name
        baseQuantity, // +ve
        enteredQuantity,
        enteredUnit,
        conversionFactor,
        unitCostPaisa: costPricePaisa,
        referenceType: sourceType === 'PURCHASE' ? 'Purchase' : 'OpeningStock',
        referenceId: sourceId,
        user,
      },
    ],
    { session }
  );

  return batch;
}

/**
 * Consume stock FIFO: drains the oldest active batches (by purchaseDate)
 * for product+warehouse until `baseQuantityNeeded` is satisfied.
 * Throws (aborting the whole transaction) if available stock is insufficient
 * — unless allowNegative is true, in which case the shortfall is drawn
 * from a synthetic "negative" allocation with cost = product's last known cost.
 *
 * Returns the list of { batch, baseQuantity, unitCostPaisa } allocations,
 * which the caller stores on the sale line item for COGS + traceability.
 */
async function consumeFIFO({
  product,
  warehouse,
  baseQuantityNeeded,
  allowNegative = false,
  session,
}) {
  let remaining = roundQty(baseQuantityNeeded);
  const allocations = [];

  // Oldest first. This query + the per-batch guarded update below is what
  // makes concurrent sales of the same last units safe: two transactions
  // racing on the same batch will have one of them fail the `remainingQty >=`
  // guard and retry against the next batch (or the whole txn retries on
  // a write conflict — see salesService's retry wrapper).
  const batches = await Batch.find({
    product,
    warehouse,
    status: 'active',
    remainingQty: { $gt: 0 },
  })
    .sort({ purchaseDate: 1, createdAt: 1 })
    .session(session);

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.remainingQty);
    if (take <= 0) continue;

    const updated = await Batch.findOneAndUpdate(
      { _id: batch._id, remainingQty: { $gte: take } },
      {
        $inc: { remainingQty: -take },
        $set: { status: batch.remainingQty - take <= 0 ? 'depleted' : 'active' },
      },
      { new: true, session }
    );

    if (!updated) {
      // Someone else consumed this batch concurrently between our find and
      // update — bail out of this batch and let the outer retry (or the
      // remaining loop, if partial) handle it. Mongo's write-conflict
      // detection inside the transaction will usually force a clean retry.
      continue;
    }

    allocations.push({ batch: batch._id, baseQuantity: take, unitCostPaisa: batch.costPricePaisa });
    remaining = roundQty(remaining - take);
  }

  if (remaining > 0) {
    if (!allowNegative) {
      const err = new Error(
        `Insufficient stock. Short by ${remaining} base units for this product at the selected warehouse.`
      );
      err.status = 400;
      err.code = 'INSUFFICIENT_STOCK';
      throw err;
    }
    // Negative-stock sale explicitly enabled in settings: record the shortfall
    // against a null batch, costed at the product's last purchase cost.
    const prod = await Product.findById(product).session(session);
    allocations.push({
      batch: null,
      baseQuantity: remaining,
      unitCostPaisa: prod?.pricing?.costPricePaisa || 0,
    });
    remaining = 0;
  }

  return allocations;
}

/**
 * Write the StockMovement rows for a set of FIFO allocations (a SALE
 * or PURCHASE_RETURN going out). One movement per batch touched.
 */
async function recordConsumptionMovements({
  product,
  warehouse,
  allocations,
  type, // 'SALE' | 'PURCHASE_RETURN' | 'ADJUSTMENT_OUT' | 'TRANSFER_OUT'
  enteredUnit,
  conversionFactor,
  referenceType,
  referenceId,
  user,
  session,
}) {
  const docs = allocations.map((a) => ({
    product,
    batch: a.batch,
    warehouse,
    type,
    baseQuantity: -a.baseQuantity, // -ve = stock out
    enteredQuantity: roundQty(a.baseQuantity / conversionFactor),
    enteredUnit,
    conversionFactor,
    unitCostPaisa: a.unitCostPaisa,
    referenceType,
    referenceId,
    user,
  }));
  return StockMovement.insertMany(docs, { session });
}

/**
 * Direct stock adjustment (no batch drain from purchases — used for
 * damage/loss/count-correction). Picks FIFO batches to decrement for
 * OUT adjustments; creates a small standalone batch for IN adjustments.
 */
async function adjustStock({
  product,
  warehouse,
  direction, // 'in' | 'out'
  baseQuantity,
  reason,
  notes,
  unitCostPaisa,
  enteredUnit,
  conversionFactor,
  user,
  session,
}) {
  if (direction === 'out') {
    const allocations = await consumeFIFO({ product, warehouse, baseQuantityNeeded: baseQuantity, session });
    await recordConsumptionMovements({
      product,
      warehouse,
      allocations,
      type: 'ADJUSTMENT_OUT',
      enteredUnit,
      conversionFactor,
      referenceType: 'StockAdjustment',
      user,
      session,
    });
  } else {
    const batch = await addStock({
      product,
      warehouse,
      batchNumber: `ADJ-${Date.now()}`,
      enteredQuantity: roundQty(baseQuantity / conversionFactor),
      enteredUnit,
      conversionFactor,
      costPricePaisa: unitCostPaisa || 0,
      sourceType: 'OPENING', // reuse OPENING semantics: a fresh batch with no purchase link
      user,
      session,
    });
    return batch;
  }
}

/**
 * Transfer stock between warehouses: FIFO-consume from source, add a
 * fresh batch at destination (same batch number + cost, new warehouse).
 * Company-wide total stock is unchanged by construction.
 */
async function transferStock({
  product,
  fromWarehouse,
  toWarehouse,
  baseQuantity,
  enteredUnit,
  conversionFactor,
  user,
  session,
}) {
  const allocations = await consumeFIFO({
    product,
    warehouse: fromWarehouse,
    baseQuantityNeeded: baseQuantity,
    session,
  });
  await recordConsumptionMovements({
    product,
    warehouse: fromWarehouse,
    allocations,
    type: 'TRANSFER_OUT',
    enteredUnit,
    conversionFactor,
    referenceType: 'StockTransfer',
    user,
    session,
  });

  // Re-create at destination, one batch per source batch consumed, preserving cost.
  for (const a of allocations) {
    await addStock({
      product,
      warehouse: toWarehouse,
      batchNumber: `TRF-${Date.now()}-${String(a.batch || 'neg').slice(-4)}`,
      enteredQuantity: roundQty(a.baseQuantity / conversionFactor),
      enteredUnit,
      conversionFactor,
      costPricePaisa: a.unitCostPaisa,
      sourceType: 'OPENING',
      user,
      session,
    });
  }
}

/** Current on-hand base quantity for a product at a warehouse (sum of active batches). */
async function currentStock(product, warehouse) {
  const agg = await Batch.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(product), warehouse: new mongoose.Types.ObjectId(warehouse) } },
    { $group: { _id: null, total: { $sum: '$remainingQty' } } },
  ]);
  return agg.length ? agg[0].total : 0;
}

module.exports = {
  addStock,
  consumeFIFO,
  recordConsumptionMovements,
  adjustStock,
  transferStock,
  currentStock,
};
