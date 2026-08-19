import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    error: '',
    busy: false,
  });

  const { name, email, password, confirmPassword, error, busy } = form;

  async function submit(e) {
    e.preventDefault();
    setForm(prev => ({ ...prev, error: '' }));

    if (password.length < 8) {
      setForm(prev => ({ ...prev, error: 'Password must be at least 8 characters' }));
      return;
    }
    if (password !== confirmPassword) {
      setForm(prev => ({ ...prev, error: 'Passwords do not match' }));
      return;
    }

    setForm(prev => ({ ...prev, busy: true }));
    try {
      await register(name, email, password);
      nav('/');
    } catch (err) {
      console.log('error', typeof err, err);
      setForm(prev => ({
        ...prev,
        error: err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      }));
    } finally {
      setForm(prev => ({ ...prev, busy: false }));
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value, error: '' }));
  };

  return (
    <div className="login-wrap">
      <form className="card login-box" onSubmit={submit}>
        <h1>IMS — Inventory Management</h1>
        <p>Create your account</p>
        <div className="field">
          <label>Full Name</label>
          <input name="name" value={name} onChange={handleInputChange} type="text" required />
        </div>
        <div className="field">
          <label>Email</label>
          <input name="email" value={email} onChange={handleInputChange} type="email" required />
        </div>
        <div className="field">
          <label>Password</label>
          <input name="password" value={password} onChange={handleInputChange} type="password" required />
        </div>
        <div className="field">
          <label>Confirm Password</label>
          <input
            name="confirmPassword"
            value={confirmPassword}
            onChange={handleInputChange}
            type="password"
            required
          />
        </div>
        <button type="submit" className="primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Creating account...' : 'Create account'}
        </button>
        {error && <div className="error-text">{error}</div>}
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}