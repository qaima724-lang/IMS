import { useEffect, useState } from 'react';
import { api, toRs, toPaisa } from '../api';

export default function Suppliers() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [cashAccounts, setCashAccounts] = useState([]);
  const [payAccount, setPayAccount] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get('/suppliers').then((d) => setItems(d.items));
  }
  useEffect(() => {
    load();
    api.get('/cash-accounts').then((d) => { setCashAccounts(d.items); if (d.items[0]) setPayAccount(d.items[0]._id); });
  }, []);

  function openLedger(s) {
    setSelected(s);
    api.get(`/suppliers/${s._id}/ledger`).then((d) => setLedger(d.entries));
  }

  async function recordPayment() {
    setError('');
    try {
      await api.post('/payments/to-supplier', {
        supplier: selected._id,
        amountPaisa: toPaisa(payAmount),
        account: payAccount,
      });
      setPayAmount('');
      load();
      openLedger(selected);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h2>Suppliers</h2>
        <button className="primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : '+ New Supplier'}</button>
      </div>
      {showForm && <SupplierForm onSaved={() => { setShowForm(false); load(); }} />}

      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div className="card" style={{ flex: 1 }}>
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>City</th><th>Payable</th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => openLedger(s)}>
                  <td>{s.name}</td><td>{s.phone}</td><td>{s.city}</td>
                  <td className={s.currentBalancePaisa > 0 ? 'muted' : ''}>Rs. {toRs(s.currentBalancePaisa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="card" style={{ width: 380 }}>
            <h2>{selected.name} — Ledger</h2>
            <div className="spread muted" style={{ marginBottom: 10 }}>
              <span>Current Payable</span><span>Rs. {toRs(selected.currentBalancePaisa)}</span>
            </div>
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Dr</th><th>Cr</th><th>Bal</th></tr></thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l._id}>
                    <td>{new Date(l.date).toLocaleDateString()}</td>
                    <td>{l.type}</td>
                    <td>{l.debitPaisa ? toRs(l.debitPaisa) : ''}</td>
                    <td>{l.creditPaisa ? toRs(l.creditPaisa) : ''}</td>
                    <td>{toRs(l.balanceAfterPaisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="field"><label>Record Payment (Rs)</label><input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
              <div className="field">
                <label>From Account</label>
                <select value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
                  {cashAccounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
              <button className="primary" onClick={recordPayment}>Pay Supplier</button>
              {error && <div className="error-text">{error}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SupplierForm({ onSaved }) {
  const [form, setForm] = useState({ name: '', phone: '', city: '', ntn: '', creditLimitRs: '0', openingBalanceRs: '0' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/suppliers', {
        name: form.name, phone: form.phone, city: form.city, ntn: form.ntn,
        creditLimitPaisa: toPaisa(form.creditLimitRs),
        openingBalancePaisa: toPaisa(form.openingBalanceRs),
      });
      onSaved();
    } catch (err) { setError(err.message); }
  }

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={submit}>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <div className="field"><label>Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="field"><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="field"><label>City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
        <div className="field"><label>NTN</label><input value={form.ntn} onChange={(e) => setForm({ ...form, ntn: e.target.value })} /></div>
        <div className="field"><label>Opening Balance (Payable, Rs)</label><input type="number" value={form.openingBalanceRs} onChange={(e) => setForm({ ...form, openingBalanceRs: e.target.value })} /></div>
      </div>
      <button className="primary">Save Supplier</button>
      {error && <div className="error-text">{error}</div>}
    </form>
  );
}
