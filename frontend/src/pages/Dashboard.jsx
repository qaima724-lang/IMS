import { useEffect, useState } from 'react';
import { api, toRs } from '../api';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/dashboard/summary'), api.get('/dashboard/recent-sales')])
      .then(([s, r]) => {
        setSummary(s);
        setRecentSales(r.items);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error-text">{error}</div>;
  if (!summary) return <div className="muted">Loading dashboard...</div>;

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="kpi-grid">
        <Kpi label="Today's Sales" value={`Rs. ${toRs(summary.todaySalesPaisa)}`} sub={`${summary.todaySalesCount} invoices`} />
        <Kpi label="Today's Profit" value={`Rs. ${toRs(summary.todayProfitPaisa)}`} cls="good" />
        <Kpi label="Today's Purchases" value={`Rs. ${toRs(summary.todayPurchasesPaisa)}`} />
        <Kpi label="Stock Value (cost)" value={`Rs. ${toRs(summary.stockValuePaisa)}`} />
        <Kpi label="Receivables (Udhaar)" value={`Rs. ${toRs(summary.receivablesPaisa)}`} cls="warn" />
        <Kpi label="Payables" value={`Rs. ${toRs(summary.payablesPaisa)}`} cls="danger" />
        {summary.cashAccounts.map((a) => (
          <Kpi key={a.id} label={a.name} value={`Rs. ${toRs(a.balancePaisa)}`} />
        ))}
      </div>

      <div className="card">
        <h2>Recent Sales</h2>
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {recentSales.map((s) => (
              <tr key={s._id}>
                <td>{s.invoiceNumber}</td>
                <td>{s.customer?.name || 'Walk-in'}</td>
                <td>Rs. {toRs(s.grandTotalPaisa)}</td>
                <td>{s.paymentMethod}</td>
                <td>Rs. {toRs(s.grossProfitPaisa)}</td>
              </tr>
            ))}
            {recentSales.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">No sales yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, cls }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className={`value ${cls || ''}`}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
