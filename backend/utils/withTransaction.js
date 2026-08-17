const mongoose = require('mongoose');

/**
 * Runs `fn(session)` inside a Mongo multi-document transaction.
 * Mongo transactions can throw TransientTransactionError on write
 * conflicts (e.g. two POS terminals racing to consume the last units of
 * the same batch) — those are safe to retry a few times rather than
 * surface to the cashier as a hard failure.
 */
async function withTransaction(fn, { retries = 3 } = {}) {
  const session = await mongoose.startSession();
  try {
    let attempt = 0;
    while (true) {
      attempt += 1;
      try {
        let result;
        await session.withTransaction(async () => {
          result = await fn(session);
        });
        return result;
      } catch (err) {
        const isTransient =
          err.errorLabels && err.errorLabels.includes('TransientTransactionError');
        if (isTransient && attempt <= retries) {
          continue; // retry
        }
        throw err;
      }
    }
  } finally {
    await session.endSession();
  }
}

module.exports = withTransaction;
