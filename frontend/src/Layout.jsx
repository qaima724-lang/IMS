import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

const nav = [
  { group: 'Overview', items: [{ to: '/', label: 'Dashboard' }] },
  {
    group: 'Inventory',
    items: [
      { to: '/products', label: 'Products' },
      { to: '/stock/opening', label: 'Opening Stock' },
      { to: '/stock/adjust', label: 'Stock Adjustment' },
      { to: '/stock/transfer', label: 'Stock Transfer' },
      { to: '/stock/expiry', label: 'Expiry Report' },
      { to: '/stock/low', label: 'Low Stock' },
    ],
  },
  {
    group: 'Purchases',
    items: [
      { to: '/purchases', label: 'Purchases' },
      { to: '/suppliers', label: 'Suppliers' },
    ],
  },
  {
    group: 'Sales',
    items: [
      { to: '/pos', label: 'POS / New Sale' },
      { to: '/sales', label: 'Sales' },
      { to: '/customers', label: 'Customers' },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="brand">IMS</div>
        {nav.map((g) => (
          <div key={g.group}>
            <div className="group-label">{g.group}</div>
            {g.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
      <div className="main">
        <div className="topbar">
          <div />
          <div className="row">
            <span className="muted">{user?.name} ({user?.role})</span>
            <button onClick={logout}>Log out</button>
          </div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
