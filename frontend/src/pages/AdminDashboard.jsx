import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar.jsx';
import ActivityLog from '../components/ActivityLog.jsx';
import WorkerManagement from '../components/WorkerManagement.jsx';
import AIAnalysis from '../components/AIAnalysis.jsx';
import AdminStats from '../components/AdminStats.jsx';
import AllTables from '../components/AllTables.jsx';
import {
  isIOS,
  isStandalone,
  requestNotificationPermission,
  showNotification,
} from '../utils/notificationHelper.js';

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard',  icon: 'dashboard' },
  { id: 'inventory', label: 'Inventory',  icon: 'inventory' },
  { id: 'workers',   label: 'Workers',    icon: 'workers' },
  { id: 'activity',  label: 'Activity Log', icon: 'activity' },
  { id: 'ai',        label: 'AI Analysis', icon: 'ai' }
];

// type → ring colour
const TYPE_COLOR = {
  critical: '#ef4444',
  warning:  '#f59e0b',
  info:     '#6366f1',
};
const TYPE_BG = {
  critical: 'rgba(239,68,68,0.12)',
  warning:  'rgba(245,158,11,0.12)',
  info:     'rgba(99,102,241,0.12)',
};

// ── Notification Bell Button ──────────────────────────────────────────────────
function NotificationBell({ count, onClick }) {
  return (
    <button
      id="notif-bell"
      onClick={onClick}
      style={{
        position: 'fixed',
        top: 18,
        right: 20,
        zIndex: 1000,
        background: 'var(--card-bg, #1a1a2e)',
        border: '1px solid var(--border-light, rgba(255,255,255,0.12))',
        borderRadius: '50%',
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
        transition: 'transform 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      title="Notifications"
    >
      <span style={{ fontSize: 20 }}>🔔</span>
      {count > 0 && (
        <span style={{
          position: 'absolute',
          top: 4,
          right: 4,
          background: '#ef4444',
          color: '#fff',
          borderRadius: '50%',
          width: 17,
          height: 17,
          fontSize: 10,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--card-bg, #1a1a2e)',
        }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

// ── Notification Panel (drawer) ───────────────────────────────────────────────
function NotificationPanel({ notifications, onClose, onClear }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(2px)',
        }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100dvh',
        width: 'min(380px, 95vw)',
        zIndex: 1002,
        background: 'var(--sidebar-bg, #11111f)',
        borderLeft: '1px solid var(--border-light, rgba(255,255,255,0.1))',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        animation: 'slideInRight 0.22s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border-light, rgba(255,255,255,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🔔</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text, #fff)' }}>Notifications</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim, rgba(255,255,255,0.45))' }}>
                {notifications.length === 0 ? 'All caught up!' : `${notifications.length} alert${notifications.length > 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {notifications.length > 0 && (
              <button
                onClick={onClear}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-dim, rgba(255,255,255,0.5))',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim, rgba(255,255,255,0.5))', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim, rgba(255,255,255,0.3))' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>No notifications yet</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Activity will appear here as workers make changes.</div>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                style={{
                  background: TYPE_BG[n.type] || TYPE_BG.info,
                  border: `1px solid ${TYPE_COLOR[n.type] || TYPE_COLOR.info}33`,
                  borderLeft: `3px solid ${TYPE_COLOR[n.type] || TYPE_COLOR.info}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: 13,
                    color: TYPE_COLOR[n.type] || TYPE_COLOR.info,
                  }}>
                    {n.title}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: 'var(--text-dim, rgba(255,255,255,0.35))',
                    whiteSpace: 'nowrap',
                    marginTop: 2,
                  }}>
                    {n.time}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text, rgba(255,255,255,0.85))', lineHeight: 1.55 }}>
                  {n.message}
                </div>
                {n.priority === 'high' && (
                  <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>
                    🚨 Requires attention
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ── Toast pop-up (top-right, auto-dismiss) ────────────────────────────────────
function ToastNotif({ notif, onDismiss }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 74,
        right: 20,
        zIndex: 999,
        maxWidth: 320,
        width: '90vw',
        background: 'var(--card-bg, #1a1a2e)',
        border: `1px solid ${TYPE_COLOR[notif.type] || TYPE_COLOR.info}55`,
        borderLeft: `4px solid ${TYPE_COLOR[notif.type] || TYPE_COLOR.info}`,
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
        animation: 'fadeSlideIn 0.25s ease',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 12.5, color: TYPE_COLOR[notif.type] || TYPE_COLOR.info, marginBottom: 3 }}>
          {notif.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text, rgba(255,255,255,0.85))', lineHeight: 1.5 }}>
          {notif.message}
        </div>
      </div>
      <button
        onClick={() => onDismiss(notif.id)}
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Main AdminDashboard ───────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [allNotifications, setAllNotifications] = useState([]); // persistent list
  const [toasts, setToasts] = useState([]);                      // auto-dismiss toasts
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const socketRef = useRef(null);

  // Permission + iOS detection
  useEffect(() => {
    const init = async () => {
      if (isIOS() && !isStandalone()) {
        setShowIosBanner(true);
      } else {
        await requestNotificationPermission();
      }
    };
    init();
  }, []);

  const addNotification = (notif) => {
    setAllNotifications(prev => [notif, ...prev].slice(0, 50));
    setToasts(prev => [notif, ...prev].slice(0, 3));
    setUnreadCount(prev => prev + 1);
    setRefreshSignal(s => s + 1);
    showNotification(notif.title, notif.message);
    // Auto-remove toast after 6s
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== notif.id)), 6000);
  };

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const openPanel = () => {
    setPanelOpen(true);
    setUnreadCount(0);
  };

  // Socket
  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join-admin'));

    socket.on('inventory-update', (data) => {
      // Simple inventory-update fallback (shouldn't be needed now)
      const notif = {
        id: Date.now() + Math.random(),
        message: data.message,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        type: 'info',
        title: '📦 Inventory Update',
      };
      addNotification(notif);
    });

    socket.on('ai-notification', (data) => {
      const notif = {
        id: Date.now() + Math.random(),
        message: data.message,
        title: data.title,
        type: data.type || 'info',
        priority: data.priority || 'low',
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      };
      addNotification(notif);
    });

    return () => socket.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} adminTabs={ADMIN_TABS} workerTabs={[]} />

      {/* Notification bell (fixed, top-right) */}
      <NotificationBell count={unreadCount} onClick={openPanel} />

      {/* Toast pop-ups */}
      {toasts.length > 0 && (
        <ToastNotif notif={toasts[0]} onDismiss={dismissToast} />
      )}

      {/* Notification drawer */}
      {panelOpen && (
        <NotificationPanel
          notifications={allNotifications}
          onClose={() => setPanelOpen(false)}
          onClear={() => { setAllNotifications([]); setUnreadCount(0); }}
        />
      )}

      <main className="main-content">
        {/* iOS install banner */}
        {showIosBanner && (
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          }}>
            <span style={{ fontSize: 28 }}>📲</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: 2, fontSize: 14 }}>
                Enable Push Notifications on iPhone
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                Tap the <strong style={{ color: '#fff' }}>Share</strong> button in Safari, then
                <strong style={{ color: '#fff' }}> Add to Home Screen</strong> to receive live alerts.
              </div>
            </div>
            <button onClick={() => setShowIosBanner(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Admin Dashboard</h1>
              <p className="page-subtitle">Live overview of all inventory activity</p>
            </div>
            <AdminStats refreshSignal={refreshSignal} />
          </div>
        )}
        {activeTab === 'inventory' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">All Inventory</h1>
              <p className="page-subtitle">View and manage all tables across all workers</p>
            </div>
            <AllTables refreshSignal={refreshSignal} />
          </div>
        )}
        {activeTab === 'workers'  && <WorkerManagement />}
        {activeTab === 'activity' && <ActivityLog isAdmin={true} />}
        {activeTab === 'ai'       && <AIAnalysis />}
      </main>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { transform: translateY(-10px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}
