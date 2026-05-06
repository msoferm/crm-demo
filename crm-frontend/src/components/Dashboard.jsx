import React, { useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { formatDate, formatCurrency, calcOrderTotals, today, STATUS_LABELS, PAYMENT_LABELS } from '../utils/helpers.js';

function StatCard({ color, icon, label, value, onClick }) {
  const Tag = onClick ? 'button' : 'article';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`stat-card stat-${color}${onClick ? ' stat-card-clickable' : ''}`}
      onClick={onClick}
    >
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </Tag>
  );
}

export default function Dashboard({ onNavigate }) {
  const { state } = useApp();
  const [search, setSearch] = useState('');
  const t = today();
  const now = new Date();

  const stats = useMemo(() => {
    const active = state.orders.filter(o => ['confirmed','picked_up'].includes(o.status));
    const monthRevenue = state.orders
      .filter(o => ['confirmed','picked_up','returned'].includes(o.status) &&
        new Date(o.start_date).getMonth() === now.getMonth() &&
        new Date(o.start_date).getFullYear() === now.getFullYear())
      .reduce((s, o) => s + calcOrderTotals(o).total, 0);
    const unpaidTotal = state.orders
      .filter(o => o.payment_status === 'unpaid' && ['confirmed','picked_up'].includes(o.status))
      .reduce((s, o) => s + calcOrderTotals(o).total, 0);
    const overdue = state.orders.filter(o =>
      ['confirmed','picked_up'].includes(o.status) && o.end_date < t
    );
    const totalUnits = state.equipment.reduce((s, e) => s + e.quantity, 0);

    return { active: active.length, monthRevenue, unpaidTotal, overdue: overdue.length, totalUnits };
  }, [state.orders, state.equipment]);

  const upcoming = useMemo(() => {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nw = nextWeek.toISOString().slice(0, 10);
    return state.orders
      .filter(o => ['confirmed','picked_up'].includes(o.status) &&
        (( o.start_date >= t && o.start_date <= nw) || (o.end_date >= t && o.end_date <= nw)))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 8);
  }, [state.orders]);

  const lowStock = useMemo(() => {
    return state.equipment
      .filter(e => e.quantity > 0 && e.quantity - (e.damaged_qty || 0) <= 2)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 6);
  }, [state.equipment]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const eq = state.equipment.filter(e => e.name.toLowerCase().includes(q) || (e.sku || '').toLowerCase().includes(q));
    const cl = state.clients.filter(c => c.name.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q));
    const or = state.orders.filter(o => o.order_number?.toLowerCase().includes(q) || o.event_name?.toLowerCase().includes(q));
    return { eq, cl, or };
  }, [search, state]);

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>📊 דשבורד</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
            {now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <input
          className="search-input"
          placeholder="🔍 חיפוש ציוד, לקוחות, הזמנות..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Search results */}
      {searchResults && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          {searchResults.eq.length > 0 && (
            <>
              <h4 style={{ marginBottom: '.5rem', color: 'var(--primary)' }}>📦 ציוד</h4>
              <div className="equipment-grid" style={{ marginTop: 0 }}>
                {searchResults.eq.slice(0,6).map(e => (
                  <div key={e.id} className="eq-card" onClick={() => onNavigate('equipment')} style={{ cursor: 'pointer' }}>
                    <div className="eq-card-img">
                      {e.image_url ? <img src={e.image_url} alt={e.name} /> : <span className="eq-card-img-placeholder">📦</span>}
                    </div>
                    <div className="eq-card-body">
                      <div className="eq-card-name">{e.name}</div>
                      <div className="eq-card-meta">כמות: {e.quantity} | ₪{e.price_per_day}/יום</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {searchResults.cl.length > 0 && (
            <>
              <h4 style={{ margin: '.75rem 0 .5rem', color: 'var(--primary)' }}>👤 לקוחות</h4>
              {searchResults.cl.slice(0,4).map(c => (
                <div key={c.id} style={{ padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.88rem', cursor: 'pointer' }} onClick={() => onNavigate('clients')}>
                  <strong>{c.name}</strong>{c.company ? ` · ${c.company}` : ''}{c.phone ? ` · ${c.phone}` : ''}
                </div>
              ))}
            </>
          )}
          {searchResults.or.length > 0 && (
            <>
              <h4 style={{ margin: '.75rem 0 .5rem', color: 'var(--primary)' }}>📋 הזמנות</h4>
              {searchResults.or.slice(0,4).map(o => (
                <div key={o.id} style={{ padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.88rem', cursor: 'pointer' }} onClick={() => onNavigate('orders')}>
                  <strong>{o.order_number}</strong> · {o.event_name} · {formatDate(o.start_date)}
                  <span className={`chip chip-${o.status}`} style={{ marginRight: '.5rem' }}>{STATUS_LABELS[o.status]}</span>
                </div>
              ))}
            </>
          )}
          {!searchResults.eq.length && !searchResults.cl.length && !searchResults.or.length && (
            <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>לא נמצאו תוצאות עבור "{search}"</p>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <StatCard color="blue"   icon="📦" label="סוגי ציוד"     value={state.equipment.length}                          onClick={() => onNavigate('equipment')} />
        <StatCard color="green"  icon="📋" label="הזמנות פעילות" value={stats.active}                                    onClick={() => onNavigate('orders')} />
        <StatCard color="purple" icon="💰" label="הכנסות החודש"  value={formatCurrency(stats.monthRevenue)}              onClick={() => onNavigate('finance')} />
        <StatCard color="orange" icon="⏳" label="חוב גביה"       value={formatCurrency(stats.unpaidTotal)}              onClick={() => onNavigate('finance')} />
        {stats.overdue > 0 && <StatCard color="red" icon="⚠️" label="הזמנות באיחור" value={stats.overdue}               onClick={() => onNavigate('orders')} />}
        <StatCard color="teal"   icon="🗂️" label="יחידות מלאי"   value={state.equipment.reduce((s,e)=>s+e.quantity,0)}  onClick={() => onNavigate('equipment')} />
      </div>

      <div className="dash-panels">
        {/* Upcoming */}
        <article className="panel">
          <h3>📅 איסופים/החזרות קרובים (7 ימים)</h3>
          {upcoming.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>אין פעולות קרובות בשבוע הקרוב</p>
          ) : (
            <ul>
              {upcoming.map(o => {
                const isPickup = o.start_date >= t;
                const overdue = o.end_date < t;
                return (
                  <li key={o.id} className="upcoming-item">
                    <div className={`upcoming-dot ${o.status}`} />
                    <div className="upcoming-details">
                      <div className="upcoming-title">
                        {o.event_name || o.order_number}
                        <span className={`chip chip-${o.status}`} style={{ marginRight: '.4rem' }}>{STATUS_LABELS[o.status]}</span>
                        {overdue && <span className="overdue-badge">⚠️ איחור</span>}
                      </div>
                      <div className="upcoming-meta">
                        {o.client_name_resolved || o.client_name} · {isPickup ? '🚚 איסוף' : '🔙 החזרה'} {formatDate(isPickup ? o.start_date : o.end_date)}
                      </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('orders')}>צפייה</button>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        {/* Low stock */}
        <article className="panel">
          <h3>⚠️ התראות מלאי</h3>
          {lowStock.length === 0 ? (
            <p style={{ color: 'var(--success)', fontSize: '.88rem' }}>✅ רמות המלאי תקינות</p>
          ) : (
            <ul>
              {lowStock.map(e => {
                const pct = e.quantity > 0 ? Math.round(((e.quantity - (e.damaged_qty||0)) / e.quantity) * 100) : 0;
                const color = pct === 0 ? 'var(--danger)' : pct <= 30 ? 'var(--warn)' : 'var(--primary)';
                return (
                  <li key={e.id} className="stock-item">
                    <div className="stock-item-info">
                      <div className="stock-item-name">{e.name}</div>
                      <div className="stock-bar-wrap">
                        <div className="stock-bar-fill" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                    <span className="stock-count" style={{ color }}>{e.quantity - (e.damaged_qty||0)}/{e.quantity}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      </div>
    </div>
  );
}
