import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';
import { AutoInput } from './TableBase.jsx';

function today() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

// ── Partial Payment Modal ────────────────────────────────────────────────────
function OwingModal({ debtor, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount'); return; }
    if (Number(amount) > debtor.price) { setError(`Cannot exceed remaining balance of ₦${debtor.price.toLocaleString()}`); return; }
    setSaving(true); setError('');
    try {
      await api.post(`/tables/debtors/${debtor._id}/pay`, { amount: Number(amount), note });
      onDone();
      onClose();
    } catch(e) { setError(e.response?.data?.message || 'Payment failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1100,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      backdropFilter:'blur(4px)' }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-light)',
        borderRadius:14, width:'100%', maxWidth:400, overflow:'hidden',
        boxShadow:'0 24px 64px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ padding:'18px 22px', background:'rgba(255,136,68,0.08)',
          borderBottom:'1px solid rgba(255,136,68,0.2)', display:'flex', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700,
              color:'var(--orange)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              Record Partial Payment
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>
              {debtor.customer_info}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none',
            color:'var(--text-dim)', cursor:'pointer', fontSize:18 }}>✕</button>
        </div>

        <div style={{ padding:22 }}>
          {/* Balance summary */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:18 }}>
            {[
              { label:'Original Debt', value:`₦${(debtor.original_price||debtor.price).toLocaleString()}`, color:'var(--text-muted)' },
              { label:'Paid So Far',   value:`₦${(debtor.amount_paid||0).toLocaleString()}`,               color:'var(--green)' },
              { label:'Still Owes',    value:`₦${debtor.price.toLocaleString()}`,                          color:'var(--red)' },
            ].map(s => (
              <div key={s.label} style={{ background:'var(--bg-card2)', borderRadius:8,
                padding:'10px 12px', border:'1px solid var(--border)', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:15, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:9, color:'var(--text-dim)', textTransform:'uppercase',
                  letterSpacing:'0.08em', fontFamily:'var(--font-mono)', marginTop:3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10,
              fontFamily:'var(--font-mono)', color:'var(--text-dim)', marginBottom:5 }}>
              <span>Payment progress</span>
              <span>{debtor.original_price > 0 ? Math.round(((debtor.amount_paid||0)/(debtor.original_price||1))*100) : 0}%</span>
            </div>
            <div style={{ height:8, background:'var(--bg-card2)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:4, background:'var(--green)',
                width:`${debtor.original_price > 0 ? Math.min(100,((debtor.amount_paid||0)/(debtor.original_price||1))*100) : 0}%`,
                transition:'width 0.4s ease' }} />
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom:14 }}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Amount Paying Now (₦)</label>
              <input className="form-input" type="number" min="1" max={debtor.price}
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={`Max: ₦${debtor.price.toLocaleString()}`} autoFocus required />
            </div>
            <div className="form-group">
              <label className="form-label">Note (optional)</label>
              <input className="form-input" value={note} onChange={e => setNote(e.target.value)}
                placeholder="e.g. Cash payment" />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:6 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}
                style={{ flex:1, justifyContent:'center' }}>
                {saving ? <span className="spinner"></span> : 'Record Payment'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Add Debtor Form ──────────────────────────────────────────────────────────
function AddDebtorForm({ itemOptions, onSave, onCancel, saving }) {
  const [f, setF] = useState({ customer_info:'', item_number:'', quantity:'', price:'' });
  const [stockInfo, setStockInfo] = useState(null);

  useEffect(() => {
    if (!f.item_number.trim()) { setStockInfo(null); return; }
    const t = setTimeout(() => {
      api.get(`/tables/stockcheck/${encodeURIComponent(f.item_number.trim())}`)
        .then(r => setStockInfo(r.data)).catch(() => setStockInfo(null));
    }, 400);
    return () => clearTimeout(t);
  }, [f.item_number]);

  const s = k => v => setF(p => ({ ...p, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10 }}>
        <div className="form-group" style={{ marginBottom:0 }}>
          <label className="form-label">Customer Info</label>
          <input className="form-input" value={f.customer_info} onChange={e => setF(p=>({...p,customer_info:e.target.value}))}
            required placeholder="Name / Phone" />
        </div>
        <div className="form-group" style={{ marginBottom:0 }}>
          <label className="form-label">Item Number</label>
          <AutoInput value={f.item_number} onChange={s('item_number')} options={itemOptions} placeholder="e.g. ITM-001" required />
          {stockInfo && (
            <div style={{ fontSize:10, fontFamily:'var(--font-mono)', marginTop:3,
              color: stockInfo.found ? (stockInfo.quantity < 5 ? 'var(--red)' : 'var(--green)') : 'var(--red)' }}>
              {stockInfo.found ? `Available: ${stockInfo.quantity} units` : '⚠ Item not found in stock'}
            </div>
          )}
        </div>
        <div className="form-group" style={{ marginBottom:0 }}>
          <label className="form-label">Quantity Taken</label>
          <input className="form-input" type="number" min="1" value={f.quantity}
            onChange={e => setF(p=>({...p,quantity:e.target.value}))} required placeholder="0" />
          {stockInfo?.found && f.quantity && Number(f.quantity) > stockInfo.quantity && (
            <div style={{ fontSize:10, color:'var(--red)', fontFamily:'var(--font-mono)', marginTop:3 }}>
              ⚠ Exceeds stock ({stockInfo.quantity})
            </div>
          )}
        </div>
        <div className="form-group" style={{ marginBottom:0 }}>
          <label className="form-label">Amount Owed (₦)</label>
          <input className="form-input" type="number" min="1" value={f.price}
            onChange={e => setF(p=>({...p,price:e.target.value}))} required placeholder="0" />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
          {saving ? <span className="spinner"></span> : 'Add Debtor'}
        </button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ── Debtor Card ──────────────────────────────────────────────────────────────
function DebtorCard({ debtor, onMarkPaid, onOwing, onDelete, isAdmin }) {
  const [expanded, setExpanded] = useState(false);
  const pct = debtor.original_price > 0
    ? Math.min(100, ((debtor.amount_paid||0) / debtor.original_price) * 100) : 0;

  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
      borderRadius:10, overflow:'hidden', transition:'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor='var(--border-light)'}
      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>

      {/* Card main row */}
      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, flexWrap:'wrap' }}>

          {/* Avatar */}
          <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(255,68,68,0.15)',
            border:'1px solid rgba(255,68,68,0.3)', display:'flex', alignItems:'center',
            justifyContent:'center', fontSize:16, fontWeight:800, color:'var(--red)', flexShrink:0 }}>
            {debtor.customer_info.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontWeight:700, color:'var(--text)', fontSize:14 }}>
                {debtor.customer_info}
              </span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--blue)',
                background:'var(--blue-dim)', padding:'2px 8px', borderRadius:20, border:'1px solid rgba(68,136,255,0.2)' }}>
                {debtor.item_number}
              </span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-dim)' }}>
                ×{debtor.quantity}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10,
                fontFamily:'var(--font-mono)', marginBottom:4 }}>
                <span style={{ color:'var(--text-dim)' }}>
                  Paid ₦{(debtor.amount_paid||0).toLocaleString()} of ₦{(debtor.original_price||debtor.price).toLocaleString()}
                </span>
                <span style={{ color:'var(--red)', fontWeight:700 }}>
                  ₦{debtor.price.toLocaleString()} left
                </span>
              </div>
              <div style={{ height:5, background:'var(--bg-card2)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, borderRadius:3,
                  background: pct >= 75 ? 'var(--green)' : pct >= 40 ? 'var(--orange)' : 'var(--red)',
                  transition:'width 0.5s ease' }} />
              </div>
            </div>

            <div style={{ fontSize:10, color:'var(--text-dim)', fontFamily:'var(--font-mono)', marginTop:5 }}>
              Added: {debtor.date} · By: {debtor.worker_id?.name || '—'}
            </div>
          </div>

          {/* Amount badge */}
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:18, fontWeight:900, color:'var(--red)' }}>
              ₦{debtor.price.toLocaleString()}
            </div>
            <div style={{ fontSize:9, color:'var(--text-dim)', textTransform:'uppercase',
              fontFamily:'var(--font-mono)', letterSpacing:'0.06em' }}>remaining</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
          <button onClick={() => onMarkPaid(debtor)}
            style={{ flex:1, minWidth:100, padding:'8px 12px', borderRadius:7, border:'none',
              background:'rgba(68,255,136,0.15)', color:'var(--green)', fontWeight:700,
              fontSize:12, cursor:'pointer', display:'flex', alignItems:'center',
              justifyContent:'center', gap:6, transition:'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(68,255,136,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(68,255,136,0.15)'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
            Fully Paid
          </button>
          <button onClick={() => onOwing(debtor)}
            style={{ flex:1, minWidth:100, padding:'8px 12px', borderRadius:7, border:'none',
              background:'rgba(255,136,68,0.15)', color:'var(--orange)', fontWeight:700,
              fontSize:12, cursor:'pointer', display:'flex', alignItems:'center',
              justifyContent:'center', gap:6, transition:'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,136,68,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,136,68,0.15)'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              width="14" height="14"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Part Payment
          </button>
          {(isAdmin) && (
            <button onClick={() => { if(window.confirm('Delete this debtor record?')) onDelete(debtor._id); }}
              style={{ padding:'8px 12px', borderRadius:7, border:'1px solid rgba(255,68,68,0.2)',
                background:'var(--red-dim)', color:'var(--red)', fontWeight:700, fontSize:12,
                cursor:'pointer', transition:'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,68,68,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--red-dim)'}>
              Delete
            </button>
          )}
          {debtor.payment_history?.length > 0 && (
            <button onClick={() => setExpanded(!expanded)}
              style={{ padding:'8px 12px', borderRadius:7, border:'1px solid var(--border)',
                background:'transparent', color:'var(--text-dim)', fontSize:12, cursor:'pointer' }}>
              {expanded ? 'Hide' : `History (${debtor.payment_history.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Payment history expansion */}
      {expanded && debtor.payment_history?.length > 0 && (
        <div style={{ borderTop:'1px solid var(--border)', padding:'12px 16px',
          background:'var(--bg-card2)' }}>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:10, textTransform:'uppercase',
            letterSpacing:'0.08em', color:'var(--text-dim)', marginBottom:8 }}>Payment History</div>
          {debtor.payment_history.map((p, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'6px 0', borderBottom: i < debtor.payment_history.length-1 ? '1px solid var(--border)' : 'none' }}>
              <div>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--green)' }}>
                  +₦{p.amount.toLocaleString()}
                </span>
                {p.note && <span style={{ fontSize:11, color:'var(--text-dim)', marginLeft:8 }}>{p.note}</span>}
              </div>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-dim)' }}>{p.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Debtors History Tab ──────────────────────────────────────────────────────
function DebtorsHistory() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tables/debtors/history')
      .then(r => setRecords(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:40 }}><span className="spinner"></span></div>;

  const paid   = records.filter(r => r.paid);
  const unpaid = records.filter(r => !r.paid);

  return (
    <div>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { label:'Total Debtors',    value: records.length,                    color:'var(--text)' },
          { label:'Still Owing',      value: unpaid.length,                     color:'var(--red)' },
          { label:'Fully Paid',       value: paid.length,                       color:'var(--green)' },
          { label:'Total Collected',  value:`₦${paid.reduce((s,r)=>s+(r.original_price||0),0).toLocaleString()}`, color:'var(--accent)' },
          { label:'Outstanding',      value:`₦${unpaid.reduce((s,r)=>s+r.price,0).toLocaleString()}`, color:'var(--red)' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg-card)', border:'1px solid var(--border)',
            borderRadius:8, padding:'12px 14px' }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:s.value.toString().length>6?14:20,
              fontWeight:800, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:9, color:'var(--text-dim)', textTransform:'uppercase',
              letterSpacing:'0.08em', fontFamily:'var(--font-mono)', marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead><tr>
            <th>Customer</th><th>Item</th><th>Qty</th>
            <th>Original</th><th>Paid</th><th>Remaining</th>
            <th>Status</th><th>Date</th><th>Worker</th>
          </tr></thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={9} className="empty-state"><p>No debtor history yet</p></td></tr>
            ) : records.map(r => (
              <tr key={r._id}>
                <td style={{ fontWeight:600, color:'var(--text)' }}>{r.customer_info}</td>
                <td style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--blue)' }}>{r.item_number}</td>
                <td style={{ fontFamily:'var(--font-mono)' }}>{r.quantity}</td>
                <td style={{ fontFamily:'var(--font-mono)', color:'var(--text-muted)' }}>₦{(r.original_price||r.price).toLocaleString()}</td>
                <td style={{ fontFamily:'var(--font-mono)', color:'var(--green)' }}>₦{(r.amount_paid||0).toLocaleString()}</td>
                <td style={{ fontFamily:'var(--font-mono)', color: r.paid ? 'var(--green)' : 'var(--red)', fontWeight:700 }}>
                  {r.paid ? '—' : `₦${r.price.toLocaleString()}`}
                </td>
                <td>
                  <span style={{ padding:'2px 10px', borderRadius:20, fontSize:10, fontFamily:'var(--font-mono)', fontWeight:700,
                    background: r.paid ? 'rgba(68,255,136,0.15)' : 'rgba(255,68,68,0.15)',
                    color: r.paid ? 'var(--green)' : 'var(--red)' }}>
                    {r.paid ? '✓ Paid' : 'Owes'}
                  </span>
                </td>
                <td style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-dim)' }}>{r.date}</td>
                <td style={{ fontSize:12, color:'var(--blue)' }}>{r.worker_id?.name||'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main DebtorsTable Component ───────────────────────────────────────────────
export default function DebtorsTable({ refreshSignal, itemOptions = [] }) {
  const [tab, setTab] = useState('active');
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [owingDebtor, setOwingDebtor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const isAdmin = localStorage.getItem('inv_user')
    ? JSON.parse(localStorage.getItem('inv_user')).role === 'admin' : false;

  const fetchDebtors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tables/debtors');
      setDebtors(res.data);
    } catch(e) { setError('Failed to load debtors'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDebtors(); }, [fetchDebtors, refreshSignal]);

  const showSuccess = msg => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const handleMarkPaid = async debtor => {
    if (!window.confirm(`Mark ${debtor.customer_info} as FULLY PAID? This will clear them from the active list.`)) return;
    try {
      await api.post(`/tables/debtors/${debtor._id}/markpaid`);
      fetchDebtors();
      showSuccess(`✓ ${debtor.customer_info} marked as fully paid`);
    } catch(e) { setError(e.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async id => {
    try {
      const res = await api.delete(`/tables/debtors/${id}`);
      fetchDebtors();
      showSuccess(res.data?.message || 'Deleted');
    } catch(e) { setError(e.response?.data?.message || 'Delete failed'); }
  };

  const handleAddDebtor = async data => {
    setSaving(true); setError('');
    try {
      await api.post('/tables/debtors', data);
      setShowAdd(false); fetchDebtors();
      showSuccess('Debtor added — stock has been deducted');
    } catch(e) { setError(e.response?.data?.message || 'Failed to add debtor'); }
    finally { setSaving(false); }
  };

  const totalOwed = debtors.reduce((s, r) => s + r.price, 0);

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom:12 }}>
        {error} <button onClick={()=>setError('')} style={{marginLeft:8,background:'none',border:'none',color:'inherit',cursor:'pointer',fontWeight:700}}>✕</button>
      </div>}
      {success && <div className="alert alert-success" style={{ marginBottom:12 }}>{success}</div>}

      {/* Sub-tabs */}
      <div className="tab-nav">
        {[
          { id:'active',  label:`Active Debtors (${debtors.length})` },
          { id:'history', label:'Debtors History' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`tab-item ${tab === t.id ? 'active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        <>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
            marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div>
              <h2 style={{ fontFamily:'var(--font-mono)', fontSize:15, fontWeight:700, color:'var(--text)' }}>
                Active Debtors
              </h2>
              <p style={{ fontSize:11, color:'var(--text-dim)', marginTop:2 }}>
                Adding a debtor immediately deducts from In Stock. Stock is returned only if deleted unpaid.
              </p>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              {totalOwed > 0 && (
                <div style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--red)',
                  background:'var(--red-dim)', border:'1px solid rgba(255,68,68,0.2)',
                  padding:'6px 12px', borderRadius:7 }}>
                  Total Owed: ₦{totalOwed.toLocaleString()}
                </div>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Debtor
              </button>
            </div>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="card mb-4" style={{ borderColor:'var(--accent)', borderLeftWidth:3 }}>
              <div className="card-title">New Debtor Entry</div>
              <AddDebtorForm
                itemOptions={itemOptions} saving={saving}
                onSave={handleAddDebtor}
                onCancel={() => { setShowAdd(false); setError(''); }} />
            </div>
          )}

          {/* Cards */}
          {loading ? (
            <div style={{ textAlign:'center', padding:40 }}><span className="spinner"></span></div>
          ) : debtors.length === 0 ? (
            <div style={{ textAlign:'center', padding:48, background:'var(--bg-card)',
              border:'1px solid var(--border)', borderRadius:10 }}>
              <div style={{ fontSize:32, marginBottom:10 }}>✓</div>
              <p style={{ color:'var(--text-dim)', fontFamily:'var(--font-mono)', fontSize:12 }}>
                No active debtors. All clear!
              </p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {debtors.map(d => (
                <DebtorCard key={d._id} debtor={d} isAdmin={isAdmin}
                  onMarkPaid={handleMarkPaid}
                  onOwing={setOwingDebtor}
                  onDelete={handleDelete} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'history' && <DebtorsHistory />}

      {/* Partial payment modal */}
      {owingDebtor && (
        <OwingModal
          debtor={owingDebtor}
          onClose={() => setOwingDebtor(null)}
          onDone={() => { fetchDebtors(); showSuccess(`Payment recorded for ${owingDebtor.customer_info}`); }} />
      )}
    </div>
  );
}
