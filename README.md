# IMS — Inventory Management System (Phase 1 MVP)

A wholesale/retail FMCG inventory + accounting system for a single warehouse + shop
setup, built on MongoDB / Express / React / Node (MERN).

This is **Phase 1** of the full 57-module spec: the goal was to get the riskiest,
highest-value piece — the inventory transaction engine (multi-unit conversion +
FIFO batch consumption + atomic ledger/cash updates) — fully correct and working
end-to-end, with a real POS, purchasing, and customer/supplier ledgers on top of it.
Everything else in the original spec (purchase orders, sales returns, roles/permission
matrix, FBR e-invoicing, audit log UI, reports beyond the dashboard, backup/restore)
is designed for — the schema and service layer won't need rewriting — but isn't built yet.
See "What's not built yet" below.

## Architecture

```
frontend/   React (Vite) SPA — POS, products, purchases, ledgers, dashboard
backend/    Node/Express API
  models/     Mongoose schemas (Product, Batch, StockMovement, Sale, Purchase, ...)
  services/   ALL business logic lives here — controllers never touch stock/money directly
    inventoryService.js  <- the FIFO engine (see below)
    pricingService.js    <- unit conversion + price level resolution
    ledgerService.js     <- customer/supplier ledger + cash account postings
    salesService.js      <- orchestrates a POS sale atomically
    purchaseService.js   <- orchestrates a purchase entry atomically
  controllers/  thin HTTP layer, calls services
  routes/       Express routes + role-based access control
```

### The inventory engine, and why it's built this way

Every stock-affecting operation (sale, purchase, adjustment, transfer, opening stock)
runs inside a **MongoDB multi-document transaction** (`session.withTransaction`, see
`utils/withTransaction.js`). Within that transaction:

1. Batches are consumed **oldest-first (FIFO)** via `inventoryService.consumeFIFO`,
   using a guarded `findOneAndUpdate` (`remainingQty >= take`) per batch so two POS
   terminals racing on the last units of a batch can't both succeed.
2. Every stock change writes an append-only `StockMovement` row — nothing ever
   updates or deletes one. Stock history is fully reconstructable from this collection.
3. Ledger (`LedgerEntry`) and cash (`CashTransaction`) postings happen in the same
   transaction, so a sale can never exist without its inventory and financial
   consequences also being recorded — no partial states.
4. If Mongo reports a transient write conflict, the whole operation retries a few
   times automatically before giving up.

**Money** is stored as integer paisa everywhere in the database (never floats) —
see `utils/money.js`. The UI converts to/from Rupees only at the API boundary.

**Unit conversion** is per-product (`Product.unitConversions`), not global — Product
A's "1 Carton = 24 pieces" and Product C's "1 Box = 10 Packs" coexist correctly.
Every transaction records both the entered quantity/unit AND the converted base
quantity, so nothing is ambiguous later.

## Prerequisites

- Node.js 18+
- **MongoDB running as a replica set** — even a single-node one. This is required
  because `session.withTransaction` (multi-document ACID transactions) only works
  against a replica set, not a standalone `mongod`. One-time local setup:

  ```bash
  mongod --dbpath /path/to/data --replSet rs0
  # in another terminal, once:
  mongosh --eval "rs.initiate()"
  ```

  (MongoDB Atlas clusters are replica sets by default — no extra setup needed there.)

## Setup

```bash
# backend
cd backend
cp .env.example .env      # edit MONGO_URI / JWT_SECRET if needed
npm install
npm run seed               # wipes DB and loads realistic demo data (see below)
npm run dev                 # starts API on :5000

# frontend, in a second terminal
cd frontend
npm install
npm run dev                  # starts Vite dev server on :5173, proxies /api -> :5000
```

Open http://localhost:5173 and log in with:

- **Owner / admin:** `admin@shop.pk` / `admin123`
- **Cashier:** `cashier@shop.pk` / `cashier123`

## What the seed data demonstrates

- Two purchases of "Marie Biscuits" create **Batch A** (older, expires Jan 2027) and
  **Batch B** (newer, expires Mar 2027) at different costs.
- A stock transfer moves units from Main Godown to Main Shop.
- A sale of 5 dozen (60 pieces) at the shop drains Batch A first — check the batch
  quantities after seeding to see FIFO in action.
- One sale is a **partial-payment credit ("udhaar") sale** to a wholesale customer —
  check that customer's ledger to see the debit/credit/balance trail.
- One purchase is paid half in cash, half on credit — check the supplier's ledger.
- Multi-unit conversion is exercised throughout: Cartons and Dozens both convert to
  Pieces using each product's own factor.

## What's not built yet (by design — Phase 1 scope cut)

These were deliberately deferred, not forgotten. The schema and service layer are
shaped so they slot in without a rewrite:

- Purchase Orders (draft → received workflow) — currently purchases are entered directly
- Sales Returns / Purchase Returns — `StockMovement` already has `SALE_RETURN` and
  `PURCHASE_RETURN` types reserved for this
- Granular permission matrix (view/create/edit/delete/approve per module) — currently
  a flat role allow-list per route (`requireRole(...)` in `middleware/auth.js`)
- FBR e-invoicing integration — `taxRatePercent` is configurable per product and NTN/STRN
  fields exist on Customer/Supplier, but no FBR API calls are made
- Audit log UI (the data exists implicitly via StockMovement/LedgerEntry timestamps
  and `user` fields, but there's no dedicated audit trail collection or viewer yet)
- Backup/restore UI, barcode scanner hardware integration, PDF/thermal invoice printing,
  Excel/CSV export, expense tracking, full P&L report, fast/slow-moving reports

## Testing the FIFO logic yourself

After seeding, hit the API directly (or add a product/quantity in the UI) to sell
more Marie Biscuits than remain in Batch A — the sale's `items[].batchAllocations`
in the response (or via `GET /api/sales/:id`) will show the sale split across Batch A
and Batch B, each with its own cost, proving FIFO consumption and per-batch COGS.
