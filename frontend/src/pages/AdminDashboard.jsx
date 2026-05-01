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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const socketRef = useRef(null);

  // Request notification permission + detect iOS install state
  useEffect(() => {
    const init = async () => {
      const iosDevice = isIOS();
      const standalone = isStandalone();

      if (iosDevice && !standalone) {
        // iOS: user must "Add to Home Screen" before push works
        setShowIosBanner(true);
      } else {
        // Android, Desktop, or iOS already installed as PWA
        const perm = await requestNotificationPermission();
        if (perm !== 'granted') {
          console.warn('[Notifications] Permission not granted:', perm);
        }
      }
    };
    init();
  }, []);

  // Socket.io
  useEffect(() => {
    const socket = io('/', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join-admin'));

    socket.on('inventory-update', (data) => {
      const notif = {
        id: Date.now(),
        message: data.message,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        type: 'info',
        title: 'Inventory Update',
      };
      setNotifications(prev => [notif, ...prev].slice(0, 10));
      setRefreshSignal(s => s + 1);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notif.id)), 6000);
      showNotification('Inventory Update', data.message);
    });

    socket.on('ai-notification', (data) => {
      const notif = {
        id: Date.now() + Math.random(),
        message: data.message,
        title: data.title,
        type: data.type,
        priority: data.priority,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      };
      setNotifications(prev => [notif, ...prev].slice(0, 10));
      setRefreshSignal(s => s + 1);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notif.id)), 8000);
      showNotification(data.title || 'Inventory Notification', data.message);
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} adminTabs={ADMIN_TABS} workerTabs={[]} />
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
                <strong style={{ color: '#fff' }}> Add to Home Screen</strong> to install the app and receive live alerts.
              </div>
            </div>
            <button
              onClick={() => setShowIosBanner(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>
              ✕
            </button>
          </div>
        )}

        {/* Live in-app notifications */}
        {notifications.length > 0 && (
          <div className="notifications-panel">
            {notifications.map(n => (
              <div key={n.id} className={`notification-item ${n.type || 'info'}`}>
                <div className="notification-content">
                  {n.title && <div className="notification-title">{n.title}</div>}
                  <div className="notification-msg">
                    {n.type === 'critical' ? '🚨' : n.type === 'warning' ? '⚠️' : '🔔'} {n.message}
                  </div>
                </div>
                <div className="notification-time">{n.time}</div>
              </div>
            ))}
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

        {activeTab === 'workers'   && <WorkerManagement />}
        {activeTab === 'activity'  && <ActivityLog isAdmin={true} />}
        {activeTab === 'ai'        && <AIAnalysis />}
      </main>
    </div>
  );
}
