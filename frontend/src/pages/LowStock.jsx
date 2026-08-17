import { useEffect, useState } from 'react';
import { api } from '../api';

export default function LowStock() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/stock/low-stock').then((d) => setItems(d.items)).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2>Low Stock / Reorder Alerts</h2>
      {error && <div className="error-text">{error}</div>}
      <div className="card">
        <table>
          <thead><tr><th>Product</th><th>SKU</th><th>Current Stock</th><th>Reorder Level</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.product._id}>
                <td>{i.product.name}</td>
                <td>{i.product.sku}</td>
                <td>{i.currentStock}</td>
                <td>{i.reorderLevel}</td>
                <td>
                  <span className={`badge ${i.currentStock <= 0 ? 'danger' : 'warn'}`}>
                    {i.currentStock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                  </span>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="muted">No products below reorder level</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
