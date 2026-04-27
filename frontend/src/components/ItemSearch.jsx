import React, { useState, useRef, useEffect } from 'react';
import api from '../utils/api.js';

const STATUS_CONFIG = {
  in_stock:    { label: 'In Stock',        color: '#44ff88', bg: 'rgba(68,255,136,0.1)',  icon: '✓', border: 'rgba(68,255,136,0.3)' },
  low_stock:   { label: 'Low Stock',       color: '#ff8844', bg: 'rgba(255,136,68,0.1)', icon: '⚠', border: 'rgba(255,136,68,0.3)' },
  out_of_stock:{ label: 'Out of Stock',    color: '#ff4444', bg: 'rgba(255,68,68,0.1)',  icon: '✕', border: 'rgba(255,68,68,0.3)' },
  not_found:   { label: 'Not Found',       color: '#888',    bg: 'rgba(136,136,136,0.1)',icon: '?', border: 'rgba(136,136,136,0.3)' },
};

function StatPill({ label, value, color }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', background:'var(--bg-card2)',
      border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', minWidth:100, flex:1 }}>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:700, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize:10, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:'0.08em',
        fontFamily:'var(--font-mono)', marginTop:4, textAlign:'center' }}>{label}</div>
    </div>
  );
}

function Section({ title, children, accent }) {
  return (
    <div style={{ marginTop:16, borderRadius:8, border:`1px solid ${accent || 'var(--border)'}`,
      overflow:'hidden' }}>
      <div style={{ padding:'8px 14px', background: accent ? `${accent}18` : 'var(--bg-card2)',
        borderBottom:`1px solid ${accent || 'var(--border)'}`,
        fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700,
        textTransform:'uppercase', letterSpacing:'0.1em', color: accent || 'var(--text-dim)' }}>
        {title}
      </div>
      <div style={{ padding:14 }}>{children}</div>
    </div>
  );
}

