import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Product autocomplete input component
function ProductInput({ value, onChange, placeholder, allProducts }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (val.trim()) {
      const matches = allProducts.filter(p =>
        p.toLowerCase().includes(val.toLowerCase())
      );
      setFiltered(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setFiltered(allProducts);
      setShowSuggestions(allProducts.length > 0);
    }
  };

  const handleFocus = () => {
    const matches = value.trim()
      ? allProducts.filter(p => p.toLowerCase().includes(value.toLowerCase()))
      : allProducts;
    setFiltered(matches);
    setShowSuggestions(matches.length > 0);
  };

  const selectProduct = (product) => {
    onChange(product);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        className="form-input"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        required
        placeholder={placeholder || 'e.g. Rice'}
        autoComplete="off"
      />
      {showSuggestions && filtered.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-sm)',
          zIndex: 200,
          maxHeight: 180,
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          marginTop: 2
        }}>
          {filtered.map((p, i) => (
            <div
              key={i}
              onMouseDown={() => selectProduct(p)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text)',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                width="12" height="12" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              {p}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InventoryTable({ isAdmin = false, refreshSignal }) {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
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

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/inventory/products');
      setAllProducts(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchProducts();
  }, [fetchRecords, fetchProducts, refreshSignal]);

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
      await api.put(`/inventory/${id}`, {
        product_name: editForm.product_name,
        opening_stock: Number(editForm.opening_stock),
        added_stock: Number(editForm.added_stock),
        sold_stock: Number(editForm.sold_stock)
      });
      setEditingId(null);
      fetchRecords();
      fetchProducts();
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
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add record');
    } finally {
      setSaving(false);
    }
  };

  // Strict lock: workers can only edit TODAY's own records
  const canEdit = (record) => {
    if (isAdmin) return true;
    const isToday = record.date === today;
    const isOwn = record.worker_id?._id === user?._id || record.worker_id === user?._id;
    return isToday && isOwn;
  };

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 10, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

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
          <div className="card-title">New Inventory Record — {today}</div>
          <form onSubmit={addRecord}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Product Name</label>
                <ProductInput
                  value={addForm.product_name}
                  onChange={val => setAddForm({ ...addForm, product_name: val })}
                  allProducts={allProducts}
                  placeholder="Type or select..."
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Opening Stock</label>
                <input className="form-input" type="number" min="0" value={addForm.opening_stock}
                  onChange={e => setAddForm({ ...addForm, opening_stock: e.target.value })} required placeholder="0" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Added Stock</label>
                <input className="form-input" type="number" min="0" value={addForm.added_stock}
                  onChange={e => setAddForm({ ...addForm, added_stock: e.target.value })} placeholder="0" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Sold Stock</label>
                <input className="form-input" type="number" min="0" value={addForm.sold_stock}
                  onChange={e => setAddForm({ ...addForm, sold_stock: e.target.value })} placeholder="0" />
              </div>
            </div>

            {/* Live remaining preview */}
            {addForm.opening_stock !== '' && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bg-card2)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                Remaining preview: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                  {Math.max(0, Number(addForm.opening_stock) + Number(addForm.added_stock || 0) - Number(addForm.sold_stock || 0))}
                </span>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
                {saving ? <span className="spinner"></span> : 'Save Record'}
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setShowAdd(false); setError(''); }}>Cancel</button>
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
                      ? <ProductInput
                          value={editForm.product_name}
                          onChange={val => setEditForm({ ...editForm, product_name: val })}
                          allProducts={allProducts}
                        />
                      : record.product_name}
                  </td>
                  <td className="mono">
                    {isEditing
                      ? <input className="inline-input" type="number" min="0" value={editForm.opening_stock}
                          onChange={e => setEditForm({ ...editForm, opening_stock: e.target.value })} />
                      : record.opening_stock}
                  </td>
                  <td className="mono" style={{ color: record.added_stock > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                    {isEditing
                      ? <input className="inline-input" type="number" min="0" value={editForm.added_stock}
                          onChange={e => setEditForm({ ...editForm, added_stock: e.target.value })} />
                      : `+${record.added_stock}`}
                  </td>
                  <td className="mono" style={{ color: record.sold_stock > 0 ? 'var(--orange)' : 'var(--text-muted)' }}>
                    {isEditing
                      ? <input className="inline-input" type="number" min="0" value={editForm.sold_stock}
                          onChange={e => setEditForm({ ...editForm, sold_stock: e.target.value })} />
                      : `-${record.sold_stock}`}
                  </td>
                  <td className="mono bold" style={{ color: record.remaining_stock < 50 ? 'var(--red)' : 'var(--accent)' }}>
                    {isEditing
                      ? <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                          {Math.max(0, Number(editForm.opening_stock || 0) + Number(editForm.added_stock || 0) - Number(editForm.sold_stock || 0))}
                        </span>
                      : record.remaining_stock}
                  </td>
                  {isAdmin && (
                    <td style={{ color: 'var(--blue)', fontSize: 12 }}>
                      {record.worker_id?.name || '—'}
                    </td>
                  )}
                  <td>
                    {isToday ? (
                      <span className="badge badge-editable">live</span>
                    ) : (
                      <span className="badge badge-locked">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          width="9" height="9" style={{ marginRight: 3 }}>
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        locked
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => saveEdit(record._id)} disabled={saving}>
                            {saving ? '…' : 'Save'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setEditingId(null); setError(''); }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          {editable && (
                            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(record)}>Edit</button>
                          )}
                          {!isAdmin && !isToday && (
                            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>read-only</span>
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
