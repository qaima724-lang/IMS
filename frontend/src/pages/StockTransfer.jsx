import { useEffect, useState } from 'react';
import { api } from '../api';

export default function StockTransfer() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [units, setUnits] = useState([]);

  const [form, setForm] = useState({ product: '', fromWarehouse: '', toWarehouse: '', quantity: '', unitId: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/products?limit=500').then((d) => setProducts(d.items));
    api.get('/warehouses').then((d) => {
      setWarehouses(d.items);
      if (d.items[0]) setForm((f) => ({ ...f, fromWarehouse: d.items[0]._id, toWarehouse: d.items[1]?._id || d.items[0]._id }));
    });
    api.get('/units').then((d) => setUnits(d.items));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError(''); setSuccess(''); setBusy(true);
    try {
      await api.post('/stock/transfer', {
        product: form.product,
        fromWarehouse: form.fromWarehouse,
        toWarehouse: form.toWarehouse,
        quantity: Number(form.quantity),
        unitId: form.unitId,
      });
      setSuccess('Stock transferred.');
      setForm((f) => ({ ...f, quantity: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Stock Transfer</h2>
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
            <label>From Warehouse</label>
            <select required value={form.fromWarehouse} onChange={(e) => setForm({ ...form, fromWarehouse: e.target.value })}>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>To Warehouse</label>
            <select required value={form.toWarehouse} onChange={(e) => setForm({ ...form, toWarehouse: e.target.value })}>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
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
        </div>
        <button className="primary" disabled={busy}>{busy ? 'Transferring...' : 'Transfer Stock'}</button>
        {error && <div className="error-text">{error}</div>}
        {success && <div style={{ color: 'var(--accent-2)', marginTop: 8 }}>{success}</div>}
      </form>
    </div>
  );
}
