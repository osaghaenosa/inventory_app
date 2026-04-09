import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export function AutoInput({ value, onChange, options = [], placeholder, required, style }) {
  const [show, setShow] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = e => {
    const v = e.target.value;
    onChange(v);
    const f = v ? options.filter(o => o.toLowerCase().includes(v.toLowerCase())) : options;
    setFiltered(f);
    setShow(f.length > 0);
  };

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <input className="form-input" value={value} onChange={handleChange}
        onFocus={() => {
          const f = value ? options.filter(o => o.toLowerCase().includes(value.toLowerCase())) : options;
          setFiltered(f); setShow(f.length > 0);
        }}
        placeholder={placeholder} required={required} autoComplete="off" />
      {show && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)',
          border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', zIndex: 300,
          maxHeight: 160, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 2 }}>
          {filtered.map((o, i) => (
            <div key={i} onMouseDown={() => { onChange(o); setShow(false); }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text)',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditCell({ editing, value, onChange, type = 'text', min, style, options }) {
  if (!editing) return <span>{value ?? '—'}</span>;
  if (options) return <AutoInput value={value || ''} onChange={onChange} options={options} style={style} />;
  return (
    <input className="inline-input" type={type} min={min} value={value ?? ''}
      onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      style={{ width: 100, ...style }} />
  );
}

export default function TableBase({
  title, subtitle, endpoint, columns, emptyMsg,
  canAdd = true, canDelete = false, readOnly = false, workerReadOnly = false,
  addForm: AddFormComponent, refreshSignal, itemOptions = []
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tables/${endpoint}`);
      setRows(res.data);
    } catch(e) { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, [endpoint]);

  useEffect(() => { fetchRows(); }, [fetchRows, refreshSignal]);

  const startEdit = row => {
    setEditId(row._id);
    const d = {};
    columns.forEach(c => { if (c.field) d[c.field] = row[c.field]; });
    setEditData(d);
    setError('');
  };

  const saveEdit = async () => {
    setSaving(true); setError('');
    try {
      await api.put(`/tables/${endpoint}/${editId}`, editData);
      setEditId(null);
      fetchRows();
      setSuccessMsg('Record updated successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch(e) {
      setError(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const deleteRow = async id => {
    if (!window.confirm('Delete this record? This may affect stock levels.')) return;
    setError('');
    try {
      const res = await api.delete(`/tables/${endpoint}/${id}`);
      fetchRows();
      if (res.data?.message) {
        setSuccessMsg(res.data.message);
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch(e) {
      setError(e.response?.data?.message || 'Delete failed');
    }
  };

  // The add form passes its own onSave (from AllTables) which handles API call
  // We just need to refresh after
  const handleFormSave = async data => {
    setSaving(true); setError('');
    try {
      // AddFormComponent.onSave is injected by AllTables and returns response
      // This path is used when addForm doesn't override onSave
      const res = await api.post(`/tables/${endpoint}`, data);
      setShowAdd(false);
      fetchRows();
      return res.data;
    } catch(e) {
      setError(e.response?.data?.message || 'Failed to add record');
      throw e;
    } finally { setSaving(false); }
  };

  const colCount = columns.length + (readOnly ? 0 : 1);

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>{successMsg}</div>
      )}

      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, maxWidth: 500 }}>{subtitle}</p>}
        </div>
        {canAdd && !readOnly && (
          <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(!showAdd); setError(''); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Row
          </button>
        )}
      </div>

      {showAdd && AddFormComponent && (
        <div className="card mb-4" style={{ borderColor: 'var(--accent)', borderLeftWidth: 3 }}>
          <div className="card-title">New {title} Entry</div>
          <AddFormComponent
            itemOptions={itemOptions}
            saving={saving}
            onSave={async data => {
              setSaving(true); setError('');
              try {
                const result = await handleFormSave(data);
                setShowAdd(false);
                return result;
              } catch(e) {
                // error already set in handleFormSave
              } finally { setSaving(false); }
            }}
            onCancel={() => { setShowAdd(false); setError(''); }}
          />
        </div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {columns.map(c => <th key={c.key}>{c.label}</th>)}
              {!readOnly && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} className="empty-state"><span className="spinner"></span></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colCount} className="empty-state"><p style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{emptyMsg || 'No records yet'}</p></td></tr>
            ) : rows.map(row => {
              const isEditing = editId === row._id;
              return (
                <tr key={row._id} className={isEditing ? 'editing' : ''}>
                  {columns.map(c => (
                    <td key={c.key} className={c.mono ? 'mono' : ''} style={c.style}>
                      {c.render
                        ? c.render(row, isEditing, editData, (f, v) => setEditData(p => ({ ...p, [f]: v })), itemOptions)
                        : isEditing && c.field
                          ? <EditCell editing={true} value={editData[c.field]} type={c.type}
                              onChange={v => setEditData(p => ({ ...p, [c.field]: v }))}
                              options={c.autocomplete ? itemOptions : undefined}
                              style={c.inputStyle} />
                          : <span style={c.valueStyle ? c.valueStyle(row) : {}}>
                              {c.format ? c.format(row[c.field]) : (row[c.field] ?? '—')}
                            </span>
                      }
                    </td>
                  ))}
                  {!readOnly && (
                    <td>
                      <div className="flex gap-2">
                        {isEditing ? (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>
                              {saving ? '…' : 'Save'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditId(null); setError(''); }}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {!workerReadOnly && <button className="btn btn-secondary btn-sm" onClick={() => startEdit(row)}>Edit</button>}
                          {workerReadOnly && <span style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'var(--font-mono)' }}>read-only</span>}
                            {isAdmin && (
                              <button className="btn btn-danger btn-sm" onClick={() => deleteRow(row._id)}>Del</button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
