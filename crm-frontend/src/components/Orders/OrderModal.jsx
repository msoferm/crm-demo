import React, { useState, useEffect, useMemo } from 'react';
import { orders as orderApi, clients as clientApi } from '../../api/client.js';
import { useApp } from '../../contexts/AppContext.jsx';
import { PAYMENT_METHODS, calcOrderTotals, formatCurrency, daysBetween } from '../../utils/helpers.js';

const EMPTY_ORDER = {
  client_id: '', event_name: '', location: '', start_date: '', end_date: '',
  status: 'draft', payment_status: 'unpaid', payment_method: '',
  discount_type: 'percent', discount_value: 0, notes: '',
};

const EMPTY_CLIENT = { name: '', phone: '', email: '', company: '' };

export default function OrderModal({ order, onClose, onSaved }) {
  const { state, toast, loadClients } = useApp();
  const [form, setForm] = useState(order ? { ...order } : { ...EMPTY_ORDER });
  const [items, setItems] = useState(order?.items || []);
  const [saving, setSaving] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ ...EMPTY_CLIENT });
  const [savingClient, setSavingClient] = useState(false);

  useEffect(() => {
    setForm(order ? { ...order } : { ...EMPTY_ORDER });
    setItems(order?.items || []);
  }, [order]);

  const days = useMemo(() => {
    if (!form.start_date || !form.end_date) return 1;
    return daysBetween(form.start_date, form.end_date);
  }, [form.start_date, form.end_date]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function addItem() {
    setItems(prev => [...prev, { equipment_id: '', equipment_name: '', equipment_sku: '', quantity: 1, price_per_day: 0, days }]);
  }

  function updateItem(idx, field, value) {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };

      // Auto-fill from equipment catalog
      if (field === 'equipment_id' && value) {
        const equip = state.equipment.find(e => e.id === value);
        if (equip) {
          next[idx].equipment_name = equip.name;
          next[idx].equipment_sku = equip.sku || '';
          next[idx].price_per_day = equip.price_per_day;
          next[idx].days = days;
        }
      }
      return next;
    });
  }

  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  const totals = useMemo(() => calcOrderTotals({ ...form, items }), [form, items]);

  async function handleSaveNewClient(e) {
    e.preventDefault();
    setSavingClient(true);
    try {
      const saved = await clientApi.create(newClient);
      set('client_id', saved.id);
      setShowNewClient(false);
      setNewClient({ ...EMPTY_CLIENT });
      toast(`לקוח "${saved.name}" נוסף`);
      loadClients();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingClient(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: items.map(i => ({ ...i, quantity: Number(i.quantity), price_per_day: Number(i.price_per_day), days: Number(i.days || days) })),
        discount_value: Number(form.discount_value || 0),
        client_name: state.clients.find(c => c.id === form.client_id)?.name || form.event_name || '',
      };

      if (order?.id) {
        await orderApi.update(order.id, payload);
      } else {
        await orderApi.create(payload);
      }
      toast(order ? 'הזמנה עודכנה' : 'הזמנה נוצרה בהצלחה');
      onSaved?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const selectedClient = state.clients.find(c => c.id === form.client_id);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>{order ? `עריכת הזמנה: ${order.order_number}` : '+ הזמנה חדשה'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

            {/* Client */}
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>לקוח</label>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <select value={form.client_id} onChange={e => set('client_id', e.target.value)} style={{ flex: 1 }}>
                  <option value="">-- בחר לקוח --</option>
                  {state.clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
                </select>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewClient(!showNewClient)}>
                  {showNewClient ? 'ביטול' : '+ לקוח חדש'}
                </button>
              </div>
              {selectedClient && (
                <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '.2rem' }}>
                  {selectedClient.phone && `📞 ${selectedClient.phone}`} {selectedClient.email && `✉️ ${selectedClient.email}`}
                </div>
              )}
            </div>

            {showNewClient && (
              <div className="client-quick-add" style={{ gridColumn: '1/-1' }}>
                <h4>➕ הוספת לקוח חדש</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
                  <input placeholder="שם מלא *" value={newClient.name} onChange={e => setNewClient(n => ({ ...n, name: e.target.value }))} required />
                  <input placeholder="טלפון" value={newClient.phone} onChange={e => setNewClient(n => ({ ...n, phone: e.target.value }))} />
                  <input placeholder="אימייל" value={newClient.email} onChange={e => setNewClient(n => ({ ...n, email: e.target.value }))} />
                  <input placeholder="חברה" value={newClient.company} onChange={e => setNewClient(n => ({ ...n, company: e.target.value }))} />
                </div>
                <button type="button" className="btn btn-success btn-sm" style={{ marginTop: '.5rem' }} onClick={handleSaveNewClient} disabled={savingClient || !newClient.name}>
                  {savingClient ? 'שומר...' : '✅ הוסף לקוח'}
                </button>
              </div>
            )}

            <div className="form-group">
              <label>שם האירוע</label>
              <input value={form.event_name} onChange={e => set('event_name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>מיקום</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} />
            </div>
            <div className="form-group">
              <label>תאריך התחלה *</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>תאריך סיום *</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>סטטוס הזמנה</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">טיוטה</option>
                <option value="confirmed">מאושר</option>
                <option value="picked_up">נאסף</option>
                <option value="returned">הוחזר</option>
                <option value="cancelled">מבוטל</option>
              </select>
            </div>
            <div className="form-group">
              <label>סטטוס תשלום</label>
              <select value={form.payment_status} onChange={e => set('payment_status', e.target.value)}>
                <option value="unpaid">לא שולם</option>
                <option value="partial">שולם חלקית</option>
                <option value="paid">שולם</option>
              </select>
            </div>
            <div className="form-group">
              <label>אמצעי תשלום</label>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
                <option value="">-- בחר --</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label>הנחה</label>
                <input type="number" min="0" value={form.discount_value} onChange={e => set('discount_value', e.target.value)} />
              </div>
              <select value={form.discount_type} onChange={e => set('discount_type', e.target.value)} style={{ width: '70px', marginBottom: 0 }}>
                <option value="percent">%</option>
                <option value="fixed">₪</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>הערות</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>

          {/* Order Items */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
              <strong>פריטי הזמנה</strong>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ הוסף פריט</button>
            </div>

            {items.length > 0 && (
              <div className="order-items-table-wrap">
              <table className="order-items-table">
                <thead>
                  <tr>
                    <th>ציוד</th>
                    <th>כמות</th>
                    <th>ימים</th>
                    <th>מחיר/יום</th>
                    <th>סה"כ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <select value={item.equipment_id} onChange={e => updateItem(idx, 'equipment_id', e.target.value)} style={{ minWidth: 130 }}>
                          <option value="">-- בחר ציוד --</option>
                          {state.equipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        {!item.equipment_id && (
                          <input placeholder="שם ידני" value={item.equipment_name} onChange={e => updateItem(idx, 'equipment_name', e.target.value)} style={{ marginTop: '.25rem' }} />
                        )}
                      </td>
                      <td><input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{ width: 55 }} /></td>
                      <td><input type="number" min="1" value={item.days || days} onChange={e => updateItem(idx, 'days', e.target.value)} style={{ width: 55 }} /></td>
                      <td><input type="number" min="0" step="0.01" value={item.price_per_day} onChange={e => updateItem(idx, 'price_per_day', e.target.value)} style={{ width: 70 }} /></td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(item.quantity * item.price_per_day * (item.days || days))}</td>
                      <td><button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}

            <div className="order-total-row">
              <span>סכום ביניים: <strong>{formatCurrency(totals.subtotal)}</strong></span>
              {totals.discount > 0 && <span>הנחה: <strong style={{ color: 'var(--danger)' }}>-{formatCurrency(totals.discount)}</strong></span>}
              <span>סה"כ לתשלום: <strong style={{ fontSize: '1rem' }}>{formatCurrency(totals.total)}</strong></span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1.25rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'שומר...' : '💾 שמור הזמנה'}</button>
            {order && (
              <>
                <a href={orderApi.deliveryNoteUrl(order.id)} target="_blank" rel="noreferrer" className="btn btn-success">
                  🚚 תעודת משלוח
                </a>
                <a href={orderApi.returnNoteUrl(order.id)} target="_blank" rel="noreferrer" className="btn btn-secondary">
                  🔙 תעודת החזרה
                </a>
              </>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
