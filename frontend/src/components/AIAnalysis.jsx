import React, { useState } from 'react';
import api from '../utils/api.js';

function renderAnalysis(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^## (.*)/gm, '<span style="color:var(--accent);font-family:var(--font-mono);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;display:block;margin-top:12px;margin-bottom:4px;">$1</span>')
    .replace(/^### (.*)/gm, '<span style="color:var(--text);font-weight:600;display:block;margin-top:8px;">$1</span>')
    .replace(/^- /gm, '• ');
}

export default function AIAnalysis() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runAnalysis = async (forceRefresh = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/ai/analyze', { date, forceRefresh });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">AI Analysis</h1>
        <p className="page-subtitle">AI-powered daily inventory insights — results are cached for 10 minutes to save quota</p>
      </div>

      <div className="card mb-4">
        <div className="card-title">Generate Report</div>
        <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Select Date</label>
            <input className="form-input" type="date" value={date}
              onChange={e => { setDate(e.target.value); setResult(null); }}
              style={{ width: 180 }} />
          </div>
          <button className="btn btn-primary" onClick={() => runAnalysis(false)}
            disabled={loading} style={{ marginTop: 20 }}>
            {loading ? <><span className="spinner"></span> Analyzing…</> : <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              Run Analysis
            </>}
          </button>
          {result && (
            <button className="btn btn-secondary" onClick={() => runAnalysis(true)}
              disabled={loading} style={{ marginTop: 20 }}>
              ↺ Force Refresh
            </button>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, fontFamily: 'var(--font-mono)' }}>
          💡 Results are cached for 10 min. Use "Force Refresh" only when needed to avoid hitting API quota.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="card-title" style={{ marginBottom: 0 }}>Results — {date}</div>
            <div className="flex gap-2">
              {result.cached && (
                <span className="badge" style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>
                  ⚡ Cached
                </span>
              )}
              {result.stale && (
                <span className="badge" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
                  ⚠ Stale (rate limited)
                </span>
              )}
              <span className="badge" style={{
                background: result.source === 'ai' ? 'var(--accent-dim)' : 'var(--blue-dim)',
                color: result.source === 'ai' ? 'var(--accent)' : 'var(--blue)'
              }}>
                {result.source === 'ai' ? '✦ Gemini AI' : 'Local Summary'}
              </span>
            </div>
          </div>
          <div className="ai-output" dangerouslySetInnerHTML={{ __html: renderAnalysis(result.analysis) }} />
        </div>
      )}

      {!result && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
          <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            Select a date and run analysis to see AI-generated insights
          </p>
        </div>
      )}
    </div>
  );
}
