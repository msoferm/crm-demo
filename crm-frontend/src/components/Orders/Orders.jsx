import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext.jsx';
import { orders as orderApi } from '../../api/client.js';
import { formatDate, formatCurrency, calcOrderTotals, STATUS_LABELS, PAYMENT_LABELS, today } from '../../utils/helpers.js';
import OrderModal from './OrderModal.jsx';
import DeliveryFormModal from './DeliveryFormModal.jsx';
import ReturnFormModal from './ReturnFormModal.jsx';

const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const DAY_NAMES   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];

export default function Orders() {
  const { state, toast, loadOrders, loadClients } = useApp();
  const [view, setView] = useState('calendar');
  const [calDate, setCalDate] = useState(new Date());
  const [modalOrder, setModalOrder] = useState(undefined);
  const [dayModal, setDayModal] = useState(null); // { date, orders }
  const [statusFilter, setStatusFilter] = useState('active');
  const [deliveryOrder, setDeliveryOrder] = useState(null);
  const [returnOrder, setReturnOrder] = useState(null);
  const t = today();

  const month = calDate.getMonth();
  const year  = calDate.getFullYear();

  // Build calendar cells
  const calCells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun
    const cells = [];

    // Pad previous month
    for (let i = 0; i < startDow; i++) {
      const d = new Date(year, month, 1 - (startDow - i));
      cells.push({ date: d.toISOString().slice(0,10), inMonth: false, orders: [] });
    }
    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const iso = new Date(year, month, d).toISOString().slice(0,10);
      const dayOrders = state.orders.filter(o =>
        ['confirmed','picked_up','draft'].includes(o.status) &&
        o.start_date <= iso && o.end_date >= iso
      );
      cells.push({ date: iso, inMonth: true, orders: dayOrders });
    }
    // Pad to complete last week
    while (cells.length % 7 !== 0) {
      const d = new Date(cells[cells.length-1].date);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d.toISOString().slice(0,10), inMonth: false, orders: [] });
    }
    return cells;
  }, [calDate, state.orders]);

  // List view filters
  const filteredOrders = useMemo(() => {
    let list = [...state.orders];
    if (statusFilter === 'active') list = list.filter(o => ['confirmed','picked_up','draft'].includes(o.status));
    else if (statusFilter === 'past') list = list.filter(o => ['returned','cancelled'].includes(o.status));
    else if (statusFilter === 'overdue') list = list.filter(o => ['confirmed','picked_up'].includes(o.status) && o.end_date < t);
    return list.sort((a,b) => b.start_date.localeCompare(a.start_date));
  }, [state.orders, statusFilter]);

  async function handleDelete(order) {
    if (!confirm(`מחיקת הזמנה ${order.order_number}?`)) return;
    try {
      await orderApi.remove(order.id);
      toast('הזמנה נמחקה');
      loadOrders();
    } catch (err) { toast(err.message, 'error'); }
  }

  function handleSaved() {
    setModalOrder(undefined);
    loadOrders();
    loadClients();
  }

  function openDay(cell) {
    if (cell.orders.length === 0 || !cell.inMonth) {
      setDayModal({ date: cell.date, orders: cell.orders });
      return;
    }
    setDayModal({ date: cell.date, orders: cell.orders });
  }

  return (
    <div>
      <div className="section-header">
        <h2>📋 הזמנות</h2>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className={`btn btn-sm ${view === 'calendar' ? '' : 'btn-secondary'}`} onClick={() => setView('calendar')}>📅 לוח שנה</button>
          <button className={`btn btn-sm ${view === 'list' ? '' : 'btn-secondary'}`} onClick={() => setView('list')}>📋 רשימה</button>
          <button className="btn" onClick={() => setModalOrder(null)}>+ הזמנה חדשה</button>
        </div>
      </div>

      {/* ─── Calendar View ─── */}
      {view === 'calendar' && (
        <div className="card">
          <div className="calendar-header">
            <button className="btn btn-secondary btn-sm" onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}>◀ קודם</button>
            <span className="cal-month-label">{MONTH_NAMES[month]} {year}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setCalDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}>הבא ▶</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setCalDate(new Date())}>היום</button>
          </div>

          <div className="cal-grid">
            {DAY_NAMES.map(d => <div key={d} className="cal-day-name">{d}</div>)}
            {calCells.map((cell, i) => {
              const isToday = cell.date === t;
              return (
                <div
                  key={i}
                  className={`cal-cell${isToday ? ' today' : ''}${!cell.inMonth ? ' other-month' : ''}`}
                  onClick={() => openDay(cell)}
                >
                  <div className="cal-cell-num">{parseInt(cell.date.slice(8))}</div>
                  {cell.orders.slice(0,3).map(o => (
                    <div
                      key={o.id}
                      className={`cal-event ${o.status}`}
                      title={`${o.event_name} (${o.order_number})`}
                      onClick={e => { e.stopPropagation(); setModalOrder(o); }}
                    >
                      {o.event_name || o.order_number}
                    </div>
                  ))}
                  {cell.orders.length > 3 && (
                    <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>+{cell.orders.length-3} עוד</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── List View ─── */}
      {view === 'list' && (
        <>
          <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {[['active','פעילות'],['past','היסטוריה'],['overdue','באיחור'],['all','הכל']].map(([v,l]) => (
              <button key={v} className={`btn btn-sm ${statusFilter === v ? '' : 'btn-secondary'}`} onClick={() => setStatusFilter(v)}>{l}</button>
            ))}
          </div>

          {state.loading.orders
            ? <div className="spinner" />
            : filteredOrders.length === 0
              ? <div className="empty-state"><div className="empty-icon">📋</div><p>אין הזמנות</p></div>
              : (
                <div className="card table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>מספר</th>
                        <th>לקוח</th>
                        <th>אירוע</th>
                        <th>תאריכים</th>
                        <th>סטטוס</th>
                        <th>תשלום</th>
                        <th>סכום</th>
                        <th>פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map(o => {
                        const isOverdue = ['confirmed','picked_up'].includes(o.status) && o.end_date < t;
                        const totals = calcOrderTotals(o);
                        return (
                          <tr key={o.id} style={isOverdue ? { background: '#fff5f5' } : {}}>
                            <td><strong>{o.order_number}</strong></td>
                            <td>{o.client_name_resolved || o.client_name || '-'}</td>
                            <td>{o.event_name || '-'}</td>
                            <td style={{ fontSize: '.8rem', whiteSpace: 'nowrap' }}>{formatDate(o.start_date)} — {formatDate(o.end_date)}{isOverdue && <span className="overdue-badge" style={{ marginRight: '.4rem' }}>⚠️ איחור</span>}</td>
                            <td><span className={`chip chip-${o.status}`}>{STATUS_LABELS[o.status]}</span></td>
                            <td><span className={`chip chip-${o.payment_status}`}>{PAYMENT_LABELS[o.payment_status]}</span></td>
                            <td style={{ fontWeight: 700 }}>{formatCurrency(totals.total)}</td>
                            <td className="actions">
                              <button className="btn btn-secondary btn-sm" onClick={() => setModalOrder(o)} title="עריכה">✏️</button>
                              <button className="btn btn-success btn-sm" onClick={() => setDeliveryOrder(o)} title="תעודת הספקה">🚚</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setReturnOrder(o)} title="טופס החזרה">🔙</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(o)} title="מחיקה">🗑️</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
          }
        </>
      )}

      {/* ─── Day Event Modal ─── */}
      {dayModal && (
        <div className="modal-overlay" onClick={() => setDayModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="day-events-header">
              <h3>📅 {new Date(dayModal.date + 'T00:00:00').toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' })}</h3>
              <button className="modal-close" onClick={() => setDayModal(null)}>✕</button>
            </div>
            {dayModal.orders.length === 0
              ? <p style={{ color:'var(--muted)', padding:'1rem 0' }}>אין הזמנות ביום זה</p>
              : (
                <ul className="day-events-list">
                  {dayModal.orders.map(o => (
                    <li key={o.id} className="upcoming-item">
                      <div className={`upcoming-dot ${o.status}`} />
                      <div className="upcoming-details">
                        <div className="upcoming-title">{o.event_name} <span className={`chip chip-${o.status}`}>{STATUS_LABELS[o.status]}</span></div>
                        <div className="upcoming-meta">{o.client_name_resolved || o.client_name} · {formatDate(o.start_date)} — {formatDate(o.end_date)}</div>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setDayModal(null); setModalOrder(o); }}>✏️ עריכה</button>
                    </li>
                  ))}
                </ul>
              )
            }
            <button className="btn" style={{ marginTop:'1rem' }} onClick={() => { setDayModal(null); setModalOrder(null); }}>+ הזמנה חדשה</button>
          </div>
        </div>
      )}

      {/* ─── Order Modal ─── */}
      {modalOrder !== undefined && (
        <OrderModal
          order={modalOrder}
          onClose={() => setModalOrder(undefined)}
          onSaved={handleSaved}
        />
      )}

      {/* ─── Delivery Form Modal ─── */}
      {deliveryOrder && (
        <DeliveryFormModal
          order={deliveryOrder}
          onClose={() => setDeliveryOrder(null)}
        />
      )}

      {/* ─── Return Form Modal ─── */}
      {returnOrder && (
        <ReturnFormModal
          order={returnOrder}
          onClose={() => setReturnOrder(null)}
        />
      )}
    </div>
  );
}
