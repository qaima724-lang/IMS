require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const Unit = require('../models/Unit');
const Product = require('../models/Product');
const { Category, Brand, Warehouse, Customer, Supplier, CashAccount } = require('../models/Misc');
const inventoryService = require('../services/inventoryService');
const purchaseService = require('../services/purchaseService');
const salesService = require('../services/salesService');
const withTransaction = require('../utils/withTransaction');
const { rsToPaisa } = require('../utils/money');

async function run() {
  await connectDB();
  console.log('[seed] wiping existing data...');
  await Promise.all(
    ['users', 'units', 'products', 'categories', 'brands', 'warehouses', 'customers', 'suppliers',
     'cashaccounts', 'batches', 'stockmovements', 'purchases', 'sales', 'ledgerentries', 'cashtransactions']
      .map((c) => mongoose.connection.collection(c).deleteMany({}).catch(() => {}))
  );

  const admin = await User.create({
    name: 'Shop Owner',
    email: 'admin@shop.pk',
    passwordHash: await User.hashPassword('admin123'),
    role: 'super_admin',
  });
  const cashier = await User.create({
    name: 'Cashier',
    email: 'cashier@shop.pk',
    passwordHash: await User.hashPassword('cashier123'),
    role: 'cashier',
  });
  console.log('[seed] users created: admin@shop.pk / admin123, cashier@shop.pk / cashier123');

  const [piece, dozen, carton, box, pack, kg] = await Unit.insertMany([
    { name: 'Piece', shortCode: 'PC' },
    { name: 'Dozen', shortCode: 'DZ' },
    { name: 'Carton', shortCode: 'CTN' },
    { name: 'Box', shortCode: 'BOX' },
    { name: 'Pack', shortCode: 'PK' },
    { name: 'Kg', shortCode: 'KG' },
  ]);

  const [catBiscuits, catGrocery, catBaby, catCandies, catBeverages, catCold] = await Category.insertMany([
    { name: 'Biscuits' }, { name: 'Grocery' }, { name: 'Baby Items' },
    { name: 'Candies' }, { name: 'Beverages' }, { name: 'Cold Drinks' },
  ]);
  const [brandNestle, brandLU, brandNone] = await Brand.insertMany([
    { name: 'Nestle' }, { name: 'LU' }, { name: 'Generic' },
  ]);

  const [mainGodown, mainShop] = await Warehouse.insertMany([
    { name: 'Main Godown', isDefault: true },
    { name: 'Main Shop' },
  ]);

  const [cash, hbl] = await CashAccount.insertMany([
    { name: 'Cash', type: 'cash', openingBalancePaisa: rsToPaisa(50000), currentBalancePaisa: rsToPaisa(50000) },
    { name: 'HBL', type: 'bank', openingBalancePaisa: rsToPaisa(200000), currentBalancePaisa: rsToPaisa(200000) },
  ]);

  const supplier = await Supplier.create({
    name: 'Al-Rehman Distributors', businessName: 'Al-Rehman Distributors',
    phone: '0300-1234567', city: 'Lahore', ntn: '1234567-8',
    creditLimitPaisa: rsToPaisa(500000), currentBalancePaisa: 0,
  });

  const customerWholesale = await Customer.create({
    name: 'Malik Store', businessName: 'Malik General Store', phone: '0301-1112222',
    city: 'Lahore', customerType: 'wholesale', defaultPriceLevel: 'wholesale',
    creditLimitPaisa: rsToPaisa(100000), currentBalancePaisa: 0,
  });
  const customerRetail = await Customer.create({
    name: 'Walk-in Retail', customerType: 'retail', defaultPriceLevel: 'retail', currentBalancePaisa: 0,
  });

  // Products with per-product unit conversions, per the whiteboard requirement:
  // Product A: 1 Carton = 24 Piece. Product D: 1 Dozen = 12 Piece. etc.
  const marie = await Product.create({
    name: 'Marie Biscuits', category: catBiscuits, brand: brandLU, sku: 'BIS-MARIE-01',
    barcode: '8964000000011', baseUnit: piece._id, purchaseUnit: carton._id, saleUnit: piece._id,
    unitConversions: [{ unit: carton._id, factor: 24 }, { unit: dozen._id, factor: 12 }],
    pricing: { costPricePaisa: rsToPaisa(30), wholesalePricePaisa: rsToPaisa(35), retailPricePaisa: rsToPaisa(40) },
    reorderLevel: 100, taxRatePercent: 0,
  });

  const cola500 = await Product.create({
    name: 'Cola 500ml', category: catCold, brand: brandNone, sku: 'CLD-COLA-500',
    barcode: '8964000000028', baseUnit: piece._id, purchaseUnit: carton._id, saleUnit: piece._id,
    unitConversions: [{ unit: carton._id, factor: 24 }, { unit: dozen._id, factor: 12 }],
    pricing: { costPricePaisa: rsToPaisa(60), wholesalePricePaisa: rsToPaisa(70), retailPricePaisa: rsToPaisa(80) },
    reorderLevel: 48, taxRatePercent: 17,
  });

  const babyFormula = await Product.create({
    name: 'Baby Formula 400g', category: catBaby, brand: brandNestle, sku: 'BABY-FORM-400',
    barcode: '8964000000035', baseUnit: box._id, purchaseUnit: box._id, saleUnit: box._id,
    unitConversions: [], // sold as-is, no conversion needed (factorFor returns 1 for baseUnit)
    pricing: { costPricePaisa: rsToPaisa(850), wholesalePricePaisa: rsToPaisa(950), retailPricePaisa: rsToPaisa(1050) },
    reorderLevel: 10, taxRatePercent: 0,
  });

  console.log('[seed] products created with per-product unit conversions');

  // --- Purchase 1: creates Batch A of Marie Biscuits (older, expires sooner) ---
  const purchase1 = await purchaseService.completePurchase({
    invoiceNumber: 'PINV-0001',
    supplier: supplier._id,
    warehouse: mainGodown._id,
    purchaseDate: new Date('2026-06-01'),
    items: [
      {
        product: marie._id, batchNumber: 'MARIE-A-JUN26', quantity: 10, unitId: carton._id,
        manufacturingDate: new Date('2026-05-01'), expiryDate: new Date('2027-01-15'),
        ratePaisa: rsToPaisa(30 * 24), taxPercent: 0,
      },
      {
        product: cola500._id, batchNumber: 'COLA-A-JUN26', quantity: 20, unitId: carton._id,
        manufacturingDate: new Date('2026-05-15'), expiryDate: new Date('2027-05-15'),
        ratePaisa: rsToPaisa(60 * 24), taxPercent: 17,
      },
      {
        product: babyFormula._id, batchNumber: 'BABY-A-JUN26', quantity: 30, unitId: box._id,
        manufacturingDate: new Date('2026-04-01'), expiryDate: new Date('2027-10-01'),
        ratePaisa: rsToPaisa(850), taxPercent: 0,
      },
    ],
    paidAmountPaisa: rsToPaisa(30 * 24 * 10 * 0.5), // paid half, rest on credit -> supplier ledger
    paymentAccount: cash._id,
    user: admin._id,
  });
  console.log('[seed] purchase 1 (Batch A) done:', purchase1.invoiceNumber);

  // --- Purchase 2: creates Batch B of Marie Biscuits (newer, expires later) — sets up FIFO demo ---
  const purchase2 = await purchaseService.completePurchase({
    invoiceNumber: 'PINV-0002',
    supplier: supplier._id,
    warehouse: mainGodown._id,
    purchaseDate: new Date('2026-07-01'),
    items: [
      {
        product: marie._id, batchNumber: 'MARIE-B-JUL26', quantity: 10, unitId: carton._id,
        manufacturingDate: new Date('2026-06-01'), expiryDate: new Date('2027-03-15'),
        ratePaisa: rsToPaisa(31 * 24), taxPercent: 0,
      },
    ],
    paidAmountPaisa: 0, // fully on credit
    user: admin._id,
  });
  console.log('[seed] purchase 2 (Batch B) done:', purchase2.invoiceNumber);

  // --- Move some Marie stock + Cola stock from Godown to Shop so POS has stock to sell there ---
  const marieProduct = await Product.findById(marie._id);
  const colaProduct = await Product.findById(cola500._id);
  await withTransaction(async (session) => {
    await inventoryService.transferStock({
      product: marie._id, fromWarehouse: mainGodown._id, toWarehouse: mainShop._id,
      baseQuantity: 100, enteredUnit: piece._id, conversionFactor: marieProduct.factorFor(piece._id), user: admin._id, session,
    });
    await inventoryService.transferStock({
      product: cola500._id, fromWarehouse: mainGodown._id, toWarehouse: mainShop._id,
      baseQuantity: 200, enteredUnit: piece._id, conversionFactor: colaProduct.factorFor(piece._id), user: admin._id, session,
    });
  });
  console.log('[seed] stock transferred Main Godown -> Main Shop');

  // --- Sale 1 at Main Shop: 5 dozen Marie (60 pieces) — should FIFO-drain all of remaining Batch A first ---
  const sale1 = await salesService.completeSale({
    invoiceNumber: 'SINV-0001',
    customer: customerWholesale._id,
    warehouse: mainShop._id,
    items: [
      { product: marie._id, quantity: 5, unitId: dozen._id, priceLevel: 'wholesale' },
      { product: cola500._id, quantity: 2, unitId: carton._id, priceLevel: 'wholesale' },
    ],
    paymentMethod: 'credit',
    paidAmountPaisa: rsToPaisa(3000), // partial payment, rest goes to customer ledger
    paymentAccount: cash._id,
    user: cashier._id,
  });
  console.log('[seed] sale 1 done:', sale1.invoiceNumber, '- gross profit (paisa):', sale1.grossProfitPaisa);

  // --- Sale 2: cash retail sale, small quantity ---
  const sale2 = await salesService.completeSale({
    invoiceNumber: 'SINV-0002',
    customer: customerRetail._id,
    warehouse: mainShop._id,
    items: [
      { product: cola500._id, quantity: 6, unitId: piece._id, priceLevel: 'retail' },
      { product: marie._id, quantity: 1, unitId: dozen._id, priceLevel: 'retail' },
    ],
    paymentMethod: 'cash',
    paidAmountPaisa: rsToPaisa(6 * 80 + 12 * 40),
    paymentAccount: cash._id,
    user: cashier._id,
  });
  console.log('[seed] sale 2 done:', sale2.invoiceNumber);

  console.log('\n[seed] DONE. Log in with admin@shop.pk / admin123');
  console.log('[seed] Check Marie Biscuits batches to see FIFO consumption: Batch A should be nearly/fully depleted before Batch B.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
