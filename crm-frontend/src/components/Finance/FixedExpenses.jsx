import React, { useEffect, useState } from 'react';
import { fixedExpenses as api } from '../../api/client.js';

const nis = n => `₪${parseFloat(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FREQ_LABELS = { monthly: 'חודשי', quarterly: 'רבעוני', annual: 'שנתי' };
const EMPTY = { name: '', amount: '', frequency: 'monthly', category: 'כללי', notes: '', active: true };

export default function FixedExpenses({ onToast }) {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(false);
  // editRows: { [id]: { ...fields } } — only set for rows being edited
  const [editRows, setEditRows] = useState({});
  const [saving, setSaving]   = useState({});
  // new row modal
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY);
  const [newSaving, setNewSaving] = useState(false);

  function load() {
    setLoading(true);
    api.list()
      .then(data => { setList(data); setEditRows({}); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  /* ── Edit helpers ── */
  function startEdit(row) {
    setEditRows(prev => ({ ...prev, [row.id]: { ...row, amount: String(row.amount) } }));
  }
  function cancelEdit(id) {
    setEditRows(prev => { const n = { ...prev }; delete n[id]; return n; });
  }
  function setCell(id, field, value) {
    setEditRows(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveRow(id) {
    const row = editRows[id];
    if (!row.name || !row.amount) return onToast?.('שם וסכום חובה', 'error');
    setSaving(prev => ({ ...prev, [id]: true }));
    try {
      await api.update(id, { ...row, amount: parseFloat(row.amount) });
      onToast?.('נשמר ✓');
      cancelEdit(id);
      load();
    } catch (e) { onToast?.(e.message, 'error'); }
    finally { setSaving(prev => { const n = { ...prev }; delete n[id]; return n; }); }
  }

  async function deleteRow(row) {
    if (!confirm(`למחוק "${row.name}"?`)) return;
    try {
      await api.remove(row.id);
      onToast?.('נמחק ✓');
      load();
    } catch (e) { onToast?.(e.message, 'error'); }
  }

  async function addNew() {
    if (!newForm.name || !newForm.amount) return onToast?.('שם וסכום חובה', 'error');
    setNewSaving(true);
    try {
      await api.create({ ...newForm, amount: parseFloat(newForm.amount) });
      onToast?.('נוסף ✓');
      setShowNew(false);
      setNewForm(EMPTY);
      load();
    } catch (e) { onToast?.(e.message, 'error'); }
    finally { setNewSaving(false); }
  }

  const monthlyTotal = list.filter(r => r.active).reduce((s, r) => {
    const amt = parseFloat(r.amount || 0);
    if (r.frequency === 'annual')    return s + amt / 12;
    if (r.frequency === 'quarterly') return s + amt / 3;
    return s + amt;
  }, 0);

  const inp = {
    border: '1px solid #d1d5db', borderRadius: 5,
    padding: '4px 7px', fontSize: '.84rem', fontFamily: 'inherit',
    direction: 'rtl', background: '#fffbeb', width: '100%',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
        <h3 style={{ margin: 0 }}>🔒 הוצאות קבועות</h3>
        <button className="btn" onClick={() => setShowNew(true)}>+ הוצאה חדשה</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'עלות חודשית',  value: nis(monthlyTotal),        color: '#dc2626' },
          { label: 'עלות שנתית',   value: nis(monthlyTotal * 12),   color: '#7c3aed' },
          { label: 'פעילות',        value: list.filter(r=>r.active).length, color: '#1e40af' },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding:'1rem', textAlign:'center', borderTop:`3px solid ${c.color}` }}>
            <div style={{ fontSize:'1.4rem', fontWeight:700, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {loading && <div className="spinner" />}

      {!loading && list.length === 0 && (
        <div className="empty-state"><div className="empty-icon">🔒</div><p>אין הוצאות קבועות</p></div>
      )}

      {!loading && list.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>שם ההוצאה</th>
                <th>קטגוריה</th>
                <th>תדירות</th>
                <th>סכום</th>
                <th>לחודש</th>
                <th>לשנה</th>
                <th style={{textAlign:'center'}}>פעיל</th>
                <th>הערות</th>
                <th style={{ width: 120 }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {list.map(row => {
                const editing = !!editRows[row.id];
                const e = editRows[row.id] || row;
                const isSaving = !!saving[row.id];
                const amt = parseFloat(e.amount || 0);
                let monthly = amt;
                if (e.frequency === 'annual')    monthly = amt / 12;
                if (e.frequency === 'quarterly') monthly = amt / 3;

                return (
                  <tr key={row.id} style={{ background: editing ? '#fffdf0' : row.active ? '' : '#f9f9f9', opacity: row.active ? 1 : 0.6 }}>
                    <td style={{ padding: editing ? '3px 6px' : '' }}>
                      {editing
                        ? <input style={inp} value={e.name} onChange={ev => setCell(row.id,'name',ev.target.value)} />
                        : <strong>{row.name}</strong>}
                    </td>
                    <td style={{ padding: editing ? '3px 6px' : '' }}>
                      {editing
                        ? <input style={inp} value={e.category} onChange={ev => setCell(row.id,'category',ev.target.value)} />
                        : row.category}
                    </td>
                    <td style={{ padding: editing ? '3px 6px' : '' }}>
                      {editing
                        ? <select style={inp} value={e.frequency} onChange={ev => setCell(row.id,'frequency',ev.target.value)}>
                            <option value="monthly">חודשי</option>
                            <option value="quarterly">רבעוני</option>
                            <option value="annual">שנתי</option>
                          </select>
                        : FREQ_LABELS[row.frequency]}
                    </td>
                    <td style={{ padding: editing ? '3px 6px' : '' }}>
                      {editing
                        ? <input style={{...inp, width:90}} type="number" min="0" step="0.01" value={e.amount} onChange={ev => setCell(row.id,'amount',ev.target.value)} />
                        : nis(row.amount)}
                    </td>
                    <td style={{ color:'#6b7280', fontSize:'.85rem' }}>{nis(monthly)}</td>
                    <td style={{ color:'#6b7280', fontSize:'.85rem' }}>{nis(monthly * 12)}</td>
                    <td style={{ textAlign:'center', padding: editing ? '3px' : '' }}>
                      {editing
                        ? <input type="checkbox" checked={!!e.active} onChange={ev => setCell(row.id,'active',ev.target.checked)} />
                        : e.active ? '✅' : '⭕'}
                    </td>
                    <td style={{ padding: editing ? '3px 6px' : '' }}>
                      {editing
                        ? <input style={inp} value={e.notes} onChange={ev => setCell(row.id,'notes',ev.target.value)} placeholder="הערות" />
                        : <span style={{ color:'var(--muted)', fontSize:'.85rem' }}>{row.notes || '-'}</span>}
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        {editing ? (
                          <>
                            <button className="btn btn-success btn-sm" disabled={isSaving} onClick={() => saveRow(row.id)} style={{padding:'3px 8px',whiteSpace:'nowrap'}}>
                              {isSaving ? '...' : '💾 שמור'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => cancelEdit(row.id)} style={{padding:'3px 6px'}}>✕</button>
                          </>
                        ) : (
                          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(row)} style={{padding:'3px 8px'}}>✏️ ערוך</button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => deleteRow(row)} style={{padding:'3px 8px'}}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight:700, background:'#f0f4ff' }}>
                <td colSpan={3}>סה"כ חודשי / שנתי</td>
                <td /><td style={{color:'#dc2626'}}>{nis(monthlyTotal)}</td>
                <td style={{color:'#7c3aed'}}>{nis(monthlyTotal*12)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add new modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:480 }}>
            <div className="modal-header">
              <h3>+ הוצאה קבועה חדשה</h3>
              <button className="modal-close" onClick={() => setShowNew(false)}>✕</button>
            </div>
            <div className="modal-body">
              {[['שם *','text','name'],['קטגוריה','text','category'],['הערות','text','notes']].map(([lbl,type,key]) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{lbl}</label>
                  <input className="form-input" type={type} value={newForm[key]} onChange={e => setNewForm(f=>({...f,[key]:e.target.value}))} />
                </div>
              ))}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <div className="form-group">
                  <label className="form-label">סכום *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={newForm.amount} onChange={e => setNewForm(f=>({...f,amount:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">תדירות</label>
                  <select className="form-input" value={newForm.frequency} onChange={e => setNewForm(f=>({...f,frequency:e.target.value}))}>
                    <option value="monthly">חודשי</option>
                    <option value="quarterly">רבעוני</option>
                    <option value="annual">שנתי</option>
                  </select>
                </div>
              </div>
              <label style={{ display:'flex', gap:'.5rem', alignItems:'center', cursor:'pointer' }}>
                <input type="checkbox" checked={newForm.active} onChange={e => setNewForm(f=>({...f,active:e.target.checked}))} />
                פעיל
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNew(false)}>ביטול</button>
              <button className="btn" onClick={addNew} disabled={newSaving}>{newSaving ? 'שומר...' : 'הוסף'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
