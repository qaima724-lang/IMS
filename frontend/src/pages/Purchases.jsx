import { useEffect, useState } from 'react';
import { api, toRs, toPaisa } from '../api';

export default function Purchases() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get('/purchases').then((d) => setItems(d.items)).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h2>Purchases</h2>
        <button className="primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : '+ New Purchase'}</button>
      </div>
      {showForm && <PurchaseForm onSaved={() => { setShowForm(false); load(); }} />}
      {error && <div className="error-text">{error}</div>}
      <div className="card">
        <table>
          <thead><tr><th>Invoice</th><th>Supplier</th><th>Warehouse</th><th>Date</th><th>Total</th><th>Paid</th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p._id}>
                <td>{p.invoiceNumber}</td><td>{p.supplier?.name}</td><td>{p.warehouse?.name}</td>
                <td>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                <td>Rs. {toRs(p.grandTotalPaisa)}</td><td>Rs. {toRs(p.paidAmountPaisa)}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="muted">No purchases yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseForm({ onSaved }) {
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);

  const [supplier, setSupplier] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [paidRs, setPaidRs] = useState('0');
  const [paymentAccount, setPaymentAccount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function emptyLine() {
    return { product: '', batchNumber: '', manufacturingDate: '', expiryDate: '', quantity: '', unitId: '', ratePaisaRs: '', taxPercent: '0' };
  }

  useEffect(() => {
    api.get('/suppliers').then((d) => setSuppliers(d.items));
    api.get('/warehouses').then((d) => { setWarehouses(d.items); if (d.items[0]) setWarehouse(d.items[0]._id); });
    api.get('/products?limit=500').then((d) => setProducts(d.items));
    api.get('/units').then((d) => setUnits(d.items));
    api.get('/cash-accounts').then((d) => { setCashAccounts(d.items); if (d.items[0]) setPaymentAccount(d.items[0]._id); });
  }, []);

  function updateLine(i, field, val) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  }
  function addLine() { setLines((ls) => [...ls, emptyLine()]); }
  function removeLine(i) { setLines((ls) => ls.filter((_, idx) => idx !== i)); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const invoiceNumber = `PINV-${Date.now()}`;
      await api.post('/purchases', {
        invoiceNumber,
        supplier,
        warehouse,
        items: lines.map((l) => ({
          product: l.product,
          batchNumber: l.batchNumber || `AUTO-${Date.now()}`,
          manufacturingDate: l.manufacturingDate || undefined,
          expiryDate: l.expiryDate || undefined,
          quantity: Number(l.quantity),
          unitId: l.unitId,
          ratePaisa: toPaisa(l.ratePaisaRs),
          taxPercent: Number(l.taxPercent),
        })),
        paidAmountPaisa: toPaisa(paidRs),
        paymentAccount: Number(paidRs) > 0 ? paymentAccount : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={submit}>
      <h2>New Purchase Entry</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        <select required value={supplier} onChange={(e) => setSupplier(e.target.value)}>
          <option value="">Supplier</option>
          {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <select required value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </select>
      </div>

      {lines.map((l, i) => (
        <div key={i} className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          <select required value={l.product} onChange={(e) => updateLine(i, 'product', e.target.value)}>
            <option value="">Product</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <input placeholder="Batch #" value={l.batchNumber} onChange={(e) => updateLine(i, 'batchNumber', e.target.value)} style={{ width: 110 }} />
          <input type="date" title="Mfg Date" value={l.manufacturingDate} onChange={(e) => updateLine(i, 'manufacturingDate', e.target.value)} />
          <input type="date" title="Expiry Date" value={l.expiryDate} onChange={(e) => updateLine(i, 'expiryDate', e.target.value)} />
          <input required type="number" step="0.001" placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} style={{ width: 70 }} />
          <select required value={l.unitId} onChange={(e) => updateLine(i, 'unitId', e.target.value)}>
            <option value="">Unit</option>
            {units.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          <input required type="number" step="0.01" placeholder="Rate/unit Rs" value={l.ratePaisaRs} onChange={(e) => updateLine(i, 'ratePaisaRs', e.target.value)} style={{ width: 100 }} />
          <input type="number" step="0.01" placeholder="Tax %" value={l.taxPercent} onChange={(e) => updateLine(i, 'taxPercent', e.target.value)} style={{ width: 70 }} />
          <button type="button" className="danger" onClick={() => removeLine(i)}>×</button>
        </div>
      ))}
      <button type="button" onClick={addLine}>+ Add Line</button>

      <div className="row" style={{ marginTop: 14 }}>
        <div className="field"><label>Paid Now (Rs)</label><input type="number" step="0.01" value={paidRs} onChange={(e) => setPaidRs(e.target.value)} /></div>
        {Number(paidRs) > 0 && (
          <div className="field">
            <label>From Account</label>
            <select value={paymentAccount} onChange={(e) => setPaymentAccount(e.target.value)}>
              {cashAccounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Complete Purchase'}</button>
      {error && <div className="error-text">{error}</div>}
    </form>
  );
}
