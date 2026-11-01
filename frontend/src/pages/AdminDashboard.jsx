import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Bell,
  Sparkles,
  Smartphone,
  CheckCircle2,
  AlertOctagon,
  X,
  Mic,
} from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import ActivityLog from '../components/ActivityLog.jsx';
import WorkerManagement from '../components/WorkerManagement.jsx';
import AIAnalysis from '../components/AIAnalysis.jsx';
import AdminStats from '../components/AdminStats.jsx';
import AllTables from '../components/AllTables.jsx';
import VoiceCommandModal from '../components/VoiceCommandModal.jsx';
import {
  isIOS,
  isStandalone,
  requestNotificationPermission,
  showNotification,
  subscribeToPush,
} from '../utils/notificationHelper.js';
import api from '../utils/api.js';

const ADMIN_TABS = [
  { id: 'dashboard', label: 'Dashboard',  icon: 'dashboard' },
  { id: 'inventory', label: 'Inventory',  icon: 'inventory' },
  { id: 'workers',   label: 'Workers',    icon: 'workers' },
  { id: 'activity',  label: 'Activity Log', icon: 'activity' },
  { id: 'ai',        label: 'AI Analysis', icon: 'ai' }
];

// type → colour
const TYPE_COLOR = {
  critical: '#ef4444',
  warning:  '#f59e0b',
  info:     '#2563eb',
};
const TYPE_BG = {
  critical: 'rgba(239,68,68,0.08)',
  warning:  'rgba(245,158,11,0.08)',
  info:     'rgba(37,99,235,0.08)',
};

