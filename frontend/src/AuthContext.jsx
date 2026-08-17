import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ims_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => localStorage.removeItem('ims_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const d = await api.post('/auth/login', { email, password });
    localStorage.setItem('ims_token', d.token);
    setUser(d.user);
  }

  function logout() {
    localStorage.removeItem('ims_token');
    setUser(null);
  }

  async function register(name, email, password) {
    const d = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('ims_token', d.token);
    setUser(d.user);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
