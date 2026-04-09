import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function WorkerManagement() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchWorkers = () => {
    api.get('/users').then(res => setWorkers(res.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchWorkers(); }, []);

  const createWorker = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/users', form);
      setSuccess(`Worker account created for ${form.name}`);
      setForm({ name: '', email: '', password: '' });
      setShowAdd(false);
      fetchWorkers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create worker');
    } finally {
      setSaving(false);
    }
  };

  const deleteWorker = async (id, name) => {
    if (!window.confirm(`Delete worker "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${id}`);
      fetchWorkers();
    } catch (err) {
      setError('Failed to delete worker');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="page-title">Workers</h1>
          <p className="page-subtitle">Manage worker accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Worker
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {showAdd && (
        <div className="card mb-4" style={{ borderColor: 'var(--accent)', borderLeftWidth: 3 }}>
          <div className="card-title">Create Worker Account</div>
          <form onSubmit={createWorker}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="John Doe" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="john@example.com" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Password</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required placeholder="Set a password" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                {saving ? <span className="spinner"></span> : 'Create Account'}
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="empty-state"><span className="spinner"></span></td></tr>
            ) : workers.length === 0 ? (
              <tr><td colSpan={5} className="empty-state"><p>No workers yet. Create one above.</p></td></tr>
            ) : workers.map(w => (
              <tr key={w._id}>
                <td className="bold">{w.name}</td>
                <td style={{ color: 'var(--text-muted)' }}>{w.email}</td>
                <td><span className="badge badge-worker">Worker</span></td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {new Date(w.createdAt).toLocaleDateString('en-GB')}
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteWorker(w._id, w.name)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
