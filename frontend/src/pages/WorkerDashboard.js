import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import InventoryTable from '../components/InventoryTable';
import ActivityLog from '../components/ActivityLog';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const WORKER_TABS = [
  { id: 'inventory', label: 'My Inventory', icon: 'inventory' },
  { id: 'activity', label: 'My Activity', icon: 'activity' }
];

function WorkerStats({ user }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    api.get('/inventory', { params: { date: today } }).then(res => {
      const recs = res.data;
      setStats({
        todayRecords: recs.length,
        totalSold: recs.reduce((s, r) => s + r.sold_stock, 0),
        totalAdded: recs.reduce((s, r) => s + r.added_stock, 0),
        date: today
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="stats-grid" style={{ marginBottom: 24 }}>
      <div className="stat-card">
        <div className="stat-label">Today's Records</div>
        <div className="stat-value accent">{stats?.todayRecords ?? '—'}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Units Sold Today</div>
        <div className="stat-value">{stats?.totalSold ?? '—'}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Stock Added Today</div>
        <div className="stat-value green">{stats?.totalAdded ?? '—'}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Today's Date</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginTop: 8 }}>
          {stats?.date ?? new Date().toISOString().split('T')[0]}
        </div>
      </div>
    </div>
  );
}

export default function WorkerDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inventory');

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} adminTabs={[]} workerTabs={WORKER_TABS} />

      <main className="main-content">
        {activeTab === 'inventory' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">My Inventory</h1>
              <p className="page-subtitle">
                Welcome, {user?.name}. You can add and edit records for today only. Previous records are read-only.
              </p>
            </div>
            <WorkerStats user={user} />
            <InventoryTable isAdmin={false} />
          </div>
        )}

        {activeTab === 'activity' && <ActivityLog isAdmin={false} />}
      </main>
    </div>
  );
}
