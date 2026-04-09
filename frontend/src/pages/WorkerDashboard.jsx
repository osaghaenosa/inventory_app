import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import ActivityLog from '../components/ActivityLog.jsx';
import AllTables from '../components/AllTables.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';

const WORKER_TABS = [
  { id: 'inventory', label: 'Inventory', icon: 'inventory' },
  { id: 'activity',  label: 'My Activity', icon: 'activity' }
];

function WorkerStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    Promise.all([
      api.get('/tables/instock'),
      api.get('/tables/soldout'),
      api.get('/tables/debtors'),
    ]).then(([stock, sold, debtors]) => {
      const totalStock = stock.data.reduce((s, r) => s + r.quantity, 0);
      const totalSold  = sold.data.reduce((s, r) => s + r.quantity, 0);
      const totalDebt  = debtors.data.filter(d => !d.paid).reduce((s, r) => s + r.price, 0);
      const lowStock   = stock.data.filter(r => r.quantity <= r.low_stock_threshold).length;
      setStats({ totalStock, totalSold, totalDebt, lowStock });
    }).catch(() => {});
  }, []);

  if (!stats) return null;
  return (
    <div className="stats-grid" style={{ marginBottom: 24 }}>
      <div className="stat-card"><div className="stat-label">Total Stock Units</div><div className="stat-value accent">{stats.totalStock}</div></div>
      <div className="stat-card"><div className="stat-label">Units Sold</div><div className="stat-value">{stats.totalSold}</div></div>
      <div className="stat-card"><div className="stat-label">Outstanding Debt (₦)</div><div className="stat-value red">₦{stats.totalDebt.toLocaleString()}</div></div>
      <div className="stat-card" style={{ borderColor: stats.lowStock > 0 ? 'var(--red)' : 'var(--border)' }}>
        <div className="stat-label">Low Stock Items</div><div className="stat-value red">{stats.lowStock}</div>
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
              <p className="page-subtitle">Welcome, {user?.name}. Manage your stock, sales, debtors and returns below.</p>
            </div>
            <WorkerStats />
            <AllTables />
          </div>
        )}
        {activeTab === 'activity' && <ActivityLog isAdmin={false} />}
      </main>
    </div>
  );
}
