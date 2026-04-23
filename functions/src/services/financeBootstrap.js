const fs = require('fs');
const path = require('path');
const vm = require('vm');
const pool = require('../db/pool');

const BOOTSTRAP_CANDIDATES = [
  path.join(__dirname, '../../../excel-bootstrap-data.js'),
  path.join(__dirname, '../../excel-bootstrap-data.js'),
];
const HEBREW_MONTHS = {
  ינואר: 1,
  פברואר: 2,
  מרץ: 3,
  אפריל: 4,
  מאי: 5,
  יוני: 6,
  יולי: 7,
  אוגוסט: 8,
  ספטמבר: 9,
  אוקטובר: 10,
  נובמבר: 11,
  דצמבר: 12,
};

function hasBootstrapFile() {
  return BOOTSTRAP_CANDIDATES.some((candidate) => fs.existsSync(candidate));
}

function resolveBootstrapPath() {
  const match = BOOTSTRAP_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!match) {
    throw new Error('excel-bootstrap-data.js was not found');
  }
  return match;
}

function loadBootstrapData() {
  const source = fs.readFileSync(resolveBootstrapPath(), 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);

  if (!context.window.EXCEL_BOOTSTRAP_DATA) {
    throw new Error('excel-bootstrap-data.js does not expose EXCEL_BOOTSTRAP_DATA');
  }

  return context.window.EXCEL_BOOTSTRAP_DATA;
}

function toText(value) {
  return String(value ?? '').trim();
}

