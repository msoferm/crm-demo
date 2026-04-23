import React, { useState } from 'react';
import { formatDate } from '../../utils/helpers.js';
import SignaturePad from './SignaturePad.jsx';

const STATUS_LABELS  = { draft:'טיוטה', confirmed:'מאושר', picked_up:'נאסף', returned:'הוחזר', cancelled:'מבוטל' };
const PAYMENT_LABELS = { unpaid:'לא שולם', paid:'שולם', partial:'שולם חלקית' };

const CONDITIONS = [
  { value: 'ok',      label: 'תקין',  color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  { value: 'damaged', label: 'פגום',  color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  { value: 'missing', label: 'חסר',   color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
];

function heDate(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' }) : '-';
}

const PRINT_STYLE = `
  @page { size: A4; margin: 14mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial Hebrew', Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; direction: rtl; background: white; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid #7c3aed; margin-bottom: 14px; }
  .doc-title-block { text-align: center; flex: 1; }
  .doc-title { font-size: 1.6rem; font-weight: 700; color: #7c3aed; }
  .doc-subtitle { font-size: .82rem; color: #6b7280; margin-top: 3px; }
  .doc-badge { background: #7c3aed; color: white; padding: 8px 14px; border-radius: 8px; text-align: center; min-width: 130px; }
  .doc-badge .b-label { font-size: .65rem; opacity: .8; }
  .doc-badge .b-value { font-size: .95rem; font-weight: 700; margin-top: 2px; }
  .info-box { border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
  .info-box-title { background: #f3f4f6; padding: 6px 12px; font-size: .78rem; font-weight: 700; color: #374151; border-bottom: 1px solid #e5e7eb; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; }
  .info-row { display: flex; border-bottom: 1px solid #f1f5f9; font-size: .84rem; }
  .info-row:last-child { border-bottom: none; }
  .info-row:nth-child(odd) { border-left: 1px solid #f1f5f9; }
  .i-lbl { background: #fafafa; padding: 5px 10px; font-weight: 600; color: #6b7280; min-width: 95px; border-left: 1px solid #f1f5f9; font-size: .78rem; display: flex; align-items: center; }
  .i-val { padding: 5px 10px; color: #111827; flex: 1; display: flex; align-items: center; }
  .alert-box { background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: .84rem; }
  .alert-box strong { color: #dc2626; }
  .alert-box ul { margin: 6px 0 0; padding-right: 16px; }
  .alert-box li { margin-bottom: 3px; }
  .section-title { font-size: .88rem; font-weight: 700; color: #7c3aed; margin: 12px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #ede9fe; }
  table { width: 100%; border-collapse: collapse; font-size: .8rem; }
  thead tr { background: #5b21b6; }
  th { color: white; padding: 7px 9px; text-align: right; font-weight: 600; font-size: .78rem; }
  td { padding: 6px 9px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .issue-row td { background: #fffbeb !important; }
  .cond-ok { color: #16a34a; font-weight: 700; }
  .cond-damaged { color: #d97706; font-weight: 700; }
  .cond-missing { color: #dc2626; font-weight: 700; }
  .qty-short { color: #dc2626; font-weight: 700; }
  .notes-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 12px; font-size: .84rem; color: #374151; min-height: 40px; white-space: pre-wrap; background: #fafafa; margin-bottom: 14px; }
  .sigs-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  .sig-block .sig-label { font-size: .75rem; color: #6b7280; font-weight: 600; margin-bottom: 8px; }
  .sig-area { min-height: 65px; border-bottom: 1.5px solid #374151; display: flex; align-items: flex-end; padding-bottom: 4px; }
  .sig-area img { max-height: 58px; }
  .sig-name { font-size: .72rem; color: #9ca3af; margin-top: 4px; }
  .doc-footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: .68rem; color: #9ca3af; }
`;

function ConditionPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '.25rem' }}>
      {CONDITIONS.map(c => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          style={{
            padding: '.25rem .55rem',
            fontSize: '.75rem',
            borderRadius: '5px',
            border: `1px solid ${value === c.value ? c.color : '#e2e8f0'}`,
            background: value === c.value ? c.bg : 'white',
            color: value === c.value ? c.color : '#94a3b8',
            fontWeight: value === c.value ? 700 : 400,
            cursor: 'pointer',
            transition: 'all .15s',
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export default function ReturnFormModal({ order, onClose }) {
  const [items, setItems] = useState(
    (order.items || []).map(i => ({
      ...i,
      returned_qty: i.quantity,
      condition: 'ok',
      item_notes: '',
    }))
  );
  const [notes, setNotes] = useState('');
  const [warehouseSig, setWarehouseSig] = useState(null);
  const [clientSig, setClientSig]     = useState(null);
  const [saving, setSaving]           = useState(false);

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  const issueItems = items.filter(i => i.condition !== 'ok' || i.returned_qty < i.quantity);

  function buildPrintHTML() {
    const condClass = { ok: 'cond-ok', damaged: 'cond-damaged', missing: 'cond-missing' };
    const condText  = { ok: '✓ תקין', damaged: '⚠ פגום', missing: '✗ חסר' };

    const rows = items.map(item => {
      const hasIssue = item.condition !== 'ok' || item.returned_qty < item.quantity;
      return `
        <tr class="${hasIssue ? 'issue-row' : ''}">
          <td><strong>${item.equipment_name || ''}</strong></td>
          <td style="text-align:center">${item.quantity}</td>
          <td style="text-align:center" class="${item.returned_qty < item.quantity ? 'qty-short' : ''}">${item.returned_qty} / ${item.quantity}</td>
          <td class="${condClass[item.condition]}">${condText[item.condition]}</td>
          <td style="color:#6b7280;font-size:.78rem">${item.item_notes || ''}</td>
        </tr>`;
    }).join('');

    const wSigArea = warehouseSig
      ? `<div class="sig-area"><img src="${warehouseSig}" /></div>`
      : `<div class="sig-area"></div>`;
    const cSigArea = clientSig
      ? `<div class="sig-area"><img src="${clientSig}" /></div>`
      : `<div class="sig-area"></div>`;

    const issueBlock = issueItems.length > 0 ? `
      <div class="alert-box">
        <strong>⚠️ נמצאו בעיות — ${issueItems.length} פריט/ים:</strong>
        <ul>
          ${issueItems.map(i => `<li>
            <strong>${i.equipment_name}</strong>:
            ${i.condition === 'damaged' ? 'פגום' : i.condition === 'missing' ? 'חסר' : ''}
            ${i.returned_qty < i.quantity ? `— הוחזר ${i.returned_qty} מתוך ${i.quantity}` : ''}
            ${i.item_notes ? `— ${i.item_notes}` : ''}
          </li>`).join('')}
        </ul>
      </div>` : '';

    return `<!DOCTYPE html><html dir="rtl" lang="he"><head>
      <meta charset="utf-8"/>
      <title>טופס החזרה — ${order.order_number}</title>
      <style>${PRINT_STYLE}</style>
    </head><body>
      <div class="doc-header">
        <div style="min-width:120px"></div>
        <div class="doc-title-block">
          <div class="doc-title">טופס החזרה</div>
          <div class="doc-subtitle">אישור קבלת ציוד חזרה למחסן</div>
        </div>
        <div class="doc-badge">
          <div class="b-label">מספר הזמנה</div>
          <div class="b-value">${order.order_number}</div>
          <div class="b-label" style="margin-top:4px">תאריך הפקה</div>
          <div style="font-size:.78rem;margin-top:2px">${new Date().toLocaleDateString('he-IL')}</div>
        </div>
      </div>

      <div class="info-box">
        <div class="info-box-title">פרטי לקוח ואירוע</div>
        <div class="info-grid">
          <div class="info-row"><div class="i-lbl">שם לקוח</div><div class="i-val">${order.client_name_resolved || order.client_name || '-'}</div></div>
          <div class="info-row"><div class="i-lbl">טלפון</div><div class="i-val">${order.client_phone || '-'}</div></div>
          <div class="info-row"><div class="i-lbl">חברה</div><div class="i-val">${order.client_company || '-'}</div></div>
          <div class="info-row"><div class="i-lbl">אימייל</div><div class="i-val">${order.client_email || '-'}</div></div>
          <div class="info-row"><div class="i-lbl">שם האירוע</div><div class="i-val">${order.event_name || '-'}</div></div>
          <div class="info-row"><div class="i-lbl">מיקום</div><div class="i-val">${order.location || '-'}</div></div>
          <div class="info-row"><div class="i-lbl">תאריך איסוף</div><div class="i-val"><strong>${heDate(order.start_date)}</strong></div></div>
          <div class="info-row"><div class="i-lbl">תאריך החזרה</div><div class="i-val"><strong>${heDate(order.end_date)}</strong></div></div>
          <div class="info-row"><div class="i-lbl">סטטוס</div><div class="i-val">${STATUS_LABELS[order.status] || '-'}</div></div>
          <div class="info-row"><div class="i-lbl">סטטוס תשלום</div><div class="i-val">${PAYMENT_LABELS[order.payment_status] || '-'}</div></div>
        </div>
      </div>

      ${issueBlock}

      <div class="section-title">🔍 רשימת ציוד לבדיקה</div>
      <table>
        <thead><tr>
          <th>שם פריט</th>
          <th style="text-align:center;width:70px">כמות הוזמנה</th>
          <th style="text-align:center;width:80px">כמות הוחזרה</th>
          <th style="width:90px">מצב הציוד</th>
          <th>הערות</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      ${notes ? `<div class="section-title">📝 הערות כלליות</div><div class="notes-box">${notes.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>` : ''}

      <div class="sigs-section">
        <div class="sig-block">
          <div class="sig-label">חתימת מחסנאי</div>
          ${wSigArea}
          <div class="sig-name">שם: ___________________</div>
        </div>
        <div class="sig-block">
          <div class="sig-label">חתימת לקוח</div>
          ${cSigArea}
          <div class="sig-name">שם: ___________________</div>
        </div>
        <div class="sig-block">
          <div class="sig-label">תאריך</div>
          <div class="sig-area"></div>
          <div class="sig-name">&nbsp;</div>
        </div>
      </div>

      <div class="doc-footer">
        <span>מערכת ניהול השכרת ציוד</span>
        <span>הזמנה: ${order.order_number}</span>
        <span>הופק: ${new Date().toLocaleString('he-IL')}</span>
      </div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script>
    </body></html>`;
  }

  function handlePrint() {
    const win = window.open('', '_blank', 'width=900,height=750');
    if (!win) { alert('אנא אפשר חלונות קופצים בדפדפן'); return; }
    win.document.write(buildPrintHTML());
    win.document.close();
  }

  async function handleSavePDF() {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/return-note-signed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ id: i.id, returned_qty: i.returned_qty, condition: i.condition, notes: i.item_notes })),
          notes,
          warehouse_signature: warehouseSig,
          client_signature: clientSig,
        }),
      });
      if (!res.ok) throw new Error('שגיאה ביצירת PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `return-${order.order_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl doc-modal" onClick={e => e.stopPropagation()}>

        {/* ── Toolbar ── */}
        <div className="doc-toolbar">
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>🔙 טופס החזרה</div>
            <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '2px' }}>
              {order.order_number} &nbsp;·&nbsp; {order.client_name_resolved || order.client_name}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={handlePrint}>🖨️ הדפסה</button>
            <button className="btn btn-success" onClick={handleSavePDF} disabled={saving}>
              {saving ? '⏳' : '💾'} שמור PDF
            </button>
            <button className="btn btn-secondary" onClick={onClose} style={{ padding: '.4rem .8rem' }}>✕</button>
          </div>
        </div>

        <div className="doc-body">

          {/* ── פרטי הזמנה ── */}
          <div className="doc-info-box">
            <div className="doc-info-box-title">פרטי לקוח ואירוע</div>
            <div className="doc-info-grid-4">
              <div className="doc-info-cell"><span className="doc-lbl">לקוח</span><strong>{order.client_name_resolved || order.client_name || '-'}</strong></div>
              <div className="doc-info-cell"><span className="doc-lbl">טלפון</span>{order.client_phone || '-'}</div>
              <div className="doc-info-cell"><span className="doc-lbl">חברה</span>{order.client_company || '-'}</div>
              <div className="doc-info-cell"><span className="doc-lbl">אימייל</span>{order.client_email || '-'}</div>
              <div className="doc-info-cell"><span className="doc-lbl">אירוע</span><strong>{order.event_name || '-'}</strong></div>
              <div className="doc-info-cell"><span className="doc-lbl">מיקום</span>{order.location || '-'}</div>
              <div className="doc-info-cell"><span className="doc-lbl">תאריך איסוף</span><strong>{formatDate(order.start_date)}</strong></div>
              <div className="doc-info-cell"><span className="doc-lbl">תאריך החזרה</span><strong>{formatDate(order.end_date)}</strong></div>
            </div>
          </div>

          {/* ── בעיות ── */}
          {issueItems.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '.75rem 1rem', marginBottom: '1rem', fontSize: '.85rem' }}>
              <strong style={{ color: '#dc2626' }}>⚠️ נמצאו בעיות — {issueItems.length} פריט/ים</strong>
              <ul style={{ marginTop: '.4rem', paddingRight: '1rem' }}>
                {issueItems.map((i, idx) => (
                  <li key={idx} style={{ marginBottom: '.2rem' }}>
                    <strong>{i.equipment_name}</strong>:&nbsp;
                    {i.condition === 'damaged' && <span style={{ color: '#d97706' }}>פגום</span>}
                    {i.condition === 'missing' && <span style={{ color: '#dc2626' }}>חסר</span>}
                    {i.returned_qty < i.quantity && <span style={{ color: '#dc2626' }}> — הוחזר {i.returned_qty} מתוך {i.quantity}</span>}
                    {i.item_notes && <span style={{ color: '#6b7280' }}> — {i.item_notes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── פריטים ── */}
          <div className="doc-section-title" style={{ color: '#7c3aed', borderBottom: '2px solid #ede9fe' }}>
            🔍 רשימת ציוד לבדיקה
          </div>
          <div className="table-wrap" style={{ marginBottom: '1rem' }}>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>שם פריט</th>
                  <th style={{ textAlign: 'center', width: '75px' }}>הוזמן</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>הוחזר</th>
                  <th style={{ width: '150px' }}>מצב</th>
                  <th>הערה</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const hasIssue = item.condition !== 'ok' || item.returned_qty < item.quantity;
                  return (
                    <tr key={item.id} style={hasIssue ? { background: '#fffbeb' } : {}}>
                      <td style={{ fontWeight: 500 }}>{item.equipment_name}</td>
                      <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.3rem' }}>
                          <input
                            type="number"
                            min={0} max={item.quantity}
                            value={item.returned_qty}
                            onChange={e => updateItem(idx, 'returned_qty', Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0)))}
                            style={{
                              width: '50px', textAlign: 'center', padding: '.3rem .4rem',
                              border: `1px solid ${item.returned_qty < item.quantity ? '#f59e0b' : 'var(--border)'}`,
                              borderRadius: '5px', fontWeight: 600, fontSize: '.88rem',
                            }}
                          />
                          {item.returned_qty < item.quantity && (
                            <span style={{ color: '#dc2626', fontSize: '.72rem', fontWeight: 700 }}>
                              -{item.quantity - item.returned_qty}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <ConditionPicker value={item.condition} onChange={v => updateItem(idx, 'condition', v)} />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.item_notes}
                          onChange={e => updateItem(idx, 'item_notes', e.target.value)}
                          placeholder="הערה..."
                          style={{ width: '100%', padding: '.3rem .5rem', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '.82rem', fontFamily: 'inherit' }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── הערות ── */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="doc-section-title" style={{ color: '#7c3aed', borderBottom: '2px solid #ede9fe', marginBottom: '.5rem' }}>📝 הערות כלליות</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical', padding: '.6rem .75rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '.88rem', fontFamily: 'inherit' }}
              placeholder="הערות לטופס ההחזרה..."
            />
          </div>

          {/* ── חתימות ── */}
          <div className="doc-section-title" style={{ color: '#7c3aed', borderBottom: '2px solid #ede9fe', marginBottom: '.75rem' }}>✍️ חתימות</div>
          <div className="doc-sigs-row">
            <SignaturePad label="חתימת מחסנאי" onSign={setWarehouseSig} />
            <SignaturePad label="חתימת לקוח" onSign={setClientSig} />
          </div>

        </div>
      </div>
    </div>
  );
}
