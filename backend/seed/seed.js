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
    password: 'admin123',
    role: 'super_admin',
  });
  const cashier = await User.create({
    name: 'Cashier',
    email: 'cashier@shop.pk',
    password: 'cashier123',
    role: 'cashier',
  });
  console.log('[seed] users created: admin@shop.pk / admin123, cashier@shop.pk / cashier123');

  const [piece, dozen, carton, box, pack, kg, bottle] = await Unit.insertMany([
    { name: 'Piece', shortCode: 'PC' },
    { name: 'Dozen', shortCode: 'DZ' },
    { name: 'Carton', shortCode: 'CTN' },
    { name: 'Box', shortCode: 'BOX' },
    { name: 'Pack', shortCode: 'PK' },
    { name: 'Kg', shortCode: 'KG' },
    { name: 'Bottle', shortCode: 'BTL' },
  ]);

  const [catBiscuits, catGrocery, catBaby, catCandies, catBeverages, catCold] = await Category.insertMany([
    { name: 'Biscuits' }, { name: 'Grocery' }, { name: 'Baby Items' },
    { name: 'Candies' }, { name: 'Beverages' }, { name: 'Cold Drinks' },
  ]);
  const [brandNestle, brandLU, brandNone, brandNational, brandMehran] = await Brand.insertMany([
    { name: 'Nestle' }, { name: 'LU' }, { name: 'Generic' }, { name: 'National' }, { name: 'Mehran' },
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

  // --- More products, one per remaining category, to give the catalog real breadth ---
  const chocBiscuits = await Product.create({
    name: 'Chocolate Biscuits', category: catBiscuits, brand: brandLU, sku: 'BIS-CHOC-01',
    barcode: '8964000000042', baseUnit: piece._id, purchaseUnit: carton._id, saleUnit: piece._id,
    unitConversions: [{ unit: carton._id, factor: 20 }, { unit: dozen._id, factor: 12 }],
    pricing: { costPricePaisa: rsToPaisa(45), wholesalePricePaisa: rsToPaisa(52), retailPricePaisa: rsToPaisa(60) },
    reorderLevel: 60, taxRatePercent: 0,
  });

  const milkPowder = await Product.create({
    name: 'Milk Powder 900g', category: catGrocery, brand: brandNestle, sku: 'GRO-MILK-900',
    barcode: '8964000000059', baseUnit: box._id, purchaseUnit: box._id, saleUnit: box._id,
    unitConversions: [],
    pricing: { costPricePaisa: rsToPaisa(780), wholesalePricePaisa: rsToPaisa(850), retailPricePaisa: rsToPaisa(920) },
    reorderLevel: 15, taxRatePercent: 0,
  });

  const riceBag = await Product.create({
    name: 'Basmati Rice', category: catGrocery, brand: brandNational, sku: 'GRO-RICE-KG',
    barcode: '8964000000066', baseUnit: kg._id, purchaseUnit: kg._id, saleUnit: kg._id,
    unitConversions: [],
    pricing: { costPricePaisa: rsToPaisa(280), wholesalePricePaisa: rsToPaisa(310), retailPricePaisa: rsToPaisa(340) },
    reorderLevel: 50, taxRatePercent: 0,
  });

  const candyBox = await Product.create({
    name: 'Candy Box (Assorted)', category: catCandies, brand: brandNone, sku: 'CAN-BOX-01',
    barcode: '8964000000073', baseUnit: piece._id, purchaseUnit: box._id, saleUnit: piece._id,
    unitConversions: [{ unit: box._id, factor: 100 }],
    pricing: { costPricePaisa: rsToPaisa(3), wholesalePricePaisa: rsToPaisa(4), retailPricePaisa: rsToPaisa(5) },
    reorderLevel: 200, taxRatePercent: 0,
  });

  const cola1500 = await Product.create({
    name: 'Cola 1.5L', category: catCold, brand: brandNone, sku: 'CLD-COLA-1500',
    barcode: '8964000000080', baseUnit: bottle._id, purchaseUnit: carton._id, saleUnit: bottle._id,
    unitConversions: [{ unit: carton._id, factor: 12 }],
    pricing: { costPricePaisa: rsToPaisa(140), wholesalePricePaisa: rsToPaisa(160), retailPricePaisa: rsToPaisa(180) },
    reorderLevel: 24, taxRatePercent: 17,
  });

  const mineralWater = await Product.create({
    name: 'Mineral Water 1.5L', category: catBeverages, brand: brandNone, sku: 'BEV-WATER-1500',
    barcode: '8964000000097', baseUnit: bottle._id, purchaseUnit: carton._id, saleUnit: bottle._id,
    unitConversions: [{ unit: carton._id, factor: 12 }],
    pricing: { costPricePaisa: rsToPaisa(45), wholesalePricePaisa: rsToPaisa(55), retailPricePaisa: rsToPaisa(65) },
    reorderLevel: 24, taxRatePercent: 0,
  });

  const juicePack = await Product.create({
    name: 'Juice 200ml (Mango)', category: catBeverages, brand: brandNone, sku: 'BEV-JUICE-200',
    barcode: '8964000000103', baseUnit: piece._id, purchaseUnit: pack._id, saleUnit: piece._id,
    unitConversions: [{ unit: pack._id, factor: 6 }, { unit: carton._id, factor: 24 }],
    pricing: { costPricePaisa: rsToPaisa(22), wholesalePricePaisa: rsToPaisa(26), retailPricePaisa: rsToPaisa(30) },
    reorderLevel: 48, taxRatePercent: 17,
  });

  const babyWipes = await Product.create({
    name: 'Baby Wipes (80pcs)', category: catBaby, brand: brandNestle, sku: 'BABY-WIPE-80',
    barcode: '8964000000110', baseUnit: pack._id, purchaseUnit: box._id, saleUnit: pack._id,
    unitConversions: [{ unit: box._id, factor: 12 }],
    pricing: { costPricePaisa: rsToPaisa(180), wholesalePricePaisa: rsToPaisa(210), retailPricePaisa: rsToPaisa(240) },
    reorderLevel: 20, taxRatePercent: 0,
  });

  console.log('[seed] products created with per-product unit conversions');

  const supplier2 = await Supplier.create({
    name: 'Karachi Wholesale Traders', businessName: 'Karachi Wholesale Traders',
    phone: '0321-9876543', city: 'Karachi', ntn: '7654321-9',
    creditLimitPaisa: rsToPaisa(400000), currentBalancePaisa: 0,
  });

  // --- Purchase 3: stocks the second batch of products, from a second supplier ---
  const purchase3 = await purchaseService.completePurchase({
    invoiceNumber: 'PINV-0003',
    supplier: supplier2._id,
    warehouse: mainGodown._id,
    purchaseDate: new Date('2026-07-10'),
    items: [
      { product: chocBiscuits._id, batchNumber: 'CHOC-A-JUL26', quantity: 8, unitId: carton._id,
        manufacturingDate: new Date('2026-06-10'), expiryDate: new Date('2027-02-10'), ratePaisa: rsToPaisa(45 * 20), taxPercent: 0 },
      { product: milkPowder._id, batchNumber: 'MILK-A-JUL26', quantity: 25, unitId: box._id,
        manufacturingDate: new Date('2026-05-01'), expiryDate: new Date('2027-11-01'), ratePaisa: rsToPaisa(780), taxPercent: 0 },
      { product: riceBag._id, batchNumber: 'RICE-A-JUL26', quantity: 100, unitId: kg._id,
        manufacturingDate: new Date('2026-06-01'), expiryDate: new Date('2028-06-01'), ratePaisa: rsToPaisa(280), taxPercent: 0 },
      { product: candyBox._id, batchNumber: 'CANDY-A-JUL26', quantity: 5, unitId: box._id,
        manufacturingDate: new Date('2026-06-01'), expiryDate: new Date('2027-06-01'), ratePaisa: rsToPaisa(3 * 100), taxPercent: 0 },
      { product: cola1500._id, batchNumber: 'COLA1500-A-JUL26', quantity: 10, unitId: carton._id,
        manufacturingDate: new Date('2026-06-15'), expiryDate: new Date('2027-06-15'), ratePaisa: rsToPaisa(140 * 12), taxPercent: 17 },
      { product: mineralWater._id, batchNumber: 'WATER-A-JUL26', quantity: 15, unitId: carton._id,
        manufacturingDate: new Date('2026-06-01'), expiryDate: new Date('2027-12-01'), ratePaisa: rsToPaisa(45 * 12), taxPercent: 0 },
      { product: juicePack._id, batchNumber: 'JUICE-A-JUL26', quantity: 10, unitId: carton._id,
        manufacturingDate: new Date('2026-06-20'), expiryDate: new Date('2026-12-20'), ratePaisa: rsToPaisa(22 * 24), taxPercent: 17 },
      { product: babyWipes._id, batchNumber: 'WIPES-A-JUL26', quantity: 6, unitId: box._id,
        manufacturingDate: new Date('2026-05-01'), expiryDate: new Date('2028-05-01'), ratePaisa: rsToPaisa(180 * 12), taxPercent: 0 },
    ],
    paidAmountPaisa: 0, // fully on credit, so Karachi Wholesale Traders shows an outstanding payable
    user: admin._id,
  });
  console.log('[seed] purchase 3 (broader catalog) done:', purchase3.invoiceNumber);

  // move a portion of each new product to Main Shop so POS search covers every category
  await withTransaction(async (session) => {
    const transfers = [
      [chocBiscuits, 60, piece], [milkPowder, 10, box], [riceBag, 30, kg], [candyBox, 150, piece],
      [cola1500, 40, bottle], [mineralWater, 60, bottle], [juicePack, 80, piece], [babyWipes, 30, pack],
    ];
    for (const [prod, qty, unit] of transfers) {
      const p = await Product.findById(prod._id).session(session);
      await inventoryService.transferStock({
        product: prod._id, fromWarehouse: mainGodown._id, toWarehouse: mainShop._id,
        baseQuantity: qty, enteredUnit: unit._id, conversionFactor: p.factorFor(unit._id), user: admin._id, session,
      });
    }
  });
  console.log('[seed] broader catalog stock transferred Main Godown -> Main Shop');

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
