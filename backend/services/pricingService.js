const { roundQty } = require('../utils/money');

/**
 * Resolve the per-enteredUnit price for a product at a given price level,
 * honoring an explicit unit override if the product has one (e.g. carton
 * price isn't always exactly 24x the piece price), falling back to
 * baseUnit price * conversionFactor otherwise.
 */
function resolveUnitPrice(product, unitId, priceLevel, customerOverridePaisa) {
  if (priceLevel === 'special' && customerOverridePaisa != null) {
    return customerOverridePaisa;
  }

  const override = product.pricing.unitOverrides?.find((o) => String(o.unit) === String(unitId));
  if (override) {
    const field = priceLevel === 'wholesale' ? 'wholesalePricePaisa' : 'retailPricePaisa';
    if (override[field] != null) return override[field];
  }

  const factor = product.factorFor(unitId);
  const basePrice =
    priceLevel === 'wholesale' ? product.pricing.wholesalePricePaisa : product.pricing.retailPricePaisa;
  return Math.round(basePrice * factor);
}

/** Convert an entered quantity+unit into the product's base unit quantity. */
function toBaseQuantity(product, unitId, enteredQuantity) {
  const factor = product.factorFor(unitId);
  return { baseQuantity: roundQty(enteredQuantity * factor), conversionFactor: factor };
}

module.exports = { resolveUnitPrice, toBaseQuantity };
