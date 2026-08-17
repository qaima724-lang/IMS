import { useEffect, useState } from 'react';
import { api, toRs, toPaisa } from '../api';

export default function Customers() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [cashAccounts, setCashAccounts] = useState([]);
  const [payAccount, setPayAccount] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get('/customers').then((d) => setItems(d.items));
  }
  useEffect(() => {
    load();
    api.get('/cash-accounts').then((d) => { setCashAccounts(d.items); if (d.items[0]) setPayAccount(d.items[0]._id); });
  }, []);

  function openLedger(c) {
    setSelected(c);
    api.get(`/customers/${c._id}/ledger`).then((d) => setLedger(d.entries));
  }

  async function recordPayment() {
    setError('');
    try {
      await api.post('/payments/from-customer', {
        customer: selected._id,
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
        <h2>Customers</h2>
        <button className="primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Close' : '+ New Customer'}</button>
      </div>
      {showForm && <CustomerForm onSaved={() => { setShowForm(false); load(); }} />}

      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div className="card" style={{ flex: 1 }}>
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Phone</th><th>Receivable (Udhaar)</th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => openLedger(c)}>
                  <td>{c.name}</td><td>{c.customerType}</td><td>{c.phone}</td>
                  <td className={c.currentBalancePaisa > 0 ? 'badge warn' : ''} style={c.currentBalancePaisa > 0 ? {} : {}}>
                    Rs. {toRs(c.currentBalancePaisa)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="card" style={{ width: 380 }}>
            <h2>{selected.name} — Ledger</h2>
            <div className="spread muted" style={{ marginBottom: 10 }}>
              <span>Current Outstanding</span><span>Rs. {toRs(selected.currentBalancePaisa)}</span>
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
              <div className="field"><label>Record Payment Received (Rs)</label><input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></div>
              <div className="field">
                <label>Into Account</label>
                <select value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
                  {cashAccounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
              <button className="primary" onClick={recordPayment}>Receive Payment</button>
              {error && <div className="error-text">{error}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerForm({ onSaved }) {
  const [form, setForm] = useState({ name: '', phone: '', customerType: 'retail', defaultPriceLevel: 'retail', creditLimitRs: '0', openingBalanceRs: '0' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/customers', {
        name: form.name, phone: form.phone, customerType: form.customerType, defaultPriceLevel: form.defaultPriceLevel,
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
        <div className="field">
          <label>Type</label>
          <select value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })}>
            <option value="retail">Retail</option><option value="wholesale">Wholesale</option>
            <option value="distributor">Distributor</option><option value="corporate">Corporate</option>
            <option value="special">Special</option>
          </select>
        </div>
        <div className="field"><label>Credit Limit (Rs)</label><input type="number" value={form.creditLimitRs} onChange={(e) => setForm({ ...form, creditLimitRs: e.target.value })} /></div>
        <div className="field"><label>Opening Balance (Receivable, Rs)</label><input type="number" value={form.openingBalanceRs} onChange={(e) => setForm({ ...form, openingBalanceRs: e.target.value })} /></div>
      </div>
      <button className="primary">Save Customer</button>
      {error && <div className="error-text">{error}</div>}
    </form>
  );
}
