import React, { useEffect, useState } from 'react';
import { finances, orders as ordersApi } from '../../api/client.js';
import { formatDate } from '../../utils/helpers.js';

const nis = n => `₪${parseFloat(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PAYMENT_LABELS = { unpaid: 'לא שולם', partial: 'שולם חלקית', paid: 'שולם' };
const STATUS_LABELS  = { draft: 'טיוטה', confirmed: 'מאושר', picked_up: 'נאסף', returned: 'הוחזר', cancelled: 'מבוטל' };

export default function OpenPayments({ onToast }) {
  const [original, setOriginal] = useState([]);
  const [rows, setRows]         = useState([]);
  const [dirty, setDirty]       = useState({});
  const [saving, setSaving]     = useState({});
  const [loading, setLoading]   = useState(false);

  function load() {
    setLoading(true);
    finances.openPayments()
      .then(data => {
        setOriginal(data);
        setRows(data.map(r => ({ ...r })));
        setDirty({});
      })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function setCell(id, field, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setDirty(prev => ({ ...prev, [id]: true }));
  }

  async function saveRow(row) {
    setSaving(prev => ({ ...prev, [row.id]: true }));
    try {
      await ordersApi.update(row.id, {
        payment_status: row.payment_status,
        payment_method: row.payment_method,
        notes: row.notes,
      });
      onToast?.('עודכן ✓');
      setDirty(prev => { const n = { ...prev }; delete n[row.id]; return n; });
      // If now paid, remove from list
      if (row.payment_status === 'paid') {
        setRows(prev => prev.filter(r => r.id !== row.id));
      }
    } catch (e) { onToast?.(e.message, 'error'); }
    finally { setSaving(prev => { const n = { ...prev }; delete n[row.id]; return n; }); }
  }

  function discardRow(row) {
    const orig = original.find(r => r.id === row.id);
    if (orig) setRows(prev => prev.map(r => r.id === row.id ? { ...orig } : r));
    setDirty(prev => { const n = { ...prev }; delete n[row.id]; return n; });
  }

  const total    = rows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
  const overdue  = rows.filter(r => r.end_date < new Date().toISOString().slice(0, 10)).length;

  const inputStyle = {
    width: '100%', border: '1px solid #e5e7eb', borderRadius: 5,
    padding: '4px 7px', fontSize: '.85rem', background: 'white',
    fontFamily: 'inherit', direction: 'rtl',
  };
  const inputDirty = { ...inputStyle, borderColor: '#f59e0b', background: '#fffbeb' };

  return (
    <div>
      <h3 style={{ marginBottom: '1.2rem' }}>⏳ מעקב תשלומים פתוחים</h3>

      <div className="kpi-grid cols-3">
        {[
          { label: 'סה"כ חוב פתוח', value: nis(total),   color: '#dc2626' },
          { label: 'הזמנות פתוחות', value: rows.length,   color: '#d97706' },
          { label: 'הזמנות באיחור', value: overdue,        color: '#7c3aed' },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: '1rem', textAlign: 'center', borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.3rem' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {loading && <div className="spinner" />}

      {!loading && rows.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <p>אין תשלומים פתוחים</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>מספר הזמנה</th>
                <th>לקוח</th>
                <th>אירוע</th>
                <th>תאריכים</th>
                <th>סטטוס הזמנה</th>
                <th>סטטוס תשלום</th>
                <th>אמצעי תשלום</th>
                <th>הערות</th>
                <th>סכום</th>
                <th style={{ width: 130 }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isOverdue = row.end_date < new Date().toISOString().slice(0, 10);
                const isDirty   = !!dirty[row.id];
                const isSaving  = !!saving[row.id];
                const inp = isDirty ? inputDirty : inputStyle;

                return (
                  <tr key={row.id} style={{ background: isOverdue ? '#fff5f5' : isDirty ? '#fffdf0' : '' }}>
                    <td>
                      <strong>{row.order_number}</strong>
                      {isOverdue && <div style={{ fontSize: '.72rem', color: '#dc2626' }}>⚠ באיחור</div>}
                    </td>
                    <td>{row.client_name_resolved || row.client_name || '-'}</td>
                    <td>{row.event_name || '-'}</td>
                    <td style={{ fontSize: '.8rem', whiteSpace: 'nowrap' }}>
                      {formatDate(row.start_date)} — {formatDate(row.end_date)}
                    </td>
                    <td>
                      <span className={`chip chip-${row.status}`}>{STATUS_LABELS[row.status] || row.status}</span>
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <select
                        style={{ ...inp, width: 120 }}
                        value={row.payment_status}
                        onChange={e => setCell(row.id, 'payment_status', e.target.value)}
                      >
                        <option value="unpaid">לא שולם</option>
                        <option value="partial">שולם חלקית</option>
                        <option value="paid">שולם ✓</option>
                      </select>
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input
                        style={{ ...inp, width: 110 }}
                        value={row.payment_method || ''}
                        onChange={e => setCell(row.id, 'payment_method', e.target.value)}
                        placeholder="אמצעי תשלום"
                      />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input
                        style={inp}
                        value={row.notes || ''}
                        onChange={e => setCell(row.id, 'notes', e.target.value)}
                        placeholder="הערות"
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap' }}>{nis(row.total)}</td>
                    <td style={{ padding: '3px 6px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                        {isDirty && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              disabled={isSaving}
                              onClick={() => saveRow(row)}
                              style={{ padding: '3px 8px', whiteSpace: 'nowrap' }}
                            >
                              {isSaving ? '...' : '💾 שמור'}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => discardRow(row)}
                              style={{ padding: '3px 6px' }}
                            >✕</button>
                          </>
                        )}
                        {!isDirty && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => { setCell(row.id, 'payment_status', 'paid'); }}
                            style={{ padding: '3px 8px', whiteSpace: 'nowrap' }}
                          >
                            ✓ שולם
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, background: '#f0f4ff' }}>
                <td colSpan={8}>סה"כ</td>
                <td style={{ color: '#dc2626' }}>{nis(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
