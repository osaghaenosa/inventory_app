import React, { useEffect, useState } from 'react';
import api from '../utils/api';

export default function AdminStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      api.get('/inventory', { params: { date: today } }),
      api.get('/inventory'),
      api.get('/users'),
      api.get('/activity')
    ]).then(([todayRes, allRes, usersRes, activityRes]) => {
      const todayRecs = todayRes.data;
      const allRecs = allRes.data;
      const totalSold = todayRecs.reduce((s, r) => s + r.sold_stock, 0);
      const totalAdded = todayRecs.reduce((s, r) => s + r.added_stock, 0);
      const lowStock = allRecs.filter(r => r.remaining_stock < 50 && r.date === today).length;
      setStats({
        todayRecords: todayRecs.length,
        totalWorkers: usersRes.data.length,
        totalSold,
        totalAdded,
        lowStock,
        recentActivity: activityRes.data.slice(0, 5)
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner"></span></div>;
  if (!stats) return null;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Today's Records</div>
          <div className="stat-value accent">{stats.todayRecords}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Workers</div>
          <div className="stat-value blue">{stats.totalWorkers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Units Sold Today</div>
          <div className="stat-value">{stats.totalSold}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stock Added Today</div>
          <div className="stat-value green">{stats.totalAdded}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Low Stock Items</div>
          <div className="stat-value red">{stats.lowStock}</div>
        </div>
      </div>

      {stats.recentActivity.length > 0 && (
        <div className="card">
          <div className="card-title">Recent Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.recentActivity.map(log => (
              <div key={log._id} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '8px 0', borderBottom: '1px solid var(--border)'
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: log.action.includes('Added') ? 'var(--green)' : log.action.includes('Updated') ? 'var(--blue)' : 'var(--orange)',
                  flexShrink: 0, marginTop: 5
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>{log.action}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {log.user_id?.name} · {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
