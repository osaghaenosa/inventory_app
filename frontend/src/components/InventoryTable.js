import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function InventoryTable({ isAdmin = false, refreshSignal }) {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ product_name: '', opening_stock: '', added_stock: '', sold_stock: '' });
  const [filterDate, setFilterDate] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const today = getTodayStr();

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterProduct) params.product = filterProduct;
      const res = await api.get('/inventory', { params });
      setRecords(res.data);
    } catch (err) {
      setError('Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [filterDate, filterProduct]);

  useEffect(() => { fetchRecords(); }, [fetchRecords, refreshSignal]);

  const startEdit = (record) => {
    setEditingId(record._id);
    setEditForm({
      product_name: record.product_name,
      opening_stock: record.opening_stock,
      added_stock: record.added_stock,
      sold_stock: record.sold_stock
    });
  };

  const saveEdit = async (id) => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        product_name: editForm.product_name,
        opening_stock: Number(editForm.opening_stock),
        added_stock: Number(editForm.added_stock),
        sold_stock: Number(editForm.sold_stock)
      };
      await api.put(`/inventory/${id}`, payload);
      setEditingId(null);
      fetchRecords();
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      fetchRecords();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  };

  const addRecord = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/inventory', {
        product_name: addForm.product_name,
        opening_stock: Number(addForm.opening_stock),
        added_stock: Number(addForm.added_stock) || 0,
        sold_stock: Number(addForm.sold_stock) || 0
      });
      setAddForm({ product_name: '', opening_stock: '', added_stock: '', sold_stock: '' });
      setShowAdd(false);
      fetchRecords();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add record');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = (record) => {
    if (isAdmin) return true;
    return record.date === today && record.worker_id?._id === user?._id || record.worker_id === user?._id;
  };

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="filters-row" style={{ margin: 0, flex: 1 }}>
          <input
            className="form-input"
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ maxWidth: 160 }}
          />
          <input
            className="form-input"
            type="text"
            placeholder="Filter product..."
            value={filterProduct}
            onChange={e => setFilterProduct(e.target.value)}
            style={{ maxWidth: 200 }}
          />
          {(filterDate || filterProduct) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setFilterDate(''); setFilterProduct(''); }}>Clear</button>
          )}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Record
        </button>
      </div>

      {showAdd && (
        <div className="card mb-4" style={{ borderColor: 'var(--accent)', borderLeftWidth: 3 }}>
          <div className="card-title">New Inventory Record</div>
          <form onSubmit={addRecord}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Product Name</label>
                <input className="form-input" value={addForm.product_name} onChange={e => setAddForm({ ...addForm, product_name: e.target.value })} required placeholder="e.g. Rice" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Opening Stock</label>
                <input className="form-input" type="number" min="0" value={addForm.opening_stock} onChange={e => setAddForm({ ...addForm, opening_stock: e.target.value })} required placeholder="0" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Added Stock</label>
                <input className="form-input" type="number" min="0" value={addForm.added_stock} onChange={e => setAddForm({ ...addForm, added_stock: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Sold Stock</label>
                <input className="form-input" type="number" min="0" value={addForm.sold_stock} onChange={e => setAddForm({ ...addForm, sold_stock: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                {saving ? <span className="spinner"></span> : 'Save Record'}
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
              <th>Date</th>
              <th>Product</th>
              <th>Opening</th>
              <th>Added</th>
              <th>Sold</th>
              <th>Remaining</th>
              {isAdmin && <th>Worker</th>}
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 9 : 8} className="empty-state"><span className="spinner"></span></td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={isAdmin ? 9 : 8} className="empty-state"><p>No records found</p></td></tr>
            ) : records.map(record => {
              const isEditing = editingId === record._id;
              const editable = canEdit(record);
              const isToday = record.date === today;
              return (
                <tr key={record._id} className={isEditing ? 'editing' : ''}>
                  <td className="date-badge mono">{record.date}</td>
                  <td className="bold">
                    {isEditing
                      ? <input className="inline-input" style={{ width: 120 }} value={editForm.product_name} onChange={e => setEditForm({ ...editForm, product_name: e.target.value })} />
                      : record.product_name}
                  </td>
                  <td className="mono">
                    {isEditing
                      ? <input className="inline-input" type="number" min="0" value={editForm.opening_stock} onChange={e => setEditForm({ ...editForm, opening_stock: e.target.value })} />
                      : record.opening_stock}
                  </td>
                  <td className="mono" style={{ color: record.added_stock > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                    {isEditing
                      ? <input className="inline-input" type="number" min="0" value={editForm.added_stock} onChange={e => setEditForm({ ...editForm, added_stock: e.target.value })} />
                      : `+${record.added_stock}`}
                  </td>
                  <td className="mono" style={{ color: record.sold_stock > 0 ? 'var(--orange)' : 'var(--text-muted)' }}>
                    {isEditing
                      ? <input className="inline-input" type="number" min="0" value={editForm.sold_stock} onChange={e => setEditForm({ ...editForm, sold_stock: e.target.value })} />
                      : `-${record.sold_stock}`}
                  </td>
                  <td className="mono bold" style={{ color: record.remaining_stock < 50 ? 'var(--red)' : 'var(--accent)' }}>
                    {isEditing
                      ? <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>auto</span>
                      : record.remaining_stock}
                  </td>
                  {isAdmin && (
                    <td style={{ color: 'var(--blue)', fontSize: 12 }}>
                      {record.worker_id?.name || '—'}
                    </td>
                  )}
                  <td>
                    <span className={`badge ${isToday ? 'badge-editable' : 'badge-locked'}`}>
                      {isToday ? 'live' : 'locked'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => saveEdit(record._id)} disabled={saving}>
                            {saving ? '…' : 'Save'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          {editable && (
                            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(record)}>Edit</button>
                          )}
                          {isAdmin && (
                            <button className="btn btn-danger btn-sm" onClick={() => deleteRecord(record._id)}>Del</button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
