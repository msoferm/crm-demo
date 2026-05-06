import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext.jsx';
import { clients as clientApi } from '../../api/client.js';
import { calcOrderTotals, formatCurrency } from '../../utils/helpers.js';
import ClientModal from './ClientModal.jsx';

export default function Clients() {
  const { state, toast, loadClients } = useApp();
  const [search, setSearch] = useState('');
  const [modalClient, setModalClient] = useState(undefined);

  const filtered = useMemo(() => {
    if (!search) return state.clients;
    const q = search.toLowerCase();
    return state.clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  }, [state.clients, search]);

  // Pre-compute order stats per client
  const clientStats = useMemo(() => {
    const stats = {};
    state.clients.forEach(c => {
      const orders = state.orders.filter(o => o.client_id === c.id);
      const total = orders
        .filter(o => ['confirmed','picked_up','returned'].includes(o.status))
        .reduce((s, o) => s + calcOrderTotals(o).total, 0);
      stats[c.id] = { count: orders.length, total };
    });
    return stats;
  }, [state.clients, state.orders]);

  async function handleDelete(client) {
    if (!confirm(`האם למחוק את "${client.name}"?`)) return;
    try {
      await clientApi.remove(client.id);
      toast(`"${client.name}" נמחק`);
      loadClients();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function handleSaved() {
    setModalClient(undefined);
    loadClients();
  }

  return (
    <div>
      <div className="section-header">
        <h2>👤 לקוחות</h2>
        <button className="btn" onClick={() => setModalClient(null)}>+ לקוח חדש</button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <input
          className="search-input"
          placeholder="🔍 חיפוש לפי שם, חברה, טלפון..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {state.loading.clients
        ? <div className="spinner" />
        : filtered.length === 0
          ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <p>{search ? 'לא נמצאו לקוחות תואמים' : 'אין לקוחות במערכת. הוסף לקוח ראשון!'}</p>
            </div>
          )
          : (
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>חברה</th>
                    <th>טלפון</th>
                    <th>אימייל</th>
                    <th>הזמנות</th>
                    <th>סה"כ</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(client => {
                    const s = clientStats[client.id] || { count: 0, total: 0 };
                    return (
                      <tr key={client.id}>
                        <td>
                          <button
                            style={{ background: 'none', border: 'none', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
                            onClick={() => setModalClient(client)}
                          >
                            {client.name}
                          </button>
                        </td>
                        <td>{client.company || '-'}</td>
                        <td>{client.phone || '-'}</td>
                        <td>{client.email || '-'}</td>
                        <td>{s.count}</td>
                        <td>{s.total > 0 ? formatCurrency(s.total) : '-'}</td>
                        <td className="actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => setModalClient(client)}>✏️ עריכה</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(client)}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
      }

      {modalClient !== undefined && (
        <ClientModal
          client={modalClient}
          onClose={() => setModalClient(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
