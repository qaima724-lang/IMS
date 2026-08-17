const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set in .env');

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri);
  console.log(`[db] connected: ${mongoose.connection.name}`);

  // Sanity check: multi-document transactions require a replica set.
  // We don't hard-fail here (Approach A is documented as needing it),
  // but we warn loudly so a solo dev doesn't chase a cryptic error later.
  try {
    const admin = mongoose.connection.db.admin();
    const info = await admin.command({ isMaster: 1 });
    if (!info.setName) {
      console.warn(
        '[db] WARNING: MongoDB is not running as a replica set. ' +
        'InventoryService relies on multi-document transactions (session.startTransaction) ' +
        'for atomic FIFO stock consumption + ledger updates. Start mongod with --replSet rs0 ' +
        'and run rs.initiate() once, or transactions will throw at runtime.'
      );
    }
  } catch (e) {
    // non-fatal — just a dev convenience check
  }
}

module.exports = connectDB;
