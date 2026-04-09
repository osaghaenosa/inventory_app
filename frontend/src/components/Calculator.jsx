import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';

function formatN(n) {
  if (n == null) return '—';
  return `₦${Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0 })}`;
}

const PRESETS = [
  { label: 'Today',      id: 'today' },
  { label: 'This Week',  id: 'week' },
  { label: 'This Month', id: 'month' },
  { label: 'This Year',  id: 'year' },
  { label: 'Custom',     id: 'custom' },
];

function getRange(id) {
  const now = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const today = fmt(now);
  switch(id) {
    case 'today': return { from: today, to: today };
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      return { from: fmt(d), to: today };
    }
    case 'month': return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'year':  return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: today };
    default: return { from: today, to: today };
  }
}

function ResultBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{label}</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>{formatN(value)}</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-card2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.7s ease' }} />
      </div>
    </div>
  );
}

export default function Calculator({ onClose }) {
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const calculate = useCallback(async (f, t) => {
    if (!f || !t) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await api.post('/tables/calculate', { from: f, to: t });
      setResult(res.data);
    } catch(e) {
      setError(e.response?.data?.message || 'Calculation failed');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (preset !== 'custom') {
      const range = getRange(preset);
      setFrom(range.from); setTo(range.to);
      calculate(range.from, range.to);
    }
  }, [preset, calculate]);

  const handleCustomCalc = () => { if (from && to) calculate(from, to); };

  const maxVal = result ? Math.max(result.totalSalesRevenue, result.totalStockValue, result.totalDebtValue, 1) : 1;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      backdropFilter: 'blur(6px)', animation: 'fadeIn 0.2s ease' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)',
        borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-card2)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
              color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              ✦ Value Calculator
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              Calculate total inventory values by date range
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)',
            cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Preset pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => setPreset(p.id)}
                style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, border: '1px solid',
                  transition: 'all 0.15s',
                  background: preset === p.id ? 'var(--accent)' : 'transparent',
                  color: preset === p.id ? '#000' : 'var(--text-muted)',
                  borderColor: preset === p.id ? 'var(--accent)' : 'var(--border-light)' }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          {preset === 'custom' && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 5 }}>From</div>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="form-input" style={{ width: '100%' }} />
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 5 }}>To</div>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="form-input" style={{ width: '100%' }} />
              </div>
              <button onClick={handleCustomCalc} disabled={!from || !to || loading}
                className="btn btn-primary" style={{ padding: '10px 18px', whiteSpace: 'nowrap' }}>
                {loading ? <span className="spinner"></span> : 'Calculate'}
              </button>
            </div>
          )}

          {/* Date range display */}
          {from && to && preset !== 'custom' && (
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
              marginBottom: 16, padding: '7px 12px', background: 'var(--bg-card2)',
              borderRadius: 6, border: '1px solid var(--border)' }}>
              📅 {from} → {to}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <span className="spinner"></span>
              <p style={{ color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 12 }}>
                Calculating...
              </p>
            </div>
          )}

          {error && <div className="alert alert-error">{error}</div>}

          {result && !loading && (
            <div style={{ animation: 'slideIn 0.3s ease' }}>
              {/* Big total */}
              <div style={{ background: 'var(--accent-dim)', border: '1px solid rgba(232,255,71,0.25)',
                borderRadius: 12, padding: '20px 24px', marginBottom: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'var(--text-dim)', marginBottom: 6 }}>Net Revenue</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 900,
                  color: 'var(--accent)', letterSpacing: '-0.02em' }}>
                  {formatN(result.netRevenue)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                  {result.transactionCount} transactions in period
                </div>
              </div>

              {/* Value bars */}
              <ResultBar label="Total Sales Revenue" value={result.totalSalesRevenue} max={maxVal} color="var(--green)" />
              <ResultBar label="Current Stock Value" value={result.totalStockValue}   max={maxVal} color="var(--accent)" />
              <ResultBar label="Outstanding Debts"   value={result.totalDebtValue}    max={maxVal} color="var(--red)" />
              <ResultBar label="Paid Debts Collected" value={result.paidDebtors}      max={maxVal} color="var(--blue)" />

              {/* Quick stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6, marginBottom: 20 }}>
                {[
                  { label: 'Units Sold',     value: result.totalSalesQty,  color: 'var(--orange)' },
                  { label: 'Units Returned', value: result.totalReturnedQty, color: 'var(--blue)' },
                  { label: 'Stock Units',    value: result.totalStockQty,   color: 'var(--accent)' },
                  { label: 'Debt Records',   value: result.totalDebtQty,    color: 'var(--red)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg-card2)', borderRadius: 8,
                    padding: '12px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase',
                      letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Top items breakdown */}
              {result.itemBreakdown.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)',
                    marginBottom: 10 }}>Top Items by Revenue</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.itemBreakdown.map((item, i) => {
                      const maxRev = result.itemBreakdown[0]?.revenue || 1;
                      const pct = (item.revenue / maxRev) * 100;
                      return (
                        <div key={item.item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                            color: 'var(--text-dim)', width: 18, textAlign: 'right', flexShrink: 0 }}>#{i+1}</div>
                          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500,
                            width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap' }}>{item.item}</div>
                          <div style={{ flex: 1, height: 6, background: 'var(--bg-card2)', borderRadius: 3 }}>
                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3,
                              background: `hsl(${80 - i*8}, 90%, 60%)`, transition: 'width 0.6s ease' }} />
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11,
                            color: 'var(--accent)', fontWeight: 700, flexShrink: 0, width: 80,
                            textAlign: 'right' }}>{formatN(item.revenue)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
