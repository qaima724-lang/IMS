const express = require('express');
const router = express.Router();

const { requireAuth, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');
const productController = require('../controllers/productController');
const purchaseController = require('../controllers/purchaseController');
const salesController = require('../controllers/salesController');
const customerController = require('../controllers/customerController');
const supplierController = require('../controllers/supplierController');
const paymentController = require('../controllers/paymentController');
const stockController = require('../controllers/stockController');
const dashboardController = require('../controllers/dashboardController');
const catalog = require('../controllers/catalogController');

// --- auth ---
router.post('/auth/login', authController.login);
router.get('/auth/me', requireAuth, authController.me);

// everything below requires a logged-in user
router.use(requireAuth);

// --- catalog (categories/brands/units/warehouses/cash accounts) ---
router.get('/categories', catalog.categories.list);
router.post('/categories', requireRole('super_admin', 'admin', 'inventory_manager'), catalog.categories.create);
router.get('/brands', catalog.brands.list);
router.post('/brands', requireRole('super_admin', 'admin', 'inventory_manager'), catalog.brands.create);
router.get('/units', catalog.units.list);
router.post('/units', requireRole('super_admin', 'admin', 'inventory_manager'), catalog.units.create);
router.get('/warehouses', catalog.warehouses.list);
router.post('/warehouses', requireRole('super_admin', 'admin'), catalog.warehouses.create);
router.get('/cash-accounts', catalog.cashAccounts.list);
router.post('/cash-accounts', requireRole('super_admin', 'admin', 'accountant'), catalog.cashAccounts.create);

// --- products ---
router.get('/products', productController.list);
router.get('/products/:id', productController.get);
router.post('/products', requireRole('super_admin', 'admin', 'inventory_manager'), productController.create);
router.put('/products/:id', requireRole('super_admin', 'admin', 'inventory_manager'), productController.update);
router.delete('/products/:id', requireRole('super_admin', 'admin', 'inventory_manager'), productController.deactivate);

// --- stock: opening / adjustments / transfers / reports ---
router.post('/stock/opening', requireRole('super_admin', 'admin', 'inventory_manager'), stockController.openingStock);
router.post('/stock/adjust', requireRole('super_admin', 'admin', 'inventory_manager'), stockController.adjust);
router.post('/stock/transfer', requireRole('super_admin', 'admin', 'inventory_manager'), stockController.transfer);
router.get('/stock/expiry-report', stockController.expiryReport);
router.get('/stock/low-stock', stockController.lowStock);

// --- suppliers & purchases ---
router.get('/suppliers', supplierController.list);
router.post('/suppliers', requireRole('super_admin', 'admin', 'inventory_manager'), supplierController.create);
router.put('/suppliers/:id', requireRole('super_admin', 'admin', 'inventory_manager'), supplierController.update);
router.get('/suppliers/:id/ledger', supplierController.ledger);
router.get('/suppliers-outstanding', supplierController.outstanding);

router.get('/purchases', purchaseController.list);
router.get('/purchases/:id', purchaseController.get);
router.post('/purchases', requireRole('super_admin', 'admin', 'inventory_manager'), purchaseController.create);

// --- customers & sales/POS ---
router.get('/customers', customerController.list);
router.post('/customers', requireRole('super_admin', 'admin', 'manager', 'cashier'), customerController.create);
router.put('/customers/:id', requireRole('super_admin', 'admin', 'manager'), customerController.update);
router.get('/customers/:id/ledger', customerController.ledger);
router.get('/customers-outstanding', customerController.outstanding);

router.get('/sales', salesController.list);
router.get('/sales/:id', salesController.get);
router.post('/sales', requireRole('super_admin', 'admin', 'manager', 'cashier'), salesController.create);

// --- payments ---
router.post('/payments/from-customer', requireRole('super_admin', 'admin', 'accountant', 'cashier'), paymentController.receiveFromCustomer);
router.post('/payments/to-supplier', requireRole('super_admin', 'admin', 'accountant'), paymentController.payToSupplier);

// --- dashboard ---
router.get('/dashboard/summary', dashboardController.summary);
router.get('/dashboard/recent-sales', dashboardController.recentSales);

module.exports = router;
