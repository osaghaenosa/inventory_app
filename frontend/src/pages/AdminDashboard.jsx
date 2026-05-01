import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Sidebar from '../components/Sidebar.jsx';
import ActivityLog from '../components/ActivityLog.jsx';
import WorkerManagement from '../components/WorkerManagement.jsx';
import AIAnalysis from '../components/AIAnalysis.jsx';
import AdminStats from '../components/AdminStats.jsx';
import AllTables from '../components/AllTables.jsx';

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
  const socketRef = useRef(null);

  useEffect(() => {
    // Request Native Notification Permission
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const socket = io('/', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join-admin'));
    socket.on('inventory-update', (data) => {
      const notif = { id: Date.now(), message: data.message, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), type: 'info', title: 'Inventory Update' };
      setNotifications(prev => [notif, ...prev].slice(0, 10));
      setRefreshSignal(s => s + 1);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notif.id)), 6000);
    });
    
    socket.on('ai-notification', (data) => {
      const notif = { 
        id: Date.now() + Math.random(), 
        message: data.message, 
        title: data.title,
        type: data.type, // info, warning, critical
        priority: data.priority,
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) 
      };
      setNotifications(prev => [notif, ...prev].slice(0, 10));
      setRefreshSignal(s => s + 1);
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== notif.id)), 8000);

      // Trigger Native Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title || 'Inventory Notification', {
          body: data.message,
          icon: '/favicon.ico' // You can change this to your actual app icon if available
        });
      }
    });

    return () => socket.disconnect();
  }, []);

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} adminTabs={ADMIN_TABS} workerTabs={[]} />
      <main className="main-content">
        {/* Live notifications */}
        {notifications.length > 0 && (
          <div className="notifications-panel">
            {notifications.map(n => (
              <div key={n.id} className={`notification-item ${n.type || 'info'}`}>
                <div className="notification-content">
                  {n.title && <div className="notification-title">{n.title}</div>}
                  <div className="notification-msg">{n.type === 'critical' ? '🚨' : n.type === 'warning' ? '⚠️' : '🔔'} {n.message}</div>
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
