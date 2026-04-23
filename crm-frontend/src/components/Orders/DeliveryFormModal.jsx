import React, { useState } from 'react';
import { formatDate, formatCurrency, calcOrderTotals } from '../../utils/helpers.js';
import SignaturePad from './SignaturePad.jsx';

const STATUS_LABELS = { draft:'טיוטה', confirmed:'מאושר', picked_up:'נאסף', returned:'הוחזר', cancelled:'מבוטל' };
const PAYMENT_LABELS = { unpaid:'לא שולם', paid:'שולם', partial:'שולם חלקית' };

function heDate(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' }) : '-';
}

const PRINT_STYLE = `
  @page { size: A4; margin: 14mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial Hebrew', Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; direction: rtl; background: white; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid #1e40af; margin-bottom: 14px; }
  .doc-title-block { text-align: center; flex: 1; }
  .doc-title { font-size: 1.6rem; font-weight: 700; color: #1e40af; letter-spacing: -0.5px; }
  .doc-subtitle { font-size: .82rem; color: #6b7280; margin-top: 3px; }
  .doc-badge { background: #1e40af; color: white; padding: 8px 14px; border-radius: 8px; text-align: center; min-width: 130px; }
  .doc-badge .b-label { font-size: .65rem; opacity: .8; text-transform: uppercase; letter-spacing: .5px; }
  .doc-badge .b-value { font-size: .95rem; font-weight: 700; margin-top: 2px; }
  .info-box { border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; margin-bottom: 14px; }
  .info-box-title { background: #f3f4f6; padding: 6px 12px; font-size: .78rem; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid #e5e7eb; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; }
  .info-row { display: flex; border-bottom: 1px solid #f1f5f9; font-size: .84rem; }
  .info-row:last-child { border-bottom: none; }
  .info-row:nth-child(odd) { border-left: 1px solid #f1f5f9; }
  .i-lbl { background: #fafafa; padding: 5px 10px; font-weight: 600; color: #6b7280; min-width: 95px; border-left: 1px solid #f1f5f9; font-size: .78rem; display: flex; align-items: center; }
  .i-val { padding: 5px 10px; color: #111827; flex: 1; display: flex; align-items: center; }
  .section-title { font-size: .88rem; font-weight: 700; color: #1e40af; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 2px solid #dbeafe; display: flex; align-items: center; gap: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: .8rem; }
  thead tr { background: #1e3a8a; }
  th { color: white; padding: 7px 9px; text-align: right; font-weight: 600; font-size: .78rem; }
  td { padding: 6px 9px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tbody tr:hover td { background: #eff6ff; }
  .checked-row td { background: #f0fdf4 !important; }
  .check-cell { font-size: 1.1rem; text-align: center; font-weight: 700; }
  .totals-wrap { display: flex; justify-content: flex-start; margin: 10px 0 14px; }
  .totals-box { border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; min-width: 240px; }
  .t-row { display: flex; justify-content: space-between; padding: 5px 12px; font-size: .84rem; border-bottom: 1px solid #f1f5f9; }
  .t-row:last-child { border-bottom: none; background: #eff6ff; font-weight: 700; font-size: .95rem; color: #1e40af; padding: 7px 12px; }
  .t-row.discount .t-val { color: #dc2626; }
  .notes-box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 12px; font-size: .84rem; color: #374151; min-height: 40px; white-space: pre-wrap; background: #fafafa; margin-bottom: 14px; }
  .sigs-section { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  .sig-block .sig-label { font-size: .75rem; color: #6b7280; font-weight: 600; margin-bottom: 8px; }
  .sig-area { min-height: 65px; border-bottom: 1.5px solid #374151; display: flex; align-items: flex-end; padding-bottom: 4px; }
  .sig-area img { max-height: 58px; }
  .sig-name { font-size: .72rem; color: #9ca3af; margin-top: 4px; }
  .doc-footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: .68rem; color: #9ca3af; }
`;