function parseNumber(value) {
  const raw = toText(value);
  if (!raw || raw === '#VALUE!') return 0;

  const normalized = raw.replace(/,/g, '');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function parseDate(value) {
  const raw = toText(value);
  if (!raw) return null;

  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseMonthLabel(value) {
  const raw = toText(value);
  const match = raw.match(/^(\S+)\s+(\d{4})$/);
  if (!match) return null;

  const [, monthName, yearText] = match;
  const month = HEBREW_MONTHS[monthName];
  if (!month) return null;

  return {
    year: Number(yearText),
    month,
    date: `${yearText}-${String(month).padStart(2, '0')}-01`,
    label: raw,
  };
}

function hasMeaningfulContent(row) {
  return Object.values(row || {}).some((value) => toText(value) !== '');
}

async function syncFinanceBootstrap(db = pool) {
  if (!hasBootstrapFile()) {
    return {
      imported: false,
      reason: 'bootstrap_missing',
    };
  }

  const data = loadBootstrapData();
  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const release = typeof db.connect === 'function';

  const counts = {
    incomes: 0,
    openPayments: 0,
    shortages: 0,
    fixedExpenses: 0,
    variableExpenses: 0,
    monthlySummaries: 0,
  };

  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE
        finance_income_entries,
        finance_open_payment_entries,
        finance_shortage_entries,
        finance_fixed_expense_entries,
        finance_variable_expense_entries,
        finance_monthly_summaries
      RESTART IDENTITY
    `);

    for (const [index, row] of (data.incomes?.rows || []).entries()) {
      if (!hasMeaningfulContent(row)) continue;

      await client.query(
        `INSERT INTO finance_income_entries
          (source_row, delivery_date, payment_date, client_name, amount_before_vat, amount_paid,
           payment_type, return_status, notes, linked_expenses)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          index + 1,
          parseDate(row['תאריך אספקה']),
          parseDate(row['תאריך תשלום']),
          toText(row['לקוח']),
          parseNumber(row['סכום לפני מע"מ']),
          parseNumber(row['שולם בפועל']),
          toText(row['סוג תשלום']),
          toText(row['חזר']),
          toText(row['הערות']),
          toText(row['הוצאות צמודות']),
        ]
      );
      counts.incomes += 1;
    }

    for (const [index, row] of (data.openPayments?.rows || []).entries()) {
      if (!hasMeaningfulContent(row)) continue;
      if (!toText(row['לקוח'])) continue;

      await client.query(
        `INSERT INTO finance_open_payment_entries
          (source_row, entry_date, entry_date_raw, client_name, amount_before_vat, amount_paid, payment_type,
           return_status, notes, linked_expenses, balance)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          index + 1,
          parseDate(row['תאריך: DD/MM/YYYY']),
          toText(row['תאריך: DD/MM/YYYY']),
          toText(row['לקוח']),
          parseNumber(row['סכום לפני מע"מ']),
          parseNumber(row['שולם בפועל']),
          toText(row['סוג תשלום']),
          toText(row['חזר']),
          toText(row['הערות']),
          toText(row['הוצאות צמודות']),
          parseNumber(row['יתרת תשלום']),
        ]
      );
      counts.openPayments += 1;
    }

    for (const [index, row] of (data.shortages?.rows || []).entries()) {
      if (!hasMeaningfulContent(row)) continue;
      if (!toText(row['לקוח'])) continue;

      await client.query(
        `INSERT INTO finance_shortage_entries
          (source_row, entry_date, entry_date_raw, client_name, amount_before_vat, amount_paid, payment_type,
           return_status, notes, linked_expenses)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          index + 1,
          parseDate(row['תאריך: DD/MM/YYYY']),
          toText(row['תאריך: DD/MM/YYYY']),
          toText(row['לקוח']),
          parseNumber(row['סכום לפני מע"מ']),
          parseNumber(row['שולם בפועל']),
          toText(row['סוג תשלום']),
          toText(row['חזר']),
          toText(row['הערות']),
          toText(row['הוצאות צמודות']),
        ]
      );
      counts.shortages += 1;
    }

    const fixedHeaders = (data.fixedExpenses?.headers || []).filter((header) => !['תאריך', 'סה"כ'].includes(header));
    for (const [index, row] of (data.fixedExpenses?.rows || []).entries()) {
      if (!hasMeaningfulContent(row)) continue;

      const monthInfo = parseMonthLabel(row['תאריך']);
      if (!monthInfo) continue;

      for (const header of fixedHeaders) {
        const amount = parseNumber(row[header]);
        if (!amount) continue;

        await client.query(
          `INSERT INTO finance_fixed_expense_entries
            (source_row, month_date, month_label, category, amount)
           VALUES ($1,$2,$3,$4,$5)`,
          [index + 1, monthInfo.date, monthInfo.label, header, amount]
        );
        counts.fixedExpenses += 1;
      }
    }

    for (const [index, row] of (data.variableExpenses?.rows || []).entries()) {
      if (!hasMeaningfulContent(row)) continue;

      const name = toText(row['פירוט']) || toText(row['קטגוריה']);
      const amount = parseNumber(row['סכום']);
      const amountAfterVat = parseNumber(row['סכום אחרי מעמ']);
      if (!name && !amount && !amountAfterVat) continue;

      await client.query(
        `INSERT INTO finance_variable_expense_entries
          (source_row, entry_date, category, name, amount, amount_after_vat, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          index + 1,
          parseDate(row['תאריך: DD/MM/YYYY']),
          toText(row['קטגוריה']),
          name,
          amount,
          amountAfterVat,
          toText(row['הערות']),
        ]
      );
      counts.variableExpenses += 1;
    }

    const summarySheets = [data.monthlySummary2025, data.monthlySummary2026].filter(Boolean);
    for (const summarySheet of summarySheets) {
      for (const row of summarySheet.rows || []) {
        const monthInfo = parseMonthLabel(row['חודש']);
        if (!monthInfo) continue;

        await client.query(
          `INSERT INTO finance_monthly_summaries
            (summary_year, summary_month, month_label, revenue, fixed_expenses, variable_expenses, profit)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (summary_year, summary_month) DO UPDATE SET
             month_label = EXCLUDED.month_label,
             revenue = EXCLUDED.revenue,
             fixed_expenses = EXCLUDED.fixed_expenses,
             variable_expenses = EXCLUDED.variable_expenses,
             profit = EXCLUDED.profit,
             imported_at = NOW()`,
          [
            monthInfo.year,
            monthInfo.month,
            monthInfo.label,
            parseNumber(row['הכנסות']),
            parseNumber(row['הוצאות קבועות']),
            parseNumber(row['הוצאות משתנות']),
            parseNumber(row['רווח']),
          ]
        );
        counts.monthlySummaries += 1;
      }
    }

    await client.query('COMMIT');

    return {
      imported: true,
      source: data.importedFrom || resolveBootstrapPath(),
      importedAt: data.importedAt || null,
      counts,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (release) client.release();
  }
}

module.exports = {
  BOOTSTRAP_PATH: BOOTSTRAP_CANDIDATES[0],
  hasBootstrapFile,
  loadBootstrapData,
  resolveBootstrapPath,
  syncFinanceBootstrap,
};
