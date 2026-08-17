/**
 * Money is NEVER stored or computed as floating-point Rupees.
 * All monetary fields in the DB are integer PAISA (1 Rs = 100 paisa).
 * Convert at the edges only: when a human types "110.50" in the UI,
 * and when we render a value back out.
 */

function rsToPaisa(rs) {
  if (rs === null || rs === undefined || rs === '') return 0;
  const n = Number(rs);
  if (Number.isNaN(n)) throw new Error(`Invalid monetary value: ${rs}`);
  // round to nearest paisa to kill float noise (e.g. 110.1 * 100 = 11009.999...)
  return Math.round(n * 100);
}

function paisaToRs(paisa) {
  return Math.round(paisa) / 100;
}

/**
 * Quantities can be fractional (kg, litre) but we still avoid raw float
 * drift by rounding to 3 decimal places on every write.
 */
function roundQty(qty) {
  const n = Number(qty);
  if (Number.isNaN(n)) throw new Error(`Invalid quantity: ${qty}`);
  return Math.round(n * 1000) / 1000;
}

module.exports = { rsToPaisa, paisaToRs, roundQty };
