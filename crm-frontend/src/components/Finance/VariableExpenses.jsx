import React, { useEffect, useState } from 'react';
import { variableExpenses as api } from '../../api/client.js';

const nis = n => `₪${parseFloat(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONTHS = ['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const todayStr = () => new Date().toISOString().slice(0, 10);
const EMPTY = { name: '', amount: '', date: todayStr(), category: 'כללי', notes: '' };

export default function VariableExpenses({ onToast }) {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear]       = useState(new Date().getFullYear());
  const [monthF, setMonthF]   = useState('');
  const [editRows, setEditRows] = useState({});
  const [saving, setSaving]   = useState({});
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY);
  const [newSaving, setNewSaving] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  function load() {
    setLoading(true);
    const params = { year };
    if (monthF) params.month = monthF;
    api.list(params)
      .then(data => { setList(data); setEditRows({}); })
      .finally(() => setLoading(false));
  }
  useEffect(load, [year, monthF]);

  /* ── Edit helpers ── */
  function startEdit(row) {
    setEditRows(prev => ({ ...prev, [row.id]: { ...row, amount: String(row.amount), date: row.date?.slice(0,10) || todayStr() } }));
  }
  function cancelEdit(id) {
    setEditRows(prev => { const n = { ...prev }; delete n[id]; return n; });
  }
  function setCell(id, field, value) {
    setEditRows(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveRow(id) {
    const row = editRows[id];
    if (!row.name || !row.amount || !row.date) return onToast?.('שם, סכום ותאריך חובה', 'error');
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
    if (!newForm.name || !newForm.amount || !newForm.date) return onToast?.('שם, סכום ותאריך חובה', 'error');
    setNewSaving(true);
    try {
      await api.create({ ...newForm, amount: parseFloat(newForm.amount) });
      onToast?.('נוסף ✓');
      setShowNew(false);
      setNewForm({ ...EMPTY, date: todayStr() });
      load();
    } catch (e) { onToast?.(e.message, 'error'); }
    finally { setNewSaving(false); }
  }

  const total = list.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const catBreakdown = list.reduce((acc, r) => {
    const k = r.category || 'כללי';
    acc[k] = (acc[k] || 0) + parseFloat(r.amount || 0);
    return acc;
  }, {});

  const inp = {
    border: '1px solid #d1d5db', borderRadius: 5,
    padding: '4px 7px', fontSize: '.84rem', fontFamily: 'inherit',
    direction: 'rtl', background: '#fffbeb', width: '100%',
  };

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:'1rem', marginBottom:'1.2rem', flexWrap:'wrap' }}>
        <h3 style={{ margin:0 }}>📊 הוצאות משתנות</h3>
        <select className="form-input" style={{ width:'auto' }} value={year} onChange={e => setYear(+e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-input" style={{ width:'auto' }} value={monthF} onChange={e => setMonthF(e.target.value)}>
          <option value="">כל החודשים</option>
          {MONTHS.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <button className="btn" onClick={() => setShowNew(true)}>+ הוצאה חדשה</button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', marginBottom:'1.5rem' }}>
        <div className="card" style={{ padding:'1rem', textAlign:'center', borderTop:'3px solid #dc2626' }}>
          <div style={{ fontSize:'1.4rem', fontWeight:700, color:'#dc2626' }}>{nis(total)}</div>
          <div style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>סה"כ הוצאות</div>
        </div>
        <div className="card" style={{ padding:'1rem', textAlign:'center', borderTop:'3px solid #7c3aed' }}>
          <div style={{ fontSize:'1.4rem', fontWeight:700, color:'#7c3aed' }}>{list.length}</div>
          <div style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>מספר פעולות</div>
        </div>
        <div className="card" style={{ padding:'1rem', borderTop:'3px solid #1e40af' }}>
          <div style={{ fontSize:'.75rem', color:'var(--muted)', marginBottom:'.4rem', fontWeight:600 }}>לפי קטגוריה</div>
          {Object.entries(catBreakdown).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([cat,amt]) => (
            <div key={cat} style={{ display:'flex', justifyContent:'space-between', fontSize:'.8rem' }}>
              <span>{cat}</span><span style={{ fontWeight:700 }}>{nis(amt)}</span>
            </div>
          ))}
        </div>
      </div>

      {loading && <div className="spinner" />}

      {!loading && list.length === 0 && (
        <div className="empty-state"><div className="empty-icon">📊</div><p>אין הוצאות לתקופה זו</p></div>
      )}

      {!loading && list.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>תאריך</th>
                <th>שם / פירוט</th>
                <th>קטגוריה</th>
                <th>סכום</th>
                <th>הערות</th>
                <th style={{ width:130 }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {list.map(row => {
                const editing  = !!editRows[row.id];
                const e        = editRows[row.id] || row;
                const isSaving = !!saving[row.id];

                return (
                  <tr key={row.id} style={{ background: editing ? '#fffdf0' : '' }}>
                    <td style={{ padding: editing ? '3px 6px' : '' }}>
                      {editing
                        ? <input style={{...inp, width:120}} type="date" value={e.date} onChange={ev => setCell(row.id,'date',ev.target.value)} />
                        : <span style={{ fontSize:'.85rem' }}>{row.date?.slice(0,10) || '-'}</span>}
                    </td>
                    <td style={{ padding: editing ? '3px 6px' : '' }}>
                      {editing
                        ? <input style={inp} value={e.name} onChange={ev => setCell(row.id,'name',ev.target.value)} />
                        : <strong>{row.name}</strong>}
                    </td>
                    <td style={{ padding: editing ? '3px 6px' : '' }}>
                      {editing
                        ? <input style={inp} value={e.category} onChange={ev => setCell(row.id,'category',ev.target.value)} />
                        : <span style={{ padding:'2px 8px', background:'#f3f4f6', borderRadius:8, fontSize:'.8rem' }}>{row.category}</span>}
                    </td>
                    <td style={{ padding: editing ? '3px 6px' : '' }}>
                      {editing
                        ? <input style={{...inp, width:90}} type="number" min="0" step="0.01" value={e.amount} onChange={ev => setCell(row.id,'amount',ev.target.value)} />
                        : <span style={{ fontWeight:700, color:'#dc2626' }}>{nis(row.amount)}</span>}
                    </td>
                    <td style={{ padding: editing ? '3px 6px' : '' }}>
                      {editing
                        ? <input style={inp} value={e.notes} onChange={ev => setCell(row.id,'notes',ev.target.value)} placeholder="הערות" />
                        : <span style={{ fontSize:'.85rem', color:'var(--muted)' }}>{row.notes || '-'}</span>}
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
                <td colSpan={3}>סה"כ</td>
                <td style={{ color:'#dc2626' }}>{nis(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add new modal */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:460 }}>
            <div className="modal-header">
              <h3>+ הוצאה חדשה</h3>
              <button className="modal-close" onClick={() => setShowNew(false)}>✕</button>
            </div>
            <div className="modal-body">
              {[['שם / פירוט *','text','name'],['קטגוריה','text','category'],['הערות','text','notes']].map(([lbl,type,key]) => (
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
                  <label className="form-label">תאריך *</label>
                  <input className="form-input" type="date" value={newForm.date} onChange={e => setNewForm(f=>({...f,date:e.target.value}))} />
                </div>
              </div>
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
