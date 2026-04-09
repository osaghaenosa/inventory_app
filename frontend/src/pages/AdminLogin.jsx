import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // step 1: admin password gate, step 2: credentials
  const [adminPassword, setAdminPassword] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGate = (e) => {
    e.preventDefault();
    if (!adminPassword) { setError('Enter admin password'); return; }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/admin-login', { ...form, adminPassword });
      login(res.data.user, res.data.token);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">InventoryOS</div>
        <h2 className="auth-title">Admin Access</h2>
        <p className="auth-subtitle">
          {step === 1 ? 'Enter the admin access password to continue' : 'Enter your admin credentials'}
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleGate}>
            <div className="form-group">
              <label className="form-label">Admin Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            <button className="btn btn-primary w-full" style={{ justifyContent: 'center', marginTop: 8 }}>
              Verify Password
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="admin@inventory.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button className="btn btn-primary w-full" style={{ justifyContent: 'center', marginTop: 8 }} disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Login as Admin'}
            </button>
            <button type="button" className="btn btn-secondary w-full" style={{ justifyContent: 'center', marginTop: 8 }} onClick={() => setStep(1)}>
              ← Back
            </button>
          </form>
        )}

        <div className="auth-footer" style={{ marginTop: 20 }}>
          <a onClick={() => navigate('/login')}>Worker? Login here →</a>
        </div>
      </div>
    </div>
  );
}
