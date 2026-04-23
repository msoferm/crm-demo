import React, { useState, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext.jsx';
import { equipment as equipApi } from '../../api/client.js';
import { CATEGORY_LABELS, formatCurrency } from '../../utils/helpers.js';
import EquipmentModal from './EquipmentModal.jsx';

function EquipmentCard({ item, onClick, onDelete, onSync }) {
  const available = Math.max(0, item.quantity - (item.damaged_qty || 0));
  const stockClass = available === 0 ? 'eq-card-stock-zero' : available <= 2 ? 'eq-card-stock-low' : 'eq-card-stock-good';

  return (
    <div className="eq-card" onClick={onClick}>
      <div className="eq-card-img">
        {item.image_url
          ? <img src={item.image_url} alt={item.name} />
          : <span className="eq-card-img-placeholder">📦</span>}
      </div>
      <div className="eq-card-body">
        <div className="eq-card-name">{item.name}</div>
        {item.sku && <div className="eq-card-sku">מק"ט: {item.sku}</div>}
        <div className="eq-card-meta">{CATEGORY_LABELS[item.category] || item.category}</div>
        <div className="eq-card-price">{formatCurrency(item.price_per_day)} / יום</div>
        <div className={`eq-card-meta ${stockClass}`}>
          מלאי: {available}/{item.quantity}
          {item.damaged_qty > 0 && ` (${item.damaged_qty} פגום)`}
        </div>
        {(item.shelf_location || item.shelf_row) && (
          <div className="eq-card-meta" style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
            📍 {[item.shelf_location, item.shelf_row].filter(Boolean).join(' - ')}
          </div>
        )}
      </div>
      <div className="eq-card-actions" onClick={e => e.stopPropagation()}>
        <button className="btn btn-secondary btn-sm" onClick={onClick}>✏️ עריכה</button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(item)}>🗑️</button>
        <button className="btn btn-warn btn-sm" onClick={() => onSync(item)} title="סנכרון">🔄</button>
      </div>
    </div>
  );
}

export default function Equipment() {
  const { state, toast, loadEquipment } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [modalItem, setModalItem] = useState(undefined); // undefined = closed
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    let list = state.equipment;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || (e.sku || '').toLowerCase().includes(q));
    }
    if (category !== 'all') list = list.filter(e => e.category === category);
    return list;
  }, [state.equipment, search, category]);

  async function handleDelete(item) {
    if (!confirm(`האם למחוק את "${item.name}"?`)) return;
    try {
      await equipApi.remove(item.id);
      toast(`"${item.name}" נמחק`);
      loadEquipment();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleSync(item) {
    try {
      toast('מסנכרן...', 'info');
      await equipApi.sync(item.id);
      toast(`"${item.name}" סונכרן בהצלחה ✅`);
      loadEquipment();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function handleSaved() {
    setModalItem(undefined);
    loadEquipment();
  }

  return (
    <div>
      <div className="section-header">
        <h2>📦 קטלוג ציוד</h2>
        <button className="btn" onClick={() => setModalItem(null)}>+ הוספת מוצר חדש</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="search-input"
          placeholder="🔍 חיפוש לפי שם או מק&quot;ט..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '180px' }}
        />
        <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${category === 'all' ? '' : 'btn-secondary'}`} onClick={() => setCategory('all')}>הכל</button>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <button key={k} className={`btn btn-sm ${category === k ? '' : 'btn-secondary'}`} onClick={() => setCategory(k)}>{v}</button>
          ))}
        </div>
      </div>

      {state.loading.equipment
        ? <div className="spinner" />
        : filtered.length === 0
          ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <p>{search || category !== 'all' ? 'לא נמצאו פריטים תואמים' : 'אין ציוד במערכת. הוסף מוצר ראשון!'}</p>
            </div>
          )
          : (
            <div className="equipment-grid">
              {filtered.map(item => (
                <EquipmentCard
                  key={item.id}
                  item={item}
                  onClick={() => setModalItem(item)}
                  onDelete={handleDelete}
                  onSync={handleSync}
                />
              ))}
            </div>
          )
      }

      {modalItem !== undefined && (
        <EquipmentModal
          item={modalItem}
          onClose={() => setModalItem(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
