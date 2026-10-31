import React, { useState } from 'react';
import api from '../utils/api.js';
import { Sparkles, RefreshCw, Lightbulb, Zap, AlertTriangle } from 'lucide-react';

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
              <Sparkles size={14} />
              Run Analysis
            </>}
          </button>
          {result && (
            <button className="btn btn-secondary" onClick={() => runAnalysis(true)}
              disabled={loading} style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={12} /> Force Refresh
            </button>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lightbulb size={13} color="var(--orange)" /> Results are cached for 10 min. Use "Force Refresh" only when needed to avoid hitting API quota.
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
                  <Zap size={11} /> Cached
                </span>
              )}
              {result.stale && (
                <span className="badge" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
                  <AlertTriangle size={11} /> Stale (rate limited)
                </span>
              )}
              <span className="badge" style={{
                background: result.source === 'ai' ? 'var(--accent-dim)' : 'var(--blue-dim)',
                color: result.source === 'ai' ? 'var(--accent)' : 'var(--blue)'
              }}>
                {result.source === 'ai' ? <><Sparkles size={11} /> Gemini AI</> : 'Local Summary'}
              </span>
            </div>
          </div>
          <div className="ai-output" dangerouslySetInnerHTML={{ __html: renderAnalysis(result.analysis) }} />
        </div>
      )}

      {!result && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Sparkles size={36} color="var(--accent)" />
          </div>
          <p style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            Select a date and run analysis to see AI-generated insights
          </p>
        </div>
      )}
    </div>
  );
}
