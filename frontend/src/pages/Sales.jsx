import { useEffect, useState } from 'react';
import { api, toRs } from '../api';

export default function Sales() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/sales').then((d) => setItems(d.items)).catch((e) => setError(e.message));
  }, []);

  function open(s) {
    api.get(`/sales/${s._id}`).then((d) => setSelected(d.sale));
  }

  return (
    <div>
      <h2>Sales</h2>
      {error && <div className="error-text">{error}</div>}
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div className="card" style={{ flex: 1 }}>
          <table>
            <thead><tr><th>Invoice</th><th>Customer</th><th>Warehouse</th><th>Total</th><th>Payment</th><th>Profit</th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => open(s)}>
                  <td>{s.invoiceNumber}</td><td>{s.customer?.name || 'Walk-in'}</td><td>{s.warehouse?.name}</td>
                  <td>Rs. {toRs(s.grandTotalPaisa)}</td><td>{s.paymentMethod}</td><td>Rs. {toRs(s.grossProfitPaisa)}</td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="muted">No sales yet</td></tr>}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="card" style={{ width: 420 }}>
            <h2>Invoice {selected.invoiceNumber}</h2>
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>COGS</th><th>Total</th></tr></thead>
              <tbody>
                {selected.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.product?.name}</td>
                    <td>{it.quantity} {it.unit?.name}</td>
                    <td>Rs. {toRs(it.ratePaisa)}</td>
                    <td>Rs. {toRs(it.costOfGoodsPaisa)}</td>
                    <td>Rs. {toRs(it.lineTotalPaisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="spread" style={{ marginTop: 10 }}><span>Grand Total</span><span>Rs. {toRs(selected.grandTotalPaisa)}</span></div>
            <div className="spread"><span>Gross Profit</span><span>Rs. {toRs(selected.grossProfitPaisa)}</span></div>
            <div className="spread"><span>Outstanding</span><span>Rs. {toRs(selected.outstandingAmountPaisa)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
