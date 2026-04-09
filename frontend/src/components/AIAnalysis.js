import React, { useState } from 'react';
import api from '../utils/api';

function renderAnalysis(text) {
  // Convert markdown-style bold and headers to styled spans
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^## (.*)/gm, '<span style="color:var(--accent);font-family:var(--font-mono);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">$1</span>')
    .replace(/^### (.*)/gm, '<span style="color:var(--text);font-weight:600;">$1</span>')
    .replace(/^- /gm, '• ');
}

export default function AIAnalysis() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    setAnalysis('');
    try {
      const res = await api.post('/ai/analyze', { date });
      setAnalysis(res.data.analysis);
      setSource(res.data.source);
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
        <p className="page-subtitle">AI-powered daily inventory insights and worker performance</p>
      </div>

      <div className="card mb-4">
        <div className="card-title">Generate Report</div>
        <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: '0 0 auto' }}>
            <label className="form-label">Select Date</label>
            <input
              className="form-input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: 180 }}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={runAnalysis}
            disabled={loading}
            style={{ marginTop: 20 }}
          >
            {loading ? (
              <><span className="spinner"></span> Analyzing…</>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                </svg>
                Run Analysis
              </>
            )}
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, fontFamily: 'var(--font-mono)' }}>
          💡 For AI-powered analysis, add ANTHROPIC_API_KEY to backend/.env. Otherwise, a local summary is generated.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {analysis && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="card-title" style={{ marginBottom: 0 }}>Analysis Results — {date}</div>
            {source && (
              <span className="badge" style={{ background: source === 'ai' ? 'var(--accent-dim)' : 'var(--blue-dim)', color: source === 'ai' ? 'var(--accent)' : 'var(--blue)' }}>
                {source === 'ai' ? '✦ AI Powered' : 'Local Summary'}
              </span>
            )}
          </div>
          <div
            className="ai-output"
            dangerouslySetInnerHTML={{ __html: renderAnalysis(analysis) }}
          />
        </div>
      )}

      {!analysis && !loading && (
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
