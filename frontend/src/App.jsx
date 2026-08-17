import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Layout from './Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import POS from './pages/POS';
import Purchases from './pages/Purchases';
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import Sales from './pages/Sales';
import OpeningStock from './pages/OpeningStock';
import StockAdjust from './pages/StockAdjust';
import StockTransfer from './pages/StockTransfer';
import ExpiryReport from './pages/ExpiryReport';
import LowStock from './pages/LowStock';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="login-wrap">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="pos" element={<POS />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="customers" element={<Customers />} />
        <Route path="sales" element={<Sales />} />
        <Route path="stock/opening" element={<OpeningStock />} />
        <Route path="stock/adjust" element={<StockAdjust />} />
        <Route path="stock/transfer" element={<StockTransfer />} />
        <Route path="stock/expiry" element={<ExpiryReport />} />
        <Route path="stock/low" element={<LowStock />} />
      </Route>
    </Routes>
  );
}