export default function DeliveryFormModal({ order, onClose }) {
  const [itemChecks, setItemChecks] = useState(
    (order.items || []).map(i => ({ ...i, checked: false }))
  );
  const [notes, setNotes] = useState(order.notes || '');
  const [warehouseSig, setWarehouseSig] = useState(null);
  const [saving, setSaving] = useState(false);
  const totals = calcOrderTotals(order);

  function toggleCheck(idx) {
    setItemChecks(prev => prev.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it));
  }

  function buildPrintHTML() {
    const rows = itemChecks.map(item => `
      <tr class="${item.checked ? 'checked-row' : ''}">
        <td>${item.equipment_name || ''}</td>
        <td>${item.equipment_sku || '-'}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:center">${item.days}</td>
        <td style="text-align:center">₪${parseFloat(item.price_per_day || 0).toFixed(2)}</td>
        <td style="text-align:center;font-weight:600">₪${(item.quantity * item.price_per_day * item.days).toFixed(2)}</td>
        <td class="check-cell" style="color:${item.checked ? '#16a34a' : '#d1d5db'}">${item.checked ? '✓' : '○'}</td>
      </tr>`).join('');

    const sigArea = warehouseSig
      ? `<div class="sig-area"><img src="${warehouseSig}" /></div>`
      : `<div class="sig-area"></div>`;

    const discountLine = totals.discount > 0
      ? `<div class="t-row discount"><span>הנחה</span><span class="t-val">-₪${totals.discount.toFixed(2)}</span></div>`
      : '';

    return `<!DOCTYPE html><html dir="rtl" lang="he"><head>
      <meta charset="utf-8"/>
      <title>תעודת הספקה — ${order.order_number}</title>
      <style>${PRINT_STYLE}</style>
    </head><body>
      <div class="doc-header">
        <div style="min-width:120px"></div>
        <div class="doc-title-block">
          <div class="doc-title">תעודת הספקה</div>
          <div class="doc-subtitle">אישור יציאת ציוד מהמחסן</div>
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
          <div class="info-row"><div class="i-lbl">סטטוס</div><div class="i-val">${STATUS_LABELS[order.status] || order.status || '-'}</div></div>
          <div class="info-row"><div class="i-lbl">אמצעי תשלום</div><div class="i-val">${order.payment_method || '-'}</div></div>
        </div>
      </div>

      <div class="section-title">📦 פריטי הזמנה</div>
      <table>
        <thead><tr>
          <th>שם פריט</th><th>מק"ט</th>
          <th style="text-align:center;width:50px">כמות</th>
          <th style="text-align:center;width:50px">ימים</th>
          <th style="text-align:center;width:70px">מחיר ליום</th>
          <th style="text-align:center;width:75px">סה"כ</th>
          <th style="text-align:center;width:40px">✓</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals-wrap">
        <div class="totals-box">
          <div class="t-row"><span>סכום ביניים</span><span>₪${totals.subtotal.toFixed(2)}</span></div>
          ${discountLine}
          <div class="t-row"><span>סה"כ לתשלום</span><span>₪${totals.total.toFixed(2)}</span></div>
        </div>
      </div>

      ${notes ? `<div class="section-title">📝 הערות</div><div class="notes-box">${notes.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>` : ''}

      <div class="sigs-section">
        <div class="sig-block">
          <div class="sig-label">חתימת מחסנאי</div>
          ${sigArea}
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
      const res = await fetch(`/api/orders/${order.id}/delivery-note-signed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemChecks.map(i => ({ id: i.id, checked: i.checked })),
          notes,
          warehouse_signature: warehouseSig,
        }),
      });
      if (!res.ok) throw new Error('שגיאה ביצירת PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `delivery-${order.order_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const checkedCount = itemChecks.filter(i => i.checked).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-xl doc-modal" onClick={e => e.stopPropagation()}>

        {/* ── Toolbar ── */}
        <div className="doc-toolbar">
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>🚚 תעודת הספקה</div>
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
              <div className="doc-info-cell"><span className="doc-lbl">טלפון</span><strong>{order.client_phone || '-'}</strong></div>
              <div className="doc-info-cell"><span className="doc-lbl">חברה</span>{order.client_company || '-'}</div>
              <div className="doc-info-cell"><span className="doc-lbl">אימייל</span>{order.client_email || '-'}</div>
              <div className="doc-info-cell"><span className="doc-lbl">אירוע</span><strong>{order.event_name || '-'}</strong></div>
              <div className="doc-info-cell"><span className="doc-lbl">מיקום</span>{order.location || '-'}</div>
              <div className="doc-info-cell"><span className="doc-lbl">תאריך איסוף</span><strong>{formatDate(order.start_date)}</strong></div>
              <div className="doc-info-cell"><span className="doc-lbl">תאריך החזרה</span><strong>{formatDate(order.end_date)}</strong></div>
            </div>
          </div>

          {/* ── פריטים ── */}
          <div className="doc-section-title">
            📦 פריטי הזמנה
            {checkedCount > 0 && (
              <span className="doc-badge-green">{checkedCount}/{itemChecks.length} סומנו כיצאו</span>
            )}
          </div>
          <div className="table-wrap" style={{ marginBottom: '1rem' }}>
            <table className="doc-table">
              <thead>
                <tr>
                  <th>שם פריט</th>
                  <th>מק"ט</th>
                  <th style={{ textAlign: 'center', width: '55px' }}>כמות</th>
                  <th style={{ textAlign: 'center', width: '50px' }}>ימים</th>
                  <th style={{ textAlign: 'center', width: '80px' }}>מחיר ליום</th>
                  <th style={{ textAlign: 'center', width: '85px' }}>סה"כ</th>
                  <th style={{ textAlign: 'center', width: '65px' }}>✓ יצא</th>
                </tr>
              </thead>
              <tbody>
                {itemChecks.map((item, idx) => (
                  <tr key={item.id} style={item.checked ? { background: '#f0fdf4' } : {}}>
                    <td style={{ fontWeight: 500 }}>{item.equipment_name}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '.78rem' }}>{item.equipment_sku || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'center' }}>{item.days}</td>
                    <td style={{ textAlign: 'center' }}>{formatCurrency(item.price_per_day)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {formatCurrency(item.quantity * item.price_per_day * item.days)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.3rem' }}>
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleCheck(idx)}
                          style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                        />
                        {item.checked && <span style={{ color: '#16a34a', fontSize: '.8rem', fontWeight: 700 }}>יצא</span>}
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── סיכום ── */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
            <div className="doc-totals-box">
              <div className="doc-totals-row">
                <span>סכום ביניים</span>
                <strong>{formatCurrency(totals.subtotal)}</strong>
              </div>
              {totals.discount > 0 && (
                <div className="doc-totals-row" style={{ color: 'var(--danger)' }}>
                  <span>הנחה</span>
                  <strong>-{formatCurrency(totals.discount)}</strong>
                </div>
              )}
              <div className="doc-totals-row doc-totals-final">
                <span>סה"כ לתשלום</span>
                <strong>{formatCurrency(totals.total)}</strong>
              </div>
            </div>
          </div>

          {/* ── הערות ── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div className="doc-section-title" style={{ marginBottom: '.5rem' }}>📝 הערות</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical', padding: '.6rem .75rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '.88rem', fontFamily: 'inherit' }}
              placeholder="הערות לתעודת ההספקה..."
            />
          </div>

          {/* ── חתימה ── */}
          <div className="doc-section-title" style={{ marginBottom: '.75rem' }}>✍️ חתימה</div>
          <div className="doc-sigs-row">
            <SignaturePad label="חתימת מחסנאי" onSign={setWarehouseSig} />
            <div className="doc-sig-placeholder">
              <div className="sig-pad-label">תאריך</div>
              <div className="doc-sig-line" style={{ marginTop: '2rem' }} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
