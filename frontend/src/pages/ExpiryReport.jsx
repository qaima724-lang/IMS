import { useEffect, useState } from 'react';
import { api } from '../api';

const STATUS_BADGE = {
  expired: 'danger',
  expiring_today: 'danger',
  expiring_7_days: 'warn',
  expiring_30_days: 'warn',
  expiring_60_days: 'good',
  safe: 'good',
};
const STATUS_LABEL = {
  expired: 'Expired', expiring_today: 'Expiring Today', expiring_7_days: '≤ 7 Days',
  expiring_30_days: '≤ 30 Days', expiring_60_days: '≤ 60 Days', safe: 'Safe',
};

export default function ExpiryReport() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/stock/expiry-report').then((d) => setItems(d.items)).catch((e) => setError(e.message));
  }, []);

  const filtered = filter === 'all' ? items : items.filter((i) => i.expiryStatus === filter);

  return (
    <div>
      <div className="spread" style={{ marginBottom: 16 }}>
        <h2>Expiry Report</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="expired">Expired</option>
          <option value="expiring_today">Expiring Today</option>
          <option value="expiring_7_days">Within 7 Days</option>
          <option value="expiring_30_days">Within 30 Days</option>
          <option value="expiring_60_days">Within 60 Days</option>
          <option value="safe">Safe</option>
        </select>
      </div>
      {error && <div className="error-text">{error}</div>}
      <div className="card">
        <table>
          <thead><tr><th>Product</th><th>Batch</th><th>Warehouse</th><th>Supplier</th><th>Remaining Qty</th><th>Expiry Date</th><th>Status</th></tr></thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b._id}>
                <td>{b.product?.name}</td>
                <td>{b.batchNumber}</td>
                <td>{b.warehouse?.name}</td>
                <td>{b.supplier?.name || '-'}</td>
                <td>{b.remainingQty}</td>
                <td>{new Date(b.expiryDate).toLocaleDateString()}</td>
                <td><span className={`badge ${STATUS_BADGE[b.expiryStatus]}`}>{STATUS_LABEL[b.expiryStatus]}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="muted">No batches match this filter</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
