import { useEffect, useState } from 'react';
import { api } from '../api';

const REASONS = [
  ['damaged', 'Damaged'], ['broken', 'Broken'], ['expired', 'Expired'], ['lost', 'Lost'],
  ['theft', 'Theft'], ['counting_error', 'Counting Error'], ['warehouse_correction', 'Warehouse Correction'],
  ['opening_correction', 'Opening Correction'], ['other', 'Other'],
];

export default function StockAdjust() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [units, setUnits] = useState([]);

  const [form, setForm] = useState({
    product: '', warehouse: '', direction: 'out', quantity: '', unitId: '', reason: 'damaged', notes: '', unitCostRs: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/products?limit=500').then((d) => setProducts(d.items));
    api.get('/warehouses').then((d) => { setWarehouses(d.items); if (d.items[0]) setForm((f) => ({ ...f, warehouse: d.items[0]._id })); });
    api.get('/units').then((d) => setUnits(d.items));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess(''); setBusy(true);
    try {
      await api.post('/stock/adjust', {
        product: form.product,
        warehouse: form.warehouse,
        direction: form.direction,
        quantity: Number(form.quantity),
        unitId: form.unitId,
        reason: form.reason,
        notes: form.notes,
        unitCostPaisa: Math.round(Number(form.unitCostRs || 0) * 100),
      });
      setSuccess('Stock adjustment recorded.');
      setForm((f) => ({ ...f, quantity: '', notes: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Stock Adjustment</h2>
      <form className="card" onSubmit={submit} style={{ maxWidth: 640 }}>
        <div className="field">
          <label>Product</label>
          <select required value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}>
            <option value="">--</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>Warehouse</label>
            <select required value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })}>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Direction</label>
            <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="out">Decrease (out)</option>
              <option value="in">Increase (in)</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field"><label>Quantity</label><input required type="number" step="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div className="field">
            <label>Unit</label>
            <select required value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
              <option value="">--</option>
              {units.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>
          {form.direction === 'in' && (
            <div className="field"><label>Unit Cost (Rs)</label><input type="number" step="0.01" value={form.unitCostRs} onChange={(e) => setForm({ ...form, unitCostRs: e.target.value })} /></div>
          )}
        </div>
        <div className="field">
          <label>Reason</label>
          <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
            {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field"><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Record Adjustment'}</button>
        {error && <div className="error-text">{error}</div>}
        {success && <div style={{ color: 'var(--accent-2)', marginTop: 8 }}>{success}</div>}
      </form>
    </div>
  );
}
