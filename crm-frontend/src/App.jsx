import React, { useState, useEffect } from 'react';
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { state } = useApp();

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const activeTabLabel = TABS.find(t => t.id === activeTab)?.label || '';

  const handleSelectTab = (id) => {
    setActiveTab(id);
    setDrawerOpen(false);
  };

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <button
          className="hamburger"
          aria-label="פתיחת תפריט"
          onClick={() => setDrawerOpen(true)}
        >
          <span /><span /><span />
        </button>
        <div className="mobile-topbar-title">{activeTabLabel}</div>
        <div className="mobile-topbar-spacer" />
      </header>

      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}

      <nav className={`sidebar ${drawerOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <span className="logo-icon">📦</span>
          <span className="logo-text">CRM ציוד</span>
          <button
            className="drawer-close"
            aria-label="סגירת תפריט"
            onClick={() => setDrawerOpen(false)}
          >
            ✕
          </button>
        </div>
        <ul className="nav-list">
          {TABS.map(tab => (
            <li key={tab.id}>
              <button
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleSelectTab(tab.id)}
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
