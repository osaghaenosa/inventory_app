import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api.js';

function renderAnalysis(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^## (.*)/gm, '<span style="color:var(--accent);font-family:var(--font-mono);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-top:12px;margin-bottom:4px;">$1</span>')
    .replace(/^### (.*)/gm, '<span style="color:var(--text);font-weight:600;display:block;margin-top:8px;">$1</span>')
    .replace(/^- /gm, '• ');
}

export default function AdminStats({ refreshSignal }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState('');
  const today = new Date().toISOString().split('T')[0];

  const fetchStats = useCallback(() => {
    Promise.all([
      api.get('/tables/instock'),
      api.get('/tables/soldout'),
      api.get('/tables/debtors'),
      api.get('/tables/restocked'),
      api.get('/tables/returned'),
      api.get('/users'),
      api.get('/activity'),
    ]).then(([stock, sold, debtors, restocked, returned, users, activity]) => {
      const totalStock   = stock.data.reduce((s, r) => s + r.quantity, 0);
      const totalSold    = sold.data.reduce((s, r) => s + r.quantity, 0);
      const totalRevenue = sold.data.reduce((s, r) => s + r.price, 0);
      const totalDebt    = debtors.data.filter(d => !d.paid).reduce((s, r) => s + r.price, 0);
      setStats({
        totalStock, totalSold, totalRevenue, totalDebt,
        lowStockCount: restocked.data.length,
        lowStockItems: restocked.data.slice(0, 5),
        returnedCount: returned.data.length,
        totalWorkers: users.data.length,
        recentActivity: activity.data.slice(0, 6),
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [today]);

  useEffect(() => { fetchStats(); }, [fetchStats, refreshSignal]);

  const runAiSummary = async () => {
    setAiLoading(true); setAiSummary('');
    try {
      const res = await api.post('/ai/analyze', { date: today, forceRefresh: false });
      setAiSummary(res.data.analysis); setAiSource(res.data.source);
    } catch { setAiSummary('Failed to generate analysis.'); }
    finally { setAiLoading(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner"></span></div>;
  if (!stats) return null;

  return (
    <div>
      <div className="stats-grid">
        {[
          { label: 'Total Stock Units',   value: stats.totalStock,                      cls: 'accent' },
          { label: 'Total Workers',        value: stats.totalWorkers,                    cls: 'blue' },
          { label: 'Units Sold',           value: stats.totalSold,                       cls: '' },
          { label: 'Total Revenue (₦)',    value: `₦${stats.totalRevenue.toLocaleString()}`, cls: 'green', small: true },
          { label: 'Outstanding Debt (₦)', value: `₦${stats.totalDebt.toLocaleString()}`,   cls: 'red',   small: true },
          { label: 'Low Stock Items',      value: stats.lowStockCount,                   cls: 'red' },
          { label: 'Returns',              value: stats.returnedCount,                   cls: '' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={s.cls === 'red' && s.value > 0 ? { borderColor: 'var(--red)' } : {}}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value${s.cls ? ' ' + s.cls : ''}`}
              style={s.small ? { fontSize: 18, marginTop: 8 } : {}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Low stock warning */}
      {stats.lowStockItems.length > 0 && (
        <div style={{ background:'var(--red-dim)', border:'1px solid rgba(255,68,68,0.25)',
          borderRadius:'var(--radius)', padding:'12px 16px', marginBottom:20 }}>
          <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:'var(--red)',
            textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>⚠ Low Stock Alert</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {stats.lowStockItems.map(r => (
              <span key={r._id} style={{ background:'rgba(255,68,68,0.15)', border:'1px solid rgba(255,68,68,0.3)',
                borderRadius:20, padding:'3px 10px', fontSize:12, color:'var(--red)', fontFamily:'var(--font-mono)' }}>
                {r.item_number}: {r.quantity} left
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        {/* Recent Activity */}
        <div className="card">
          <div className="card-title">Recent Activity</div>
          {stats.recentActivity.length === 0
            ? <p style={{ color:'var(--text-dim)', fontSize:12, fontFamily:'var(--font-mono)' }}>No activity yet</p>
            : stats.recentActivity.map((log, i) => (
              <div key={log._id} style={{ display:'flex', gap:10, alignItems:'flex-start',
                padding:'8px 0', borderBottom: i < stats.recentActivity.length-1 ? '1px solid var(--border)':'none' }}>
                <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, marginTop:5,
                  background: log.action.includes('Added') ? 'var(--green)' : log.action.includes('Updated') ? 'var(--blue)' : 'var(--red)' }} />
                <div>
                  <div style={{ fontSize:12, color:'var(--text)' }}>{log.action}</div>
                  <div style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'var(--font-mono)', marginTop:1 }}>
                    {log.user_id?.name} · {new Date(log.timestamp).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* AI Summary */}
        <div className="card" style={{ borderColor: aiSummary ? 'var(--accent)' : 'var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: aiSummary ? 16 : 0 }}>
            <div>
              <div className="card-title" style={{ marginBottom:2 }}>✦ AI Daily Summary</div>
              <p style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'var(--font-mono)' }}>Today's inventory overview</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={runAiSummary} disabled={aiLoading}>
              {aiLoading ? <><span className="spinner"></span> Analyzing…</> : aiSummary ? '↺ Refresh' : 'Generate'}
            </button>
          </div>
          {aiSummary
            ? <div className="ai-output" style={{ maxHeight:200 }} dangerouslySetInnerHTML={{ __html: renderAnalysis(aiSummary) }} />
            : <div style={{ padding:'20px', background:'var(--bg-card2)', borderRadius:'var(--radius-sm)', textAlign:'center' }}>
                <p style={{ color:'var(--text-dim)', fontSize:12, fontFamily:'var(--font-mono)' }}>Click Generate for AI insights</p>
              </div>
          }
        </div>
      </div>
    </div>
  );
}
