import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';

export default function ActivityLog({ isAdmin = false }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/activity')
      .then(res => setLogs(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getActionColor = (action) => {
    if (action.includes('Added')) return 'var(--green)';
    if (action.includes('Updated')) return 'var(--blue)';
    if (action.includes('Deleted')) return 'var(--red)';
    return 'var(--text-muted)';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Activity Log</h1>
        <p className="page-subtitle">{isAdmin ? 'All worker activity across the system' : 'Your personal activity history'}</p>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              {isAdmin && <th>Worker</th>}
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isAdmin ? 4 : 3} className="empty-state"><span className="spinner"></span></td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={isAdmin ? 4 : 3} className="empty-state"><p>No activity yet</p></td></tr>
            ) : logs.map(log => (
              <tr key={log._id}>
                <td className="mono" style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {formatTime(log.timestamp)}
                </td>
                {isAdmin && (
                  <td style={{ color: 'var(--blue)', fontSize: 12 }}>
                    {log.user_id?.name || '—'}
                  </td>
                )}
                <td style={{ color: getActionColor(log.action), fontWeight: 500 }}>
                  {log.action}
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {log.new_value?.product_name && (
                    <span>
                      Opening: {log.new_value.opening_stock} | Added: {log.new_value.added_stock} | Sold: {log.new_value.sold_stock} | Remaining: {log.new_value.remaining_stock}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
