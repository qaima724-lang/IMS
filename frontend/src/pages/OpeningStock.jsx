import { useEffect, useState } from 'react';
import { api } from '../api';

export default function OpeningStock() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [units, setUnits] = useState([]);

  const [form, setForm] = useState({
    product: '', warehouse: '', batchNumber: '', quantity: '', unitId: '',
    manufacturingDate: '', expiryDate: '', costRs: '',
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
      await api.post('/stock/opening', {
        product: form.product,
        warehouse: form.warehouse,
        batchNumber: form.batchNumber || undefined,
        quantity: Number(form.quantity),
        unitId: form.unitId,
        manufacturingDate: form.manufacturingDate || undefined,
        expiryDate: form.expiryDate || undefined,
        costPricePaisa: Math.round(Number(form.costRs || 0) * 100),
      });
      setSuccess('Opening stock recorded.');
      setForm((f) => ({ ...f, batchNumber: '', quantity: '', manufacturingDate: '', expiryDate: '', costRs: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Opening Stock</h2>
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
          <div className="field"><label>Batch #</label><input value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} /></div>
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
          <div className="field"><label>Cost/unit (Rs)</label><input required type="number" step="0.01" value={form.costRs} onChange={(e) => setForm({ ...form, costRs: e.target.value })} /></div>
        </div>
        <div className="row">
          <div className="field"><label>Manufacturing Date</label><input type="date" value={form.manufacturingDate} onChange={(e) => setForm({ ...form, manufacturingDate: e.target.value })} /></div>
          <div className="field"><label>Expiry Date</label><input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
        </div>
        <button className="primary" disabled={busy}>{busy ? 'Saving...' : 'Record Opening Stock'}</button>
        {error && <div className="error-text">{error}</div>}
        {success && <div style={{ color: 'var(--accent-2)', marginTop: 8 }}>{success}</div>}
      </form>
    </div>
  );
}
