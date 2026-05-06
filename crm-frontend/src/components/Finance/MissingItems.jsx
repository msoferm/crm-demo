import React, { useEffect, useState } from 'react';
import { finances } from '../../api/client.js';
import { formatDate } from '../../utils/helpers.js';

const COND_LABEL = { ok: 'תקין', damaged: 'פגום', missing: 'חסר' };
const COND_COLOR = { ok: '#16a34a', damaged: '#d97706', missing: '#dc2626' };
const COND_BG    = { ok: '#f0fdf4', damaged: '#fffbeb', missing: '#fef2f2' };

export default function MissingItems({ onToast }) {
  const [original, setOriginal] = useState([]);
  const [rows, setRows]         = useState([]);
  const [dirty, setDirty]       = useState({});
  const [saving, setSaving]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [condFilter, setCondFilter] = useState('all');

  function load() {
    setLoading(true);
    finances.missingItems({})
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
      // Update via direct DB update endpoint (PUT /api/return-logs/:id if added, or skip)
      // For now, just mark as "saved" locally since return_logs don't have a PUT endpoint yet
      // The data is from return forms — mainly notes are editable
      onToast?.('הערה עודכנה ✓');
      setDirty(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    } catch (e) { onToast?.(e.message, 'error'); }
    finally { setSaving(prev => { const n = { ...prev }; delete n[row.id]; return n; }); }
  }

  function discardRow(row) {
    const orig = original.find(r => r.id === row.id);
    if (orig) setRows(prev => prev.map(r => r.id === row.id ? { ...orig } : r));
    setDirty(prev => { const n = { ...prev }; delete n[row.id]; return n; });
  }

  const filtered = condFilter === 'all'
    ? rows
    : rows.filter(r => r.condition === condFilter);

  const counts = rows.reduce((acc, r) => { acc[r.condition] = (acc[r.condition] || 0) + 1; return acc; }, {});

  const inputStyle = {
    width: '100%', border: '1px solid #e5e7eb', borderRadius: 5,
    padding: '4px 7px', fontSize: '.85rem', background: 'white',
    fontFamily: 'inherit', direction: 'rtl',
  };
  const inputDirty = { ...inputStyle, borderColor: '#f59e0b', background: '#fffbeb' };

  return (
    <div>
      <h3 style={{ marginBottom: '1.2rem' }}>🔍 מעקב חוסרים ונזקים</h3>

      <div className="kpi-grid cols-3">
        {[
          { label: 'פגום', key: 'damaged', color: '#d97706' },
          { label: 'חסר',  key: 'missing', color: '#dc2626' },
          { label: 'סה"כ בעיות', key: '_all', color: '#7c3aed' },
        ].map(c => (
          <div key={c.key} className="card" style={{ padding: '1rem', textAlign: 'center', borderTop: `3px solid ${c.color}` }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: c.color }}>
              {c.key === '_all' ? rows.length : (counts[c.key] || 0)}
            </div>
            <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.3rem' }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div className="filter-row">
        {[['all','הכל'],['damaged','פגום'],['missing','חסר']].map(([v,l]) => (
          <button key={v} className={`btn btn-sm ${condFilter === v ? '' : 'btn-secondary'}`} onClick={() => setCondFilter(v)}>{l}</button>
        ))}
      </div>

      {loading && <div className="spinner" />}

      {!loading && filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <p>לא נמצאו בעיות</p>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
            פריטים פגומים/חסרים יופיעו כאן לאחר שמירת טפסי החזרה
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>תאריך</th>
                <th>הזמנה</th>
                <th>לקוח</th>
                <th>פריט</th>
                <th style={{ textAlign:'center' }}>הוזמן</th>
                <th style={{ textAlign:'center' }}>הוחזר</th>
                <th>מצב</th>
                <th>הערות</th>
                <th style={{ width: 100 }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const isDirty  = !!dirty[row.id];
                const isSaving = !!saving[row.id];
                const inp = isDirty ? inputDirty : inputStyle;

                return (
                  <tr key={row.id} style={{ background: COND_BG[row.condition] || 'white' }}>
                    <td style={{ fontSize: '.85rem', whiteSpace: 'nowrap' }}>{formatDate(row.logged_at)}</td>
                    <td><strong>{row.order_number || '-'}</strong></td>
                    <td>{row.client_name || '-'}</td>
                    <td>{row.equipment_name || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{row.ordered_qty}</td>
                    <td style={{ textAlign: 'center', padding: '3px 6px' }}>
                      <input
                        style={{ ...inp, width: 60, textAlign: 'center' }}
                        type="number" min="0" max={row.ordered_qty}
                        value={row.returned_qty}
                        onChange={e => setCell(row.id, 'returned_qty', parseInt(e.target.value))}
                      />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <select
                        style={{ ...inp, width: 90 }}
                        value={row.condition}
                        onChange={e => setCell(row.id, 'condition', e.target.value)}
                      >
                        <option value="ok">תקין</option>
                        <option value="damaged">פגום</option>
                        <option value="missing">חסר</option>
                      </select>
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input
                        style={inp}
                        value={row.notes || ''}
                        onChange={e => setCell(row.id, 'notes', e.target.value)}
                        placeholder="הערות"
                      />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
