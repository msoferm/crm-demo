import React, { useState } from 'react';
import { AppProvider, useApp } from './contexts/AppContext.jsx';
import Dashboard from './components/Dashboard.jsx';
import Equipment from './components/Equipment/Equipment.jsx';
import Clients from './components/Clients/Clients.jsx';
import Orders from './components/Orders/Orders.jsx';
import Finance from './components/Finance/Finance.jsx';
import Settings from './components/Settings.jsx';

const TABS = [
  { id: 'dashboard', label: '🏠 דשבורד' },
  { id: 'equipment', label: '📦 ציוד' },
  { id: 'clients',   label: '👤 לקוחות' },
  { id: 'orders',    label: '📋 הזמנות' },
  { id: 'finance',   label: '💳 כספים' },
  { id: 'settings',  label: '⚙️ הגדרות' },
];

function Layout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { state } = useApp();

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">📦</span>
          <span className="logo-text">CRM ציוד</span>
        </div>
        <ul className="nav-list">
          {TABS.map(tab => (
            <li key={tab.id}>
              <button
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="main-content">
        {state.toast && (
          <div className={`toast toast-${state.toast.type}`}>
            {state.toast.message}
          </div>
        )}
        {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
        {activeTab === 'equipment' && <Equipment />}
        {activeTab === 'clients'   && <Clients />}
        {activeTab === 'orders'    && <Orders />}
        {activeTab === 'finance'   && <Finance />}
        {activeTab === 'settings'  && <Settings />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  );
}
