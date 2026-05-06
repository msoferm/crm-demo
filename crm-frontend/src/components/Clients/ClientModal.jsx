import React, { useState, useEffect } from 'react';
import { clients as clientApi } from '../../api/client.js';
import { useApp } from '../../contexts/AppContext.jsx';
import { formatDate, formatCurrency, calcOrderTotals, STATUS_LABELS } from '../../utils/helpers.js';

const EMPTY = { name: '', company: '', email: '', phone: '', address: '', notes: '' };

export default function ClientModal({ client, onClose, onSaved }) {
  const { toast, state } = useApp();
  const [form, setForm] = useState(client ? { ...client } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details');

  const clientOrders = state.orders
    .filter(o => o.client_id === client?.id)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));

  const totalSpent = clientOrders
    .filter(o => ['confirmed','picked_up','returned'].includes(o.status))
    .reduce((s, o) => s + calcOrderTotals(o).total, 0);

  useEffect(() => {
    setForm(client ? { ...client } : { ...EMPTY });
  }, [client]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (client?.id) {
        await clientApi.update(client.id, form);
      } else {
        await clientApi.create(form);
      }
      toast(client ? 'הלקוח עודכן' : 'הלקוח נוסף בהצלחה');
      onSaved?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{client ? `${client.name}` : '+ לקוח חדש'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {client && (
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', borderBottom: '2px solid var(--border)', paddingBottom: '.5rem' }}>
            <button className={`btn btn-sm ${tab === 'details' ? '' : 'btn-secondary'}`} onClick={() => setTab('details')}>פרטים</button>
            <button className={`btn btn-sm ${tab === 'orders' ? '' : 'btn-secondary'}`} onClick={() => setTab('orders')}>
              הזמנות ({clientOrders.length})
            </button>
          </div>
        )}

        {tab === 'details' && (
          <form onSubmit={handleSave}>
            <div className="form-row-2">
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>שם מלא *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>חברה / ארגון</label>
                <input value={form.company} onChange={e => set('company', e.target.value)} />
              </div>
              <div className="form-group">
                <label>טלפון</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" />
              </div>
              <div className="form-group">
                <label>אימייל</label>
                <input value={form.email} onChange={e => set('email', e.target.value)} type="email" />
              </div>
              <div className="form-group">
                <label>כתובת</label>
                <input value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>הערות</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'שומר...' : '💾 שמור'}</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>ביטול</button>
            </div>
          </form>
        )}

        {tab === 'orders' && client && (
          <div>
            <div className="card" style={{ marginBottom: '1rem', padding: '.75rem' }}>
              <strong>סה"כ הזמנות: {clientOrders.length}</strong> · סה"כ שולם: <strong style={{ color: 'var(--success)' }}>{formatCurrency(totalSpent)}</strong>
            </div>
            {clientOrders.length === 0
              ? <p style={{ color: 'var(--muted)' }}>אין הזמנות ללקוח זה</p>
              : clientOrders.map(o => (
                <div key={o.id} style={{ padding: '.6rem', borderBottom: '1px solid var(--border)', fontSize: '.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{o.order_number}</strong>
                    <span className={`chip chip-${o.status}`}>{STATUS_LABELS[o.status]}</span>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '.78rem', marginTop: '.2rem' }}>
                    {o.event_name} · {formatDate(o.start_date)} — {formatDate(o.end_date)} · {formatCurrency(calcOrderTotals(o).total)}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
