import React, { useState } from 'react';
import { useApp } from '../../contexts/AppContext.jsx';
import Revenue from './Revenue.jsx';
import OpenPayments from './OpenPayments.jsx';
import MissingItems from './MissingItems.jsx';
import FixedExpenses from './FixedExpenses.jsx';
import VariableExpenses from './VariableExpenses.jsx';
import AnnualSummary from './AnnualSummary.jsx';

const TABS = [
  { id: 'revenue',          label: '💰 הכנסות' },
  { id: 'open-payments',    label: '⏳ תשלומים פתוחים' },
  { id: 'missing-items',    label: '🔍 מעקב חוסרים' },
  { id: 'fixed-expenses',   label: '🔒 הוצאות קבועות' },
  { id: 'variable-expenses',label: '📊 הוצאות משתנות' },
  { id: 'annual-summary',   label: '📈 סיכום שנתי' },
];

export default function Finance() {
  const { toast } = useApp();
  const [activeTab, setActiveTab] = useState('revenue');

  function handleToast(msg, type = 'success') {
    toast(msg, type);
  }

  return (
    <div>
      <div className="section-header">
        <h2>💳 כספים</h2>
      </div>

      {/* Sub-tabs */}
      <div className="finance-subtabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`btn btn-sm ${activeTab === tab.id ? '' : 'btn-secondary'}`}
            style={activeTab === tab.id ? { fontWeight: 700 } : {}}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'revenue'           && <Revenue onToast={handleToast} />}
      {activeTab === 'open-payments'     && <OpenPayments onToast={handleToast} />}
      {activeTab === 'missing-items'     && <MissingItems onToast={handleToast} />}
      {activeTab === 'fixed-expenses'    && <FixedExpenses onToast={handleToast} />}
      {activeTab === 'variable-expenses' && <VariableExpenses onToast={handleToast} />}
      {activeTab === 'annual-summary'    && <AnnualSummary onToast={handleToast} />}
    </div>
  );
}
