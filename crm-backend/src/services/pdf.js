// ── HTML-based document generator (replaces pdfkit — fully supports Hebrew) ──

const STATUS_LABELS = {
  draft: 'טיוטה', confirmed: 'מאושר', picked_up: 'נאסף',
  returned: 'הוחזר', cancelled: 'מבוטל',
};
const PAYMENT_LABELS = {
  unpaid: 'לא שולם', paid: 'שולם', partial: 'שולם חלקית',
};

function calcTotals(order) {
  const subtotal = (order.items || []).reduce(
    (sum, i) => sum + i.quantity * i.price_per_day * i.days, 0
  );
  let discount = 0;
  if (order.discount_type === 'percent') {
    discount = subtotal * (parseFloat(order.discount_value) / 100);
  } else {
    discount = parseFloat(order.discount_value) || 0;
  }
  return { subtotal, discount, total: Math.max(0, subtotal - discount) };
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('he-IL');
}

function nis(n) {
  return `₪${parseFloat(n || 0).toFixed(2)}`;
}

function baseStyles(accentColor = '#1e40af') {
  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: 'Heebo', Arial, sans-serif;
        direction: rtl;
        background: #f0f2f5;
        color: #111827;
        font-size: 14px;
      }
      .page {
        width: 210mm;
        min-height: 297mm;
        background: white;
        margin: 20px auto;
        box-shadow: 0 4px 32px rgba(0,0,0,.18);
        border-radius: 4px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      /* ── Header ── */
      .doc-header {
        background: ${accentColor};
        color: white;
        padding: 24px 32px 20px;
        text-align: center;
      }
      .doc-header h1 { font-size: 26px; font-weight: 800; margin-bottom: 6px; letter-spacing: .5px; }
      .doc-header .sub {
        font-size: 13px;
        opacity: .85;
        display: flex;
        justify-content: center;
        gap: 24px;
      }
      /* ── Body ── */
      .doc-body { padding: 24px 32px; flex: 1; }
      /* ── Info grid ── */
      .section-title {
        font-size: 13px;
        font-weight: 700;
        color: ${accentColor};
        border-bottom: 2px solid ${accentColor};
        padding-bottom: 4px;
        margin-bottom: 12px;
        margin-top: 18px;
      }
      .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 24px;
        margin-bottom: 4px;
      }
      .info-row { display: flex; gap: 6px; font-size: 13px; }
      .info-label { color: #6b7280; font-weight: 600; white-space: nowrap; min-width: 90px; }
      .info-value { color: #111827; }
      /* ── Table ── */
      table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 6px; }
      thead tr { background: ${accentColor}; color: white; }
      thead th { padding: 8px 10px; text-align: right; font-weight: 700; font-size: 12px; }
      tbody tr:nth-child(even) { background: #f9fafb; }
      tbody tr:nth-child(odd)  { background: #ffffff; }
      tbody td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
      .issue-row { background: #fffbeb !important; }
      /* ── Totals ── */
      .totals-box {
        display: flex;
        justify-content: flex-start;
        margin-top: 12px;
      }
      .totals-inner {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px 20px;
        min-width: 240px;
        font-size: 13px;
      }
      .totals-row { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 6px; color: #6b7280; }
      .totals-total {
        display: flex; justify-content: space-between; gap: 32px;
        font-size: 16px; font-weight: 800; color: ${accentColor};
        border-top: 2px solid ${accentColor}; padding-top: 8px; margin-top: 4px;
      }
      /* ── Signature area ── */
      .sig-area {
        display: flex;
        gap: 24px;
        margin-top: 28px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
      }
      .sig-box { flex: 1; }
      .sig-line {
        height: 64px;
        border: 1px dashed #9ca3af;
        border-radius: 6px;
        background: #fafafa;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .sig-line img { max-height: 60px; max-width: 100%; object-fit: contain; }
      .sig-label { font-size: 12px; color: #6b7280; text-align: center; font-weight: 600; }
      /* ── Alert banner ── */
      .alert-banner {
        background: #fef2f2;
        border: 1px solid #fca5a5;
        border-radius: 6px;
        padding: 10px 14px;
        color: #dc2626;
        font-weight: 700;
        font-size: 13px;
        margin: 10px 0;
      }
      /* ── Condition badges ── */
      .badge-ok      { color: #16a34a; font-weight: 700; }
      .badge-damaged { color: #d97706; font-weight: 700; }
      .badge-missing { color: #dc2626; font-weight: 700; }
      /* ── Checkbox ── */
      .check-yes { color: #16a34a; font-size: 16px; font-weight: 800; }
      .check-no  { color: #d1d5db; font-size: 14px; }
      /* ── Notes box ── */
      .notes-box {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 10px 14px;
        font-size: 13px;
        color: #374151;
        margin-top: 10px;
      }
      .notes-box strong { color: #6b7280; display: block; margin-bottom: 4px; font-size: 12px; }
      /* ── Footer ── */
      .doc-footer {
        background: #f3f4f6;
        padding: 10px 32px;
        text-align: center;
        font-size: 11px;
        color: #9ca3af;
        border-top: 1px solid #e5e7eb;
        margin-top: auto;
      }
      /* ── Print ── */
      @media print {
        body { background: white; }
        .page { margin: 0; box-shadow: none; border-radius: 0; width: 100%; min-height: 100vh; }
        @page { size: A4; margin: 12mm 14mm; }
      }
    </style>
  `;
}

function infoGrid(order) {
  const clientName = order.client_name_resolved || order.client_name || '-';
  const rows = [
    ['לקוח', clientName,                                         'אירוע',         order.event_name || '-'],
    ['טלפון', order.client_phone || '-',                        'חברה',          order.client_company || '-'],
    ['אימייל', order.client_email || '-',                       'מיקום',         order.location || '-'],
    ['תאריך איסוף', formatDate(order.start_date),               'תאריך החזרה',   formatDate(order.end_date)],
    ['סטטוס', STATUS_LABELS[order.status] || '-',               'תשלום',         PAYMENT_LABELS[order.payment_status] || '-'],
    ['אמצעי תשלום', order.payment_method || '-',                'נוצר',          formatDate(order.created_at)],
  ];

  const cells = rows.map(([l1, v1, l2, v2]) => `
    <div class="info-row"><span class="info-label">${l1}:</span><span class="info-value">${v1}</span></div>
    <div class="info-row"><span class="info-label">${l2}:</span><span class="info-value">${v2}</span></div>
  `).join('');

  let notesHtml = '';
  if (order.notes) {
    notesHtml = `<div class="notes-box"><strong>הערות הזמנה:</strong>${order.notes}</div>`;
  }

  return `<div class="section-title">פרטי הזמנה</div><div class="info-grid">${cells}</div>${notesHtml}`;
}

function totalsHtml(order) {
  const { subtotal, discount, total } = calcTotals(order);
  let discountRow = '';
  if (discount > 0) {
    const label = order.discount_type === 'percent'
      ? `הנחה (${parseFloat(order.discount_value)}%)`
      : 'הנחה';
    discountRow = `<div class="totals-row"><span>${label}</span><span style="color:#dc2626">-${nis(discount)}</span></div>`;
  }
  return `
    <div class="totals-box">
      <div class="totals-inner">
        <div class="totals-row"><span>סכום ביניים</span><span>${nis(subtotal)}</span></div>
        ${discountRow}
        <div class="totals-total"><span>סה"כ לתשלום</span><span>${nis(total)}</span></div>
        ${order.payment_method ? `<div style="font-size:12px;color:#9ca3af;margin-top:6px">אמצעי תשלום: ${order.payment_method}</div>` : ''}
      </div>
    </div>
  `;
}

function footerHtml(order) {
  return `
    <div class="doc-footer">
      מערכת ניהול השכרת ציוד &nbsp;|&nbsp; הזמנה: ${order.order_number} &nbsp;|&nbsp; הופק: ${new Date().toLocaleString('he-IL')}
    </div>
  `;
}

function wrapHtml(title, accentColor, bodyContent, order) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ${order.order_number}</title>
  ${baseStyles(accentColor)}
</head>
<body>
  <div class="page">
    <div class="doc-header">
      <h1>${title}</h1>
      <div class="sub">
        <span>מספר הזמנה: <strong>${order.order_number}</strong></span>
        <span>תאריך הפקה: <strong>${formatDate(new Date())}</strong></span>
      </div>
    </div>
    <div class="doc-body">
      ${infoGrid(order)}
      ${bodyContent}
    </div>
    ${footerHtml(order)}
  </div>
</body>
</html>`;
}

// ─── Delivery Note (blank for printing) ───────────────────────────────────────
function generateDeliveryNote(order, res) {
  const items = order.items || [];

  const rows = items.map((item, idx) => {
    const lineTotal = item.quantity * item.price_per_day * item.days;
    return `<tr>
      <td>${item.equipment_name || '-'}</td>
      <td>${item.equipment_sku || '-'}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:center">${item.days}</td>
      <td>${nis(item.price_per_day)}</td>
      <td>${nis(lineTotal)}</td>
      <td style="text-align:center">☐</td>
    </tr>`;
  }).join('');

  const body = `
    <div class="section-title">פריטי הזמנה</div>
    <table>
      <thead>
        <tr>
          <th>שם פריט</th>
          <th>מק"ט</th>
          <th style="text-align:center">כמות</th>
          <th style="text-align:center">ימים</th>
          <th>מחיר ליום</th>
          <th>סה"כ</th>
          <th style="text-align:center">✓ יצא</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#9ca3af">אין פריטים</td></tr>'}</tbody>
    </table>
    ${totalsHtml(order)}
    <div class="sig-area">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">חתימת מחסנאי</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">תאריך</div>
      </div>
    </div>
  `;

  const html = wrapHtml('תעודת הספקה', '#1e40af', body, order);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

// ─── Return Note (blank for printing) ─────────────────────────────────────────
function generateReturnNote(order, res) {
  const items = order.items || [];

  const rows = items.map(item => {
    const loc = [item.shelf_location, item.shelf_row].filter(Boolean).join(' - ') || '-';
    return `<tr>
      <td>${item.equipment_name || '-'}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:center">___</td>
      <td style="text-align:center">
        ○ תקין &nbsp; ○ פגום &nbsp; ○ חסר
      </td>
      <td></td>
    </tr>`;
  }).join('');

  const body = `
    <div class="section-title">רשימת ציוד לבדיקה</div>
    <table>
      <thead>
        <tr>
          <th>שם פריט</th>
          <th style="text-align:center">כמות הוזמן</th>
          <th style="text-align:center">כמות הוחזרה</th>
          <th style="text-align:center">מצב הציוד</th>
          <th>הערה</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af">אין פריטים</td></tr>'}</tbody>
    </table>
    <div class="sig-area">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">חתימת מחסנאי</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">חתימת לקוח</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">תאריך</div>
      </div>
    </div>
  `;

  const html = wrapHtml('טופס החזרה', '#7c3aed', body, order);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

// ─── Signed Delivery Note ─────────────────────────────────────────────────────
function generateSignedDeliveryNote(order, formData, res) {
  const itemStates = formData.items || [];
  const items = (order.items || []).map(item => {
    const state = itemStates.find(s => s.id === item.id) || {};
    return { ...item, _checked: !!state.checked };
  });

  const rows = items.map(item => {
    const lineTotal = item.quantity * item.price_per_day * item.days;
    const checkMark = item._checked
      ? '<span class="check-yes">✓</span>'
      : '<span class="check-no">☐</span>';
    return `<tr>
      <td>${item.equipment_name || '-'}</td>
      <td>${item.equipment_sku || '-'}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:center">${item.days}</td>
      <td>${nis(item.price_per_day)}</td>
      <td>${nis(lineTotal)}</td>
      <td style="text-align:center">${checkMark}</td>
    </tr>`;
  }).join('');

  const notesHtml = formData.notes
    ? `<div class="notes-box"><strong>הערות:</strong>${formData.notes}</div>`
    : '';

  const wSig = formData.warehouse_signature
    ? `<img src="${formData.warehouse_signature}" alt="חתימה">`
    : '';

  const body = `
    <div class="section-title">פריטי הזמנה</div>
    <table>
      <thead>
        <tr>
          <th>שם פריט</th>
          <th>מק"ט</th>
          <th style="text-align:center">כמות</th>
          <th style="text-align:center">ימים</th>
          <th>מחיר ליום</th>
          <th>סה"כ</th>
          <th style="text-align:center">✓ יצא</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#9ca3af">אין פריטים</td></tr>'}</tbody>
    </table>
    ${totalsHtml(order)}
    ${notesHtml}
    <div class="sig-area">
      <div class="sig-box">
        <div class="sig-line">${wSig}</div>
        <div class="sig-label">חתימת מחסנאי</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">תאריך: ${formatDate(new Date())}</div>
      </div>
    </div>
  `;

  const html = wrapHtml('תעודת הספקה', '#1e40af', body, order);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

// ─── Signed Return Note ───────────────────────────────────────────────────────
function generateSignedReturnNote(order, formData, res) {
  const itemStates = formData.items || [];
  const items = (order.items || []).map(item => {
    const state = itemStates.find(s => s.id === item.id) || {};
    return {
      ...item,
      _returned_qty: state.returned_qty ?? item.quantity,
      _condition:    state.condition || 'ok',
      _notes:        state.notes || '',
    };
  });

  const condLabel = { ok: 'תקין ✓', damaged: 'פגום ⚠', missing: 'חסר ✗' };
  const condClass = { ok: 'badge-ok', damaged: 'badge-damaged', missing: 'badge-missing' };

  const issues = items.filter(i => i._condition !== 'ok' || i._returned_qty < i.quantity);
  const alertBanner = issues.length > 0
    ? `<div class="alert-banner">⚠ נמצאו בעיות: ${issues.length} פריט/ים עם חוסרים או נזקים</div>`
    : '';

  const rows = items.map(item => {
    const hasIssue = item._condition !== 'ok' || item._returned_qty < item.quantity;
    const qtyColor = item._returned_qty < item.quantity ? 'color:#dc2626;font-weight:700' : '';
    return `<tr class="${hasIssue ? 'issue-row' : ''}">
      <td>${item.equipment_name || '-'}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:center;${qtyColor}">${item._returned_qty}/${item.quantity}</td>
      <td style="text-align:center"><span class="${condClass[item._condition] || ''}">${condLabel[item._condition] || '-'}</span></td>
      <td style="color:#6b7280;font-size:12px">${item._notes || ''}</td>
    </tr>`;
  }).join('');

  const notesHtml = formData.notes
    ? `<div class="notes-box"><strong>הערות כלליות:</strong>${formData.notes}</div>`
    : '';

  const wSig = formData.warehouse_signature
    ? `<img src="${formData.warehouse_signature}" alt="חתימת מחסנאי">`
    : '';
  const cSig = formData.client_signature
    ? `<img src="${formData.client_signature}" alt="חתימת לקוח">`
    : '';

  const body = `
    ${alertBanner}
    <div class="section-title">רשימת ציוד לבדיקה</div>
    <table>
      <thead>
        <tr>
          <th>שם פריט</th>
          <th style="text-align:center">כמות הוזמן</th>
          <th style="text-align:center">כמות הוחזרה</th>
          <th style="text-align:center">מצב הציוד</th>
          <th>הערה</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af">אין פריטים</td></tr>'}</tbody>
    </table>
    ${notesHtml}
    <div class="sig-area">
      <div class="sig-box">
        <div class="sig-line">${wSig}</div>
        <div class="sig-label">חתימת מחסנאי</div>
      </div>
      <div class="sig-box">
        <div class="sig-line">${cSig}</div>
        <div class="sig-label">חתימת לקוח</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">תאריך: ${formatDate(new Date())}</div>
      </div>
    </div>
  `;

  const html = wrapHtml('טופס החזרה', '#7c3aed', body, order);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

module.exports = { generateDeliveryNote, generateReturnNote, generateSignedDeliveryNote, generateSignedReturnNote };
