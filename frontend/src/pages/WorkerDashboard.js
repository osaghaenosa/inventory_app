import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import ActivityLog from '../components/ActivityLog.jsx';
import AllTables from '../components/AllTables.jsx';
import VoiceCommandModal from '../components/VoiceCommandModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../utils/api.js';

const WORKER_TABS = [
  { id: 'inventory', label: 'Inventory', icon: 'inventory' },
  { id: 'activity',  label: 'My Activity', icon: 'activity' }
];

function WorkerStats({ refreshSignal }) {
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
  }, [refreshSignal]);

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
  const [showVoiceAI, setShowVoiceAI] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} adminTabs={[]} workerTabs={WORKER_TABS} />

      {/* ── Top-right "Use AI" floating button for mobile/quick access ── */}
      <div style={{
        position: 'fixed',
        top: 'max(14px, env(safe-area-inset-top, 14px))',
        right: 16,
        zIndex: 1010,
      }}>
        <button
          id="worker-use-ai-btn"
          onClick={() => setShowVoiceAI(true)}
          style={{
            height: 44,
            padding: '0 16px',
            borderRadius: 22,
            background: 'linear-gradient(135deg, var(--accent, #2563eb) 0%, #1d4ed8 100%)',
            color: '#ffffff',
            border: 'none',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            boxShadow: '0 2px 14px rgba(37, 99, 235, 0.35)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.04)';
            e.currentTarget.style.boxShadow = '0 4px 18px rgba(37, 99, 235, 0.45)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 14px rgba(37, 99, 235, 0.35)';
          }}
          title="Open Voice AI Assistant"
        >
          <Sparkles size={16} />
          <span>Use AI</span>
        </button>
      </div>

      {/* ── Voice AI Command Modal ── */}
      <VoiceCommandModal
        isOpen={showVoiceAI}
        onClose={() => setShowVoiceAI(false)}
        onActionExecuted={() => setRefreshSignal(s => s + 1)}
      />

      <main className="main-content">
        {activeTab === 'inventory' && (
          <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 className="page-title">My Inventory</h1>
                <p className="page-subtitle">Welcome, {user?.name}. Manage your stock, sales, debtors and returns below.</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowVoiceAI(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, var(--accent, #2563eb) 0%, #1d4ed8 100%)',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
                }}
              >
                <Sparkles size={16} />
                <span>Use AI</span>
              </button>
            </div>
            <WorkerStats refreshSignal={refreshSignal} />
            <AllTables refreshSignal={refreshSignal} />
          </div>
        )}
        {activeTab === 'activity' && <ActivityLog isAdmin={false} />}
      </main>
    </div>
  );
}