function MiniTable({ rows, cols }) {
  if (!rows || rows.length === 0) return (
    <p style={{ color:'var(--text-dim)', fontSize:12, fontFamily:'var(--font-mono)' }}>None recorded</p>
  );
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr>{cols.map(c => (
            <th key={c.key} style={{ textAlign:'left', padding:'6px 10px', fontFamily:'var(--font-mono)',
              fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-dim)',
              borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{c.label}</th>
          ))}</tr>
        </thead>
        <tbody>{rows.map((row, i) => (
          <tr key={row._id || i} style={{ background: i%2===0 ? 'transparent' : 'var(--bg-card2)' }}>
            {cols.map(c => (
              <td key={c.key} style={{ padding:'7px 10px', color: c.color ? c.color(row) : 'var(--text-muted)',
                fontFamily: c.mono ? 'var(--font-mono)' : 'var(--font-body)',
                borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                {c.render ? c.render(row) : (row[c.key] ?? '—')}
              </td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default function ItemSearch({ itemOptions = [] }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSugg(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = e => {
    const v = e.target.value;
    setQuery(v);
    if (v.trim()) {
      const f = itemOptions.filter(o => o.toLowerCase().includes(v.toLowerCase()));
      setSuggestions(f);
      setShowSugg(f.length > 0);
    } else {
      setSuggestions([]);
      setShowSugg(false);
      setResult(null);
    }
  };

  const doSearch = async (term) => {
    const q = (term || query).trim();
    if (!q) return;
    setLoading(true); setError(''); setResult(null); setShowSugg(false);
    try {
      const res = await api.post(`/tables/search`, { item_number: q });
      setResult(res.data);
    } catch(e) {
      setError(e.response?.data?.message || 'Search failed');
    } finally { setLoading(false); }
  };

  const status = result ? STATUS_CONFIG[result.stockStatus] : null;
  const s = result?.summary;

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Search bar */}
      <div ref={wrapRef} style={{ position:'relative' }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ flex:1, position:'relative' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              width="16" height="16" style={{ position:'absolute', left:12, top:'50%',
              transform:'translateY(-50%)', color:'var(--text-dim)', pointerEvents:'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={query}
              onChange={handleInput}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by item number..."
              style={{ width:'100%', background:'var(--bg-card2)', border:'2px solid var(--border)',
                borderRadius:8, padding:'11px 12px 11px 38px', color:'var(--text)', fontSize:14,
                fontFamily:'var(--font-body)', outline:'none', transition:'border-color 0.2s',
                boxSizing:'border-box' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            {showSugg && suggestions.length > 0 && (
              <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:400,
                background:'var(--bg-card)', border:'1px solid var(--border-light)',
                borderRadius:8, marginTop:4, maxHeight:200, overflowY:'auto',
                boxShadow:'0 12px 32px rgba(0,0,0,0.5)' }}>
                {suggestions.map((s, i) => (
                  <div key={i} onMouseDown={() => { setQuery(s); doSearch(s); }}
                    style={{ padding:'10px 16px', cursor:'pointer', fontSize:13, color:'var(--text)',
                      display:'flex', alignItems:'center', gap:10,
                      borderBottom: i < suggestions.length-1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--bg-card2)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      width="14" height="14" style={{ color:'var(--text-dim)', flexShrink:0 }}>
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => doSearch()} disabled={loading || !query.trim()}
            className="btn btn-primary" style={{ padding:'11px 20px', borderRadius:8 }}>
            {loading ? <span className="spinner"></span> : 'Search'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop:12 }}>{error}</div>}

      {/* Results */}
      {result && status && (
        <div style={{ marginTop:20, animation:'slideIn 0.3s ease' }}>
          {/* Header card */}
          <div style={{ background:`${status.bg}`, border:`2px solid ${status.border}`,
            borderRadius:12, padding:'20px 24px', display:'flex', alignItems:'center',
            justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:56, height:56, borderRadius:12,
                background: status.color, display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:24, fontWeight:900, color:'#000',
                flexShrink:0 }}>
                {status.icon}
              </div>
              <div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:22, fontWeight:900,
                  color:'var(--text)', letterSpacing:'-0.02em' }}>
                  {result.item_number}
                </div>
                <div style={{ fontSize:13, color: status.color, fontWeight:700,
                  fontFamily:'var(--font-mono)', marginTop:2 }}>
                  {status.label}
                  {result.stockRecord && ` — ${result.stockRecord.quantity} units available`}
                </div>
              </div>
            </div>
            {result.stockRecord?.price && (
              <div style={{ textAlign:'right' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-dim)', textTransform:'uppercase' }}>Unit Price</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:24, fontWeight:800, color:'var(--accent)' }}>
                  ₦{result.stockRecord.price.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Stats pills */}
          <div style={{ display:'flex', gap:10, marginTop:14, flexWrap:'wrap' }}>
            <StatPill label="In Stock" value={s.currentQty} color={s.currentQty === 0 ? '#ff4444' : s.currentQty <= s.lowStockThreshold ? '#ff8844' : '#44ff88'} />
            <StatPill label="Total Sold" value={s.totalSold} color="var(--orange)" />
            <StatPill label="Returned" value={s.totalReturned} color="var(--blue)" />
            <StatPill label="Debtors" value={s.unpaidDebtorCount} color={s.unpaidDebtorCount > 0 ? '#ff4444' : 'var(--text-muted)'} />
            <StatPill label="Revenue (₦)" value={`₦${s.totalRevenue.toLocaleString()}`} color="var(--green)" />
            {s.totalDebt > 0 && <StatPill label="Outstanding (₦)" value={`₦${s.totalDebt.toLocaleString()}`} color="#ff4444" />}
          </div>

          {/* Stock status bar */}
          {result.stockRecord && (
            <div style={{ marginTop:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11,
                fontFamily:'var(--font-mono)', color:'var(--text-dim)', marginBottom:6 }}>
                <span>Stock level</span>
                <span>{s.currentQty} / {Math.max(s.currentQty, s.totalSold + s.currentQty)} units</span>
              </div>
              <div style={{ height:8, background:'var(--bg-card2)', borderRadius:4, overflow:'hidden' }}>
                {(() => {
                  const max = s.currentQty + s.totalSold || 1;
                  const pct = Math.min(100, (s.currentQty / max) * 100);
                  const barColor = s.currentQty === 0 ? '#ff4444' : s.currentQty <= s.lowStockThreshold ? '#ff8844' : '#44ff88';
                  return <div style={{ height:'100%', width:`${pct}%`, background: barColor,
                    borderRadius:4, transition:'width 0.6s ease' }} />;
                })()}
              </div>
              <div style={{ fontSize:10, color:'var(--text-dim)', fontFamily:'var(--font-mono)', marginTop:4 }}>
                Alert threshold: {s.lowStockThreshold} units
              </div>
            </div>
          )}

          {/* Sales history */}
          <Section title={`Sales History (${result.soldOut.length} records)`} accent="var(--orange)">
            <MiniTable rows={result.soldOut.slice(0, 8)} cols={[
              { key:'date', label:'Date', mono:true, color:()=>'var(--text-dim)' },
              { key:'quantity', label:'Qty', mono:true, color:()=>'var(--orange)' },
              { key:'price', label:'Price', mono:true, render: r => `₦${r.price.toLocaleString()}` },
              { key:'customer_info', label:'Customer', color:()=>'var(--text-muted)' },
              { key:'worker', label:'By', render: r => r.worker_id?.name || '—', color:()=>'var(--blue)' },
            ]} />
          </Section>

          {/* Debtors */}
          {result.debtors.length > 0 && (
            <Section title={`Credit / Debtors (${result.debtors.length} records)`} accent="var(--red)">
              <MiniTable rows={result.debtors} cols={[
                { key:'date', label:'Date', mono:true, color:()=>'var(--text-dim)' },
                { key:'customer_info', label:'Customer', color:()=>'var(--text)', render: r => <strong>{r.customer_info}</strong> },
                { key:'quantity', label:'Qty', mono:true },
                { key:'price', label:'Owed', mono:true, render: r => `₦${r.price.toLocaleString()}`,
                  color: r => r.paid ? 'var(--green)' : 'var(--red)' },
                { key:'paid', label:'Status', render: r => (
                  <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontFamily:'var(--font-mono)',
                    fontWeight:700, background: r.paid ? 'rgba(68,255,136,0.15)' : 'rgba(255,68,68,0.15)',
                    color: r.paid ? 'var(--green)' : 'var(--red)' }}>
                    {r.paid ? '✓ Paid' : 'Owes'}
                  </span>
                )},
              ]} />
            </Section>
          )}

          {/* Returns */}
          {result.returned.length > 0 && (
            <Section title={`Return History (${result.returned.length} records)`} accent="var(--blue)">
              <MiniTable rows={result.returned} cols={[
                { key:'date', label:'Date', mono:true, color:()=>'var(--text-dim)' },
                { key:'quantity', label:'Qty Returned', mono:true, color:()=>'var(--blue)' },
                { key:'customer_info', label:'Returned By', color:()=>'var(--text-muted)' },
                { key:'worker', label:'Processed By', render: r => r.worker_id?.name || '—', color:()=>'var(--blue)' },
              ]} />
            </Section>
          )}

          {/* No debtors no returns message */}
          {result.debtors.length === 0 && result.returned.length === 0 && (
            <div style={{ marginTop:14, padding:'14px 16px', background:'var(--bg-card2)',
              borderRadius:8, border:'1px solid var(--border)', fontSize:12,
              color:'var(--text-dim)', fontFamily:'var(--font-mono)' }}>
              ✓ No credit sales or returns recorded for this item
            </div>
          )}
        </div>
      )}
    </div>
  );
}
