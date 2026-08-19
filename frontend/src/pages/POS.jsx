import { useEffect, useMemo, useRef, useState } from 'react';
import { api, toRs, toPaisa } from '../api';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [units, setUnits] = useState([]);

  const [warehouse, setWarehouse] = useState('');
  const [customer, setCustomer] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]); // { product, name, unitId, unitName, qty, priceLevel, ratePaisa, taxRatePercent }
  const [invoiceDiscountRs, setInvoiceDiscountRs] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidRs, setPaidRs] = useState('');
  const [paymentAccount, setPaymentAccount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    api.get('/warehouses').then((d) => {
      setWarehouses(d.items);
      const shop = d.items.find((w) => w.name.toLowerCase().includes('shop')) || d.items[0];
      if (shop) setWarehouse(shop._id);
    });
    api.get('/customers').then((d) => setCustomers(d.items));
    api.get('/cash-accounts').then((d) => {
      setCashAccounts(d.items);
      if (d.items[0]) setPaymentAccount(d.items[0]._id);
    });
    api.get('/units').then((d) => setUnits(d.items));
    searchRef.current?.focus();
  }, []);

  function runSearch(q) {
    setSearch(q);
    if (q.length < 1) return setProducts([]);
    api.get(`/products?q=${encodeURIComponent(q)}&limit=10`).then((d) => setProducts(d.items));
  }

  const selectedCustomer = customers.find((c) => c._id === customer);
  const defaultPriceLevel = selectedCustomer?.defaultPriceLevel || 'retail';

  function addToCart(product) {
    const unitId = product.saleUnit?._id || product.baseUnit?._id;
    const unitName = units.find((u) => u._id === unitId)?.name || product.baseUnit?.name;
    const priceLevel = defaultPriceLevel === 'special' ? 'retail' : defaultPriceLevel; // special needs explicit override on backend; default UI to retail rate shown, still tagged
    const rate =
      priceLevel === 'wholesale' ? product.pricing?.wholesalePricePaisa : product.pricing?.retailPricePaisa;

    setCart((c) => [
      ...c,
      {
        key: Math.random().toString(36).slice(2),
        product: product._id,
        name: product.name,
        unitId,
        unitName,
        qty: 1,
        priceLevel,
        ratePaisa: rate || 0,
        taxRatePercent: product.taxRatePercent || 0,
      },
    ]);
    setSearch('');
    setProducts([]);
    searchRef.current?.focus();
  }

  function updateLine(key, field, value) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }
  function removeLine(key) {
    setCart((c) => c.filter((l) => l.key !== key));
  }

  const subtotalPaisa = useMemo(
    () => cart.reduce((sum, l) => sum + Math.round(l.ratePaisa * l.qty), 0),
    [cart]
  );
  const taxPaisa = useMemo(
    () => cart.reduce((sum, l) => sum + Math.round(l.ratePaisa * l.qty * (l.taxRatePercent / 100)), 0),
    [cart]
  );
  const invoiceDiscountPaisa = toPaisa(invoiceDiscountRs);
  const grandTotalPaisa = subtotalPaisa + taxPaisa - invoiceDiscountPaisa;

  useEffect(() => {
    if (paymentMethod !== 'credit') setPaidRs((grandTotalPaisa / 100).toFixed(2));
    else setPaidRs('0');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grandTotalPaisa, paymentMethod]);

  async function completeSale() {
    setError('');
    setSuccess('');
    if (!warehouse) return setError('Select a warehouse');
    if (!cart.length) return setError('Cart is empty');
    if (paymentMethod === 'credit' && !customer) return setError('Credit sale requires a customer');

    setBusy(true);
    try {
      const invoiceNumber = `SINV-${Date.now()}`;
      const res = await api.post('/sales', {
        invoiceNumber,
        customer: customer || undefined,
        warehouse,
        items: cart.map((l) => ({
          product: l.product,
          quantity: Number(l.qty),
          unitId: l.unitId,
          priceLevel: l.priceLevel,
        })),
        invoiceDiscountPaisa,
        paymentMethod,
        paidAmountPaisa: toPaisa(paidRs),
        paymentAccount: paymentMethod !== 'credit' || Number(paidRs) > 0 ? paymentAccount : undefined,
      });
      setLastReceipt({
        invoiceNumber: res.sale.invoiceNumber,
        date: new Date().toLocaleString(),
        items: [...cart],
        subtotal: subtotalPaisa,
        tax: taxPaisa,
        discount: invoiceDiscountPaisa,
        grandTotal: res.sale.grandTotalPaisa || grandTotalPaisa,
      });
      setSuccess(`Sale completed: ${res.sale.invoiceNumber} — Rs. ${toRs(res.sale.grandTotalPaisa)}`);
      setCart([]);
      setInvoiceDiscountRs('0');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function printReceipt() {
    if (!lastReceipt) return;
    const printWindow = window.open();
    printWindow.document.write(`
      <html>
      <head>
        <title>Receipt - ${lastReceipt.invoiceNumber}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            background: #fff;
            color: #000;
            margin: 0;
            padding: 20px;
            max-width: 400px;
            margin: 0 auto;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { text-align: left; padding: 4px 0; font-size: 14px; }
          th.right, td.right { text-align: right; }
          .totals-grid { display: grid; grid-template-columns: 1fr auto; gap: 4px; font-size: 14px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="text-center">
          <h2 style="margin: 0 0 5px 0;">YOUR RESTAURANT</h2>
          <div style="font-size: 14px;">123 Food Street, City</div>
          <div style="font-size: 14px;">Tel: (123) 456-7890</div>
        </div>
        <div class="divider"></div>
        <div style="font-size: 14px;">
          <div>Order: ${lastReceipt.invoiceNumber}</div>
          <div>Date: ${lastReceipt.date}</div>
        </div>
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th style="width: 15%">QTY</th>
              <th style="width: 45%">ITEM</th>
              <th class="right" style="width: 20%">PRICE</th>
              <th class="right" style="width: 20%">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${lastReceipt.items.map(l => `
              <tr>
                <td>${l.qty}</td>
                <td>${l.name}</td>
                <td class="right">${toRs(l.ratePaisa)}</td>
                <td class="right">${toRs(l.ratePaisa * l.qty)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="divider"></div>
        <div class="totals-grid">
          <div>Subtotal:</div>
          <div class="text-right">${toRs(lastReceipt.subtotal)}</div>
          <div>Tax:</div>
          <div class="text-right">${toRs(lastReceipt.tax)}</div>
          ${lastReceipt.discount > 0 ? `
          <div>Discount:</div>
          <div class="text-right">-${toRs(lastReceipt.discount)}</div>
          ` : ''}
          <div class="font-bold" style="font-size: 16px; margin-top: 4px;">TOTAL:</div>
          <div class="text-right font-bold" style="font-size: 16px; margin-top: 4px;">${toRs(lastReceipt.grandTotal)}</div>
        </div>
        <div class="divider"></div>
        <div class="text-center" style="font-size: 14px; margin-top: 20px;">
          Thank you for your visit!<br>
          Please come again.
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  return (
    <div className="pos-grid" style={{ height: 'calc(100vh - 100px)' }}>
      <div className="card" style={{ overflowY: 'auto' }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <select value={customer} onChange={(e) => setCustomer(e.target.value)} style={{ flex: 1 }}>
            <option value="">Walk-in Customer</option>
            {customers.map((c) => <option key={c._id} value={c._id}>{c.name} ({c.customerType})</option>)}
          </select>
        </div>

        <input
          ref={searchRef}
          placeholder="Search product name / SKU / barcode... (F2)"
          value={search}
          onChange={(e) => runSearch(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />

        {products.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {products.map((p) => (
              <div key={p._id} className="spread" style={{ padding: '8px 4px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => addToCart(p)}>
                <div>
                  <div>{p.name}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{p.sku} · stock: {p.currentStock ?? '?'}</div>
                </div>
                <div>Rs. {toRs(p.pricing?.retailPricePaisa)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="pos-cart-row" style={{ fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }}>
          <div>Item</div><div>Qty</div><div>Unit</div><div>Rate</div><div>Total</div><div></div>
        </div>
        {cart.map((l) => (
          <div key={l.key} className="pos-cart-row">
            <div>{l.name}</div>
            <input type="number" min="1" step="1" value={l.qty} onChange={(e) => updateLine(l.key, 'qty', e.target.value)} />
            <div className="muted">{l.unitName}</div>
            <input type="number" step="0.01" value={(l.ratePaisa / 100).toFixed(2)} onChange={(e) => updateLine(l.key, 'ratePaisa', toPaisa(e.target.value))} />
            <div>Rs. {toRs(l.ratePaisa * l.qty)}</div>
            <button className="danger" onClick={() => removeLine(l.key)}>×</button>
          </div>
        ))}
        {cart.length === 0 && <div className="muted" style={{ padding: 20, textAlign: 'center' }}>Search above to add items</div>}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        <h2>Bill Summary</h2>
        <div className="spread"><span className="muted">Subtotal</span><span>Rs. {toRs(subtotalPaisa)}</span></div>
        <div className="spread"><span className="muted">Tax</span><span>Rs. {toRs(taxPaisa)}</span></div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>Invoice Discount (Rs)</label>
          <input type="number" step="0.01" value={invoiceDiscountRs} onChange={(e) => setInvoiceDiscountRs(e.target.value)} />
        </div>
        <div className="spread" style={{ fontSize: 18, fontWeight: 700, margin: '10px 0', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <span>Grand Total</span><span>Rs. {toRs(grandTotalPaisa)}</span>
        </div>

        <div className="field">
          <label>Payment Method</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="card">Card</option>
            <option value="easypaisa">Easypaisa</option>
            <option value="jazzcash">JazzCash</option>
            <option value="credit">Credit / Udhaar</option>
          </select>
        </div>
        {paymentMethod !== 'credit' && (
          <div className="field">
            <label>Account</label>
            <select value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)}>
              {cashAccounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label>Paid Amount (Rs) {paymentMethod === 'credit' && '— leave 0 for full credit'}</label>
          <input type="number" step="0.01" value={paidRs} onChange={(e) => setPaidRs(e.target.value)} />
        </div>
        {paymentMethod === 'credit' && Number(paidRs) > 0 && (
          <div className="field">
            <label>Account (for partial payment received now)</label>
            <select value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)}>
              {cashAccounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <button className="primary" style={{ width: '100%', padding: 12, fontSize: 15 }} onClick={completeSale} disabled={busy}>
          {busy ? 'Processing...' : 'Complete Sale (F9)'}
        </button>
        {error && <div className="error-text">{error}</div>}
        {success && (
          <div style={{ marginTop: 8 }}>
            <div style={{ color: 'var(--accent-2)', fontSize: 12.5, marginBottom: 8 }}>{success}</div>
            <button style={{ width: '100%', padding: 12, fontSize: 15, background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer' }} onClick={printReceipt}>
              🖨️ Print Receipt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
