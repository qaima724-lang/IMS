import { useEffect, useState } from 'react';
import { api, toRs, toPaisa } from '../api';

export default function Products() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get(`/products?q=${encodeURIComponent(q)}`).then((d) => setItems(d.items)).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api.get('/units').then((d) => setUnits(d.items));
    api.get('/categories').then((d) => setCategories(d.items));
    api.get('/brands').then((d) => setBrands(d.items));
  }, []);

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h2>Products</h2>
        <div className="row">
          <input placeholder="Search name / SKU / barcode" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          <button onClick={load}>Search</button>
          <button className="primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : '+ New Product'}</button>
        </div>
      </div>

      {showForm && (
        <ProductForm units={units} categories={categories} brands={brands} onSaved={() => { setShowForm(false); load(); }} />
      )}

      {error && <div className="error-text">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>SKU</th><th>Category</th><th>Base Unit</th>
              <th>Cost</th><th>Wholesale</th><th>Retail</th><th>Stock (default WH)</th><th>Reorder</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>{p.category?.name || '-'}</td>
                <td>{p.baseUnit?.name}</td>
                <td>Rs. {toRs(p.pricing?.costPricePaisa)}</td>
                <td>Rs. {toRs(p.pricing?.wholesalePricePaisa)}</td>
                <td>Rs. {toRs(p.pricing?.retailPricePaisa)}</td>
                <td>
                  {p.currentStock ?? '-'}{' '}
                  {p.currentStock !== null && p.currentStock <= p.reorderLevel && p.reorderLevel > 0 && (
                    <span className="badge warn">LOW</span>
                  )}
                </td>
                <td>{p.reorderLevel}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={9} className="muted">No products found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductForm({ units, categories, brands, onSaved }) {
  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', category: '', brand: '',
    baseUnit: '', reorderLevel: 0, taxRatePercent: 0,
    costRs: '', wholesaleRs: '', retailRs: '',
  });
  const [conversions, setConversions] = useState([]); // [{unit, factor}]
  const [error, setError] = useState('');

  function addConversion() {
    setConversions((c) => [...c, { unit: '', factor: '' }]);
  }
  function updateConv(i, field, val) {
    setConversions((c) => c.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/products', {
        name: form.name,
        sku: form.sku,
        barcode: form.barcode,
        category: form.category || undefined,
        brand: form.brand || undefined,
        baseUnit: form.baseUnit,
        reorderLevel: Number(form.reorderLevel),
        taxRatePercent: Number(form.taxRatePercent),
        unitConversions: conversions.filter((c) => c.unit && c.factor).map((c) => ({ unit: c.unit, factor: Number(c.factor) })),
        pricing: {
          costPricePaisa: toPaisa(form.costRs),
          wholesalePricePaisa: toPaisa(form.wholesaleRs),
          retailPricePaisa: toPaisa(form.retailRs),
        },
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={submit}>
      <h2>New Product</h2>
      <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="field"><label>Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field"><label>SKU</label><input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
        <div className="field"><label>Barcode</label><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
        <div className="field">
          <label>Category</label>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">--</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Brand</label>
          <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
            <option value="">--</option>
            {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Base Unit</label>
          <select required value={form.baseUnit} onChange={(e) => setForm({ ...form, baseUnit: e.target.value })}>
            <option value="">--</option>
            {units.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Reorder Level (base unit)</label><input type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
        <div className="field"><label>Tax %</label><input type="number" value={form.taxRatePercent} onChange={(e) => setForm({ ...form, taxRatePercent: e.target.value })} /></div>
        <div className="field"><label>Cost Price (Rs, per base unit)</label><input type="number" step="0.01" required value={form.costRs} onChange={(e) => setForm({ ...form, costRs: e.target.value })} /></div>
        <div className="field"><label>Wholesale Price (Rs)</label><input type="number" step="0.01" required value={form.wholesaleRs} onChange={(e) => setForm({ ...form, wholesaleRs: e.target.value })} /></div>
        <div className="field"><label>Retail Price (Rs)</label><input type="number" step="0.01" required value={form.retailRs} onChange={(e) => setForm({ ...form, retailRs: e.target.value })} /></div>
      </div>

      <div style={{ marginTop: 8 }}>
        <div className="spread"><label className="muted">Unit conversions (e.g. 1 Carton = 24 base units)</label><button type="button" onClick={addConversion}>+ Add</button></div>
        {conversions.map((c, i) => (
          <div key={i} className="row" style={{ marginTop: 6 }}>
            <select value={c.unit} onChange={(e) => updateConv(i, 'unit', e.target.value)}>
              <option value="">Unit</option>
              {units.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
            <span className="muted">= </span>
            <input type="number" placeholder="factor (base units)" value={c.factor} onChange={(e) => updateConv(i, 'factor', e.target.value)} style={{ width: 160 }} />
          </div>
        ))}
      </div>

      <button className="primary" style={{ marginTop: 14 }}>Save Product</button>
      {error && <div className="error-text">{error}</div>}
    </form>
  );
}