// ── Notification Bell Button ──────────────────────────────────────────────────
// Renders at a FIXED position that works on both desktop and mobile.
function NotificationBell({ count, onClick }) {
  return (
    <button
      id="notif-bell"
      onClick={onClick}
      style={{
        position: 'fixed',
        top: 'max(14px, env(safe-area-inset-top, 14px))',
        right: 16,
        zIndex: 1010,
        background: 'var(--bg-card, #ffffff)',
        border: '2px solid #000000',
        borderRadius: '50%',
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 14px rgba(0,0,0,0.08)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        flexShrink: 0,
        color: 'var(--accent, #2563eb)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.08)';
        e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 2px 14px rgba(0,0,0,0.08)';
      }}
      title="Notifications"
      aria-label="Open notifications"
    >
      <Bell size={20} color="var(--accent, #2563eb)" />
      {count > 0 && (
        <span style={{
          position: 'absolute',
          top: 3,
          right: 3,
          background: '#ef4444',
          color: '#fff',
          borderRadius: '50%',
          width: 18,
          height: 18,
          fontSize: 10,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--bg-card, #ffffff)',
          pointerEvents: 'none',
        }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

// ── Enable Push Prompt (shown automatically to new users) ─────────────────────
// Appears as a bottom sheet on mobile, a card on desktop.
// Dismissed permanently by clicking "Not now" (stored in localStorage).
function EnablePushPrompt({ onEnable, onDismiss, isIosNotStandalone }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onDismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 1050,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(3px)',
        }}
      />
      {/* Card */}
      <div style={{
        position: 'fixed',
        bottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))', // above mobile bottom nav
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(420px, calc(100vw - 32px))',
        zIndex: 1051,
        background: 'var(--bg-card, #ffffff)',
        border: '2px solid #000000',
        borderRadius: 16,
        padding: '22px 20px 20px',
        boxShadow: '0 8px 36px rgba(0,0,0,0.12)',
        animation: 'slideUpPrompt 0.28s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Icon + heading */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--accent-dim, rgba(37, 99, 235, 0.1))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Bell size={24} color="var(--accent, #2563eb)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text, #0f172a)', marginBottom: 3 }}>
              Stay notified in real-time
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted, #64748b)', lineHeight: 1.5 }}>
              Get instant alerts when workers record sales, add stock, or create debtors.
            </div>
          </div>
        </div>

        {/* iOS-specific instruction */}
        {isIosNotStandalone ? (
          <div style={{
            background: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.18)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            fontSize: 12.5,
            color: 'var(--text, #0f172a)',
            lineHeight: 1.6,
          }}>
            <Smartphone size={16} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--accent, #2563eb)' }} />
            <strong style={{ color: 'var(--accent, #2563eb)' }}>iPhone users:</strong> Tap the{' '}
            <strong style={{ color: 'var(--text, #0f172a)' }}>Share</strong> button in Safari → then{' '}
            <strong style={{ color: 'var(--text, #0f172a)' }}>Add to Home Screen</strong>.
            Open the app from your Home Screen, then enable push notifications.
          </div>
        ) : (
          <div style={{
            background: 'rgba(37,99,235,0.06)',
            border: '1px solid rgba(37,99,235,0.15)',
            borderRadius: 10,
            padding: '9px 13px',
            marginBottom: 14,
            fontSize: 12,
            color: 'var(--text-muted, #64748b)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <CheckCircle2 size={16} color="var(--green, #16a34a)" style={{ flexShrink: 0 }} />
            <span>Works on Android Chrome, Desktop Chrome/Edge, and iPhone (Home Screen PWA)</span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!isIosNotStandalone && (
            <button
              id="enable-push-btn"
              onClick={onEnable}
              style={{
                flex: 1,
                background: 'var(--accent, #2563eb)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 0',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Bell size={16} /> Enable Notifications
            </button>
          )}
          <button
            id="dismiss-push-btn"
            onClick={onDismiss}
            style={{
              flex: isIosNotStandalone ? 1 : 0,
              padding: '12px 18px',
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1.5px solid #000000',
              borderRadius: 10,
              color: 'var(--text-muted, #64748b)',
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </>
  );
}

// ── Notification Panel (slide-in drawer) ──────────────────────────────────────
function NotificationPanel({ notifications, onClose, onClear, permStatus, onRequestPerm }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1020,
          background: 'rgba(15, 23, 42, 0.3)',
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
        zIndex: 1021,
        background: 'var(--bg-card, #ffffff)',
        borderLeft: '2px solid #000000',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
        animation: 'slideInRight 0.22s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '2px solid #000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bell size={20} color="var(--accent, #2563eb)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text, #0f172a)' }}>Notifications</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>
                {notifications.length === 0 ? 'All caught up!' : `${notifications.length} alert${notifications.length > 1 ? 's' : ''}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {permStatus !== 'granted' && permStatus !== 'denied' && (
              <button
                onClick={onRequestPerm}
                style={{
                  background: 'var(--accent, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 11px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Enable Push
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={onClear}
                style={{
                  background: 'var(--bg-subtle, #f8fafc)',
                  border: '1.5px solid #000000',
                  color: 'var(--text-muted, #64748b)',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Clear all
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim, #94a3b8)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Sparkles size={36} color="var(--accent, #2563eb)" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text, #0f172a)' }}>No notifications yet</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Activity will appear here as workers make changes.</div>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                style={{
                  background: TYPE_BG[n.type] || TYPE_BG.info,
                  border: `1px solid ${TYPE_COLOR[n.type] || TYPE_COLOR.info}25`,
                  borderLeft: `3px solid ${TYPE_COLOR[n.type] || TYPE_COLOR.info}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: TYPE_COLOR[n.type] || TYPE_COLOR.info }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim, #94a3b8)', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {n.time}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text, #0f172a)', lineHeight: 1.55 }}>
                  {n.message}
                </div>
                {n.priority === 'high' && (
                  <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertOctagon size={12} />
                    <span>Requires attention</span>
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
    <div style={{
      position: 'fixed',
      // On mobile sit below the bell (bell is at ~14px + 44px = ~60px)
      top: 'max(70px, calc(env(safe-area-inset-top, 0px) + 70px))',
      right: 16,
      zIndex: 1015,
      maxWidth: 320,
      width: 'calc(100vw - 32px)',
      background: 'var(--bg-card, #ffffff)',
      border: `1px solid ${TYPE_COLOR[notif.type] || TYPE_COLOR.info}33`,
      borderLeft: `4px solid ${TYPE_COLOR[notif.type] || TYPE_COLOR.info}`,
      borderRadius: 10,
      padding: '12px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      animation: 'fadeSlideIn 0.25s ease',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 12.5, color: TYPE_COLOR[notif.type] || TYPE_COLOR.info, marginBottom: 3 }}>
          {notif.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text, #0f172a)', lineHeight: 1.5 }}>
          {notif.message}
        </div>
      </div>
      <button
        onClick={() => onDismiss(notif.id)}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted, #64748b)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        aria-label="Close"
      >
        <X size={15} />
      </button>
    </div>
  );
}

// ── Main AdminDashboard ───────────────────────────────────────────────────────
const PUSH_DISMISSED_KEY = 'push_prompt_dismissed';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [allNotifications, setAllNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [permStatus, setPermStatus] = useState('default');
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [showVoiceAI, setShowVoiceAI] = useState(false);
  const socketRef = useRef(null);

  // ── On mount: check permission state and decide whether to show the prompt ──
  useEffect(() => {
    if (!('Notification' in window)) return;

    const perm = Notification.permission;
    setPermStatus(perm);

    if (perm === 'granted') {
      // Already granted — re-register silently to refresh any stale DB endpoint
      subscribeToPush(api).catch(console.error);
      return;
    }

    if (perm === 'denied') return; // Nothing we can do — OS blocked it

    // Permission is 'default' (never asked) — show prompt unless user dismissed it before
    const dismissed = localStorage.getItem(PUSH_DISMISSED_KEY);
    if (!dismissed) {
      // Small delay so the UI settles before showing the prompt
      const t = setTimeout(() => setShowPushPrompt(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  // Enable push: request permission → subscribe → hide prompt
  const handleEnablePush = async () => {
    setShowPushPrompt(false);
    const status = await requestNotificationPermission();
    setPermStatus(status);
    if (status === 'granted') {
      const sub = await subscribeToPush(api);
      if (!sub) {
        console.warn('[Push] Subscription failed after permission granted.');
      }
    } else if (status === 'denied') {
      // Save so we don't keep pestering them
      localStorage.setItem(PUSH_DISMISSED_KEY, '1');
    }
  };

  // Dismiss prompt — save to localStorage so it doesn't re-appear on reload
  const handleDismissPrompt = () => {
    setShowPushPrompt(false);
    localStorage.setItem(PUSH_DISMISSED_KEY, '1');
  };

  // "Enable Push" button inside the notification panel (for users who dismissed the prompt)
  const handlePanelEnablePush = async () => {
    const status = await requestNotificationPermission();
    setPermStatus(status);
    if (status === 'granted') {
      // Clear dismissal so if they re-open they see granted state
      localStorage.removeItem(PUSH_DISMISSED_KEY);
      await subscribeToPush(api);
    } else if (status === 'denied') {
      alert('Push notifications are blocked. Please enable them in your browser/OS settings and reload the page.');
    }
  };

  const addNotification = (notif) => {
    setAllNotifications(prev => [notif, ...prev].slice(0, 50));
    setToasts(prev => [notif, ...prev].slice(0, 3));
    setUnreadCount(prev => prev + 1);
    setRefreshSignal(s => s + 1);
    showNotification(notif.title, notif.message);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== notif.id)), 6000);
  };

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const openPanel = () => {
    setPanelOpen(true);
    setUnreadCount(0);
  };

  // ── Socket ──
  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join-admin'));

    socket.on('inventory-update', (data) => {
      addNotification({
        id: Date.now() + Math.random(),
        message: data.message,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        type: 'info',
        title: 'Inventory Update',
      });
    });

    socket.on('ai-notification', (data) => {
      addNotification({
        id: Date.now() + Math.random(),
        message: data.message,
        title: data.title,
        type: data.type || 'info',
        priority: data.priority || 'low',
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      });
    });

    return () => socket.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect iOS + not standalone (for the prompt messaging)
  const iosNotStandalone = isIOS() && !isStandalone();

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} adminTabs={ADMIN_TABS} workerTabs={[]} />

      {/* ── Top-right "Use AI" button & Notification bell ── */}
      <div style={{
        position: 'fixed',
        top: 'max(14px, env(safe-area-inset-top, 14px))',
        right: 68,
        zIndex: 1010,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <button
          id="admin-use-ai-btn"
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

      {/* ── Notification bell — always visible, above everything ── */}
      <NotificationBell count={unreadCount} onClick={openPanel} />

      {/* ── Auto-prompt for new users (permission === 'default' and not dismissed) ── */}
      {showPushPrompt && (
        <EnablePushPrompt
          onEnable={handleEnablePush}
          onDismiss={handleDismissPrompt}
          isIosNotStandalone={iosNotStandalone}
        />
      )}

      {/* ── Toast pop-ups ── */}
      {toasts.length > 0 && (
        <ToastNotif notif={toasts[0]} onDismiss={dismissToast} />
      )}

      {/* ── Notification drawer ── */}
      {panelOpen && (
        <NotificationPanel
          notifications={allNotifications}
          onClose={() => setPanelOpen(false)}
          onClear={() => { setAllNotifications([]); setUnreadCount(0); }}
          permStatus={permStatus}
          onRequestPerm={handlePanelEnablePush}
        />
      )}

      {/* ── Voice AI Command Modal ── */}
      <VoiceCommandModal
        isOpen={showVoiceAI}
        onClose={() => setShowVoiceAI(false)}
        onActionExecuted={() => setRefreshSignal(s => s + 1)}
      />

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 className="page-title">Admin Dashboard</h1>
                <p className="page-subtitle">Live overview of all inventory activity</p>
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
        @keyframes slideUpPrompt {
          from { transform: translateX(-50%) translateY(40px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
