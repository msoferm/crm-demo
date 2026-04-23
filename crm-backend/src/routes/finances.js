const express = require('express');
const pool = require('../db/pool');
const { syncFinanceBootstrap } = require('../services/financeBootstrap');

const router = express.Router();

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

function nis(n) {
  return parseFloat(n || 0);
}

function monthRowsToList(rows, mapper) {
  return MONTH_NAMES.map((label, index) => {
    const row = rows.find((item) => item.month === index + 1) || {};
    return mapper(label, index + 1, row);
  });
}

async function tableHasRows(tableName, whereClause = '', params = []) {
  const sql = `SELECT EXISTS(SELECT 1 FROM ${tableName}${whereClause ? ` WHERE ${whereClause}` : ''}) AS present`;
  const { rows } = await pool.query(sql, params);
  return rows[0]?.present;
}

function fixedMonthly(expense) {
  const amt = nis(expense.amount);
  if (expense.frequency === 'annual') return amt / 12;
  if (expense.frequency === 'quarterly') return amt / 3;
  return amt;
}

async function getImportedAnnualSummary(year) {
  const { rows } = await pool.query(
    `SELECT
       summary_month AS month,
       month_label,
       revenue,
       fixed_expenses,
       variable_expenses,
       profit
     FROM finance_monthly_summaries
     WHERE summary_year = $1
     ORDER BY summary_month`,
    [year]
  );

  if (!rows.length) return null;

  const months = monthRowsToList(rows, (label, month, row) => {
    const revenue = nis(row.revenue);
    const fixedExpenses = nis(row.fixed_expenses);
    const variableExpenses = nis(row.variable_expenses);
    const totalExpenses = fixedExpenses + variableExpenses;

    return {
      month,
      label,
      revenue,
      fixed_expenses: fixedExpenses,
      variable_expenses: variableExpenses,
      total_expenses: totalExpenses,
      profit: row.profit !== undefined && row.profit !== null ? nis(row.profit) : revenue - totalExpenses,
      orders_count: 0,
    };
  });

  const totals = months.reduce((acc, month) => ({
    revenue: acc.revenue + month.revenue,
    fixed_expenses: acc.fixed_expenses + month.fixed_expenses,
    variable_expenses: acc.variable_expenses + month.variable_expenses,
    total_expenses: acc.total_expenses + month.total_expenses,
    profit: acc.profit + month.profit,
    orders_count: 0,
  }), {
    revenue: 0,
    fixed_expenses: 0,
    variable_expenses: 0,
    total_expenses: 0,
    profit: 0,
    orders_count: 0,
  });

  return { year, months, totals, imported: true };
}

async function getComputedAnnualSummary(year) {
  const { rows: revRows } = await pool.query(
    `SELECT
       EXTRACT(MONTH FROM o.start_date)::int AS month,
       COUNT(o.id) AS orders_count,
       COALESCE(SUM(oi.quantity * oi.price_per_day * oi.days), 0) AS revenue
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE EXTRACT(YEAR FROM o.start_date) = $1
       AND o.status NOT IN ('cancelled')
     GROUP BY 1
     ORDER BY 1`,
    [year]
  );

  const { rows: fixedRows } = await pool.query('SELECT * FROM fixed_expenses WHERE active = true');
  const fixedPerMonth = fixedRows.reduce((sum, expense) => sum + fixedMonthly(expense), 0);

  const { rows: variableRows } = await pool.query(
    `SELECT EXTRACT(MONTH FROM date)::int AS month, COALESCE(SUM(amount), 0) AS total
     FROM variable_expenses
     WHERE EXTRACT(YEAR FROM date) = $1
     GROUP BY 1`,
    [year]
  );

  const months = monthRowsToList(revRows, (label, month, row) => {
    const variableRow = variableRows.find((item) => item.month === month) || {};
    const revenue = nis(row.revenue);
    const fixedExpenses = parseFloat(fixedPerMonth.toFixed(2));
    const variableExpenses = nis(variableRow.total);
    const totalExpenses = fixedExpenses + variableExpenses;

    return {
      month,
      label,
      revenue,
      fixed_expenses: fixedExpenses,
      variable_expenses: variableExpenses,
      total_expenses: totalExpenses,
      profit: revenue - totalExpenses,
      orders_count: parseInt(row.orders_count, 10) || 0,
    };
  });

  const totals = months.reduce((acc, month) => ({
    revenue: acc.revenue + month.revenue,
    fixed_expenses: acc.fixed_expenses + month.fixed_expenses,
    variable_expenses: acc.variable_expenses + month.variable_expenses,
    total_expenses: acc.total_expenses + month.total_expenses,
    profit: acc.profit + month.profit,
    orders_count: acc.orders_count + month.orders_count,
  }), {
    revenue: 0,
    fixed_expenses: 0,
    variable_expenses: 0,
    total_expenses: 0,
    profit: 0,
    orders_count: 0,
  });

  return { year, months, totals, imported: false };
}

async function getAnnualSummaryData(year) {
  return (await getImportedAnnualSummary(year)) || getComputedAnnualSummary(year);
}

router.post('/import-bootstrap', async (req, res, next) => {
  try {
    const result = await syncFinanceBootstrap();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/revenue', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const useImported = await tableHasRows(
      'finance_income_entries',
      'EXTRACT(YEAR FROM COALESCE(payment_date, delivery_date)) = $1',
      [year]
    );

    if (useImported) {
      const { rows } = await pool.query(
        `SELECT
           EXTRACT(MONTH FROM COALESCE(payment_date, delivery_date))::int AS month,
           COUNT(*) AS orders_count,
           SUM(CASE WHEN amount_paid >= amount_before_vat AND amount_before_vat > 0 THEN amount_before_vat ELSE 0 END) AS paid,
           SUM(CASE WHEN amount_paid > 0 AND amount_paid < amount_before_vat THEN amount_before_vat ELSE 0 END) AS partial,
           SUM(CASE WHEN amount_paid <= 0 THEN amount_before_vat ELSE 0 END) AS unpaid,
           SUM(amount_before_vat) AS total
         FROM finance_income_entries
         WHERE EXTRACT(YEAR FROM COALESCE(payment_date, delivery_date)) = $1
         GROUP BY 1
         ORDER BY 1`,
        [year]
      );

      const months = monthRowsToList(rows, (label, month, row) => ({
        month,
        label,
        orders_count: parseInt(row.orders_count, 10) || 0,
        paid: nis(row.paid),
        partial: nis(row.partial),
        unpaid: nis(row.unpaid),
        total: nis(row.total),
      }));

      return res.json({ year, months, imported: true });
    }

    const { rows } = await pool.query(
      `SELECT
         EXTRACT(MONTH FROM o.start_date)::int AS month,
         COUNT(o.id) AS orders_count,
         SUM(CASE WHEN o.payment_status = 'paid' THEN totals.t ELSE 0 END) AS paid,
         SUM(CASE WHEN o.payment_status = 'partial' THEN totals.t ELSE 0 END) AS partial,
         SUM(CASE WHEN o.payment_status = 'unpaid' THEN totals.t ELSE 0 END) AS unpaid,
         SUM(totals.t) AS total
       FROM orders o
       JOIN LATERAL (
         SELECT COALESCE(SUM(oi.quantity * oi.price_per_day * oi.days), 0) AS t
         FROM order_items oi
         WHERE oi.order_id = o.id
       ) totals ON true
       WHERE EXTRACT(YEAR FROM o.start_date) = $1
         AND o.status NOT IN ('cancelled')
       GROUP BY 1
       ORDER BY 1`,
      [year]
    );

    const months = monthRowsToList(rows, (label, month, row) => ({
      month,
      label,
      orders_count: parseInt(row.orders_count, 10) || 0,
      paid: nis(row.paid),
      partial: nis(row.partial),
      unpaid: nis(row.unpaid),
      total: nis(row.total),
    }));

    res.json({ year, months, imported: false });
  } catch (err) {
    next(err);
  }
});

router.get('/open-payments', async (req, res, next) => {
  try {
    const useImported = await tableHasRows('finance_open_payment_entries');
    if (useImported) {
      const { rows } = await pool.query(
        `SELECT
           id,
           entry_date AS date,
           entry_date_raw AS date_label,
           client_name,
           amount_before_vat,
           amount_paid,
           payment_type,
           return_status,
           notes,
           linked_expenses,
           balance
         FROM finance_open_payment_entries
         WHERE client_name <> ''
           AND balance > 0
         ORDER BY entry_date ASC NULLS LAST, client_name ASC`
      );

      return res.json(rows.map((row) => ({
        ...row,
        is_imported: true,
      })));
    }

    const { rows } = await pool.query(
      `SELECT o.*,
         c.name AS client_name_resolved,
         c.phone AS client_phone,
         COALESCE(SUM(oi.quantity * oi.price_per_day * oi.days), 0) AS total
       FROM orders o
       LEFT JOIN clients c ON c.id = o.client_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.payment_status IN ('unpaid', 'partial')
         AND o.status NOT IN ('cancelled')
       GROUP BY o.id, c.name, c.phone
       ORDER BY o.end_date ASC`
    );

    const result = rows.map((order) => {
      const total = nis(order.total);
      let balance = total;
      if (order.payment_status === 'partial') balance = total * 0.5;
      return { ...order, total, balance, is_imported: false };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/missing-items', async (req, res, next) => {
  try {
    const useImported = await tableHasRows('finance_shortage_entries');
    if (useImported) {
      const { condition, from, to } = req.query;
      const where = ["client_name <> ''"];
      const params = [];

      if (condition && condition !== 'all') {
        params.push(condition);
        where.push(`return_status = $${params.length}`);
      }
      if (from) {
        params.push(from);
        where.push(`entry_date >= $${params.length}`);
      }
      if (to) {
        params.push(to);
        where.push(`entry_date <= $${params.length}`);
      }

      const { rows } = await pool.query(
        `SELECT
           id,
           entry_date AS date,
           entry_date_raw AS date_label,
           client_name,
           amount_before_vat,
           amount_paid,
           payment_type,
           return_status,
           notes,
           linked_expenses
         FROM finance_shortage_entries
         WHERE ${where.join(' AND ')}
         ORDER BY entry_date DESC NULLS LAST, id DESC`,
        params
      );

      return res.json(rows.map((row) => ({
        ...row,
        is_imported: true,
      })));
    }

    const { condition, from, to } = req.query;
    const params = [];
    const where = ["rl.condition != 'ok' OR rl.returned_qty < rl.ordered_qty"];

    if (condition && condition !== 'all') {
      params.push(condition);
      where.push(`rl.condition = $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`rl.logged_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`rl.logged_at <= $${params.length}`);
    }

    const { rows } = await pool.query(
      `SELECT rl.* FROM return_logs rl
       WHERE ${where.join(' AND ')}
       ORDER BY rl.logged_at DESC`,
      params
    );

    res.json(rows.map((row) => ({ ...row, is_imported: false })));
  } catch (err) {
    next(err);
  }
});

router.get('/fixed-expenses', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const { rows } = await pool.query(
      `SELECT month_date, month_label, category, amount
       FROM finance_fixed_expense_entries
       WHERE EXTRACT(YEAR FROM month_date) = $1
       ORDER BY month_date ASC, category ASC`,
      [year]
    );

    const months = MONTH_NAMES.map((label, index) => {
      const month = index + 1;
      const entries = rows
        .filter((row) => new Date(row.month_date).getUTCMonth() + 1 === month)
        .map((row) => ({
          category: row.category,
          amount: nis(row.amount),
          month_label: row.month_label,
        }));

      return {
        month,
        label,
        month_label: entries[0]?.month_label || `${label} ${year}`,
        total: entries.reduce((sum, item) => sum + item.amount, 0),
        entries,
      };
    });

    const categoriesMap = new Map();
    rows.forEach((row) => {
      categoriesMap.set(row.category, (categoriesMap.get(row.category) || 0) + nis(row.amount));
    });

    const categories = Array.from(categoriesMap.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    const yearTotal = months.reduce((sum, month) => sum + month.total, 0);
    const activeMonths = months.filter((month) => month.total > 0).length;

    res.json({
      year,
      imported: rows.length > 0,
      months,
      categories,
      totals: {
        year_total: yearTotal,
        average_monthly: activeMonths ? yearTotal / activeMonths : 0,
        active_months: activeMonths,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/variable-expenses', async (req, res, next) => {
  try {
    const { year, month, category } = req.query;
    const where = [];
    const params = [];

    if (year) {
      params.push(year);
      where.push(`EXTRACT(YEAR FROM entry_date) = $${params.length}`);
    }
    if (month) {
      params.push(month);
      where.push(`EXTRACT(MONTH FROM entry_date) = $${params.length}`);
    }
    if (category) {
      params.push(category);
      where.push(`category = $${params.length}`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT
         id,
         entry_date AS date,
         category,
         name,
         amount,
         amount_after_vat,
         notes
       FROM finance_variable_expense_entries
       ${clause}
       ORDER BY entry_date DESC NULLS LAST, id DESC`,
      params
    );

    const { rows: categoryRows } = await pool.query(
      `SELECT DISTINCT category
       FROM finance_variable_expense_entries
       WHERE category <> ''
       ORDER BY category`
    );

    res.json({
      imported: rows.length > 0 || (await tableHasRows('finance_variable_expense_entries')),
      categories: categoryRows.map((row) => row.category),
      entries: rows,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/annual-summary', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const prevYear = year - 1;

    const [current, previous] = await Promise.all([
      getAnnualSummaryData(year),
      getAnnualSummaryData(prevYear),
    ]);

    const expenseCategoryTable = await tableHasRows('finance_variable_expense_entries')
      ? 'finance_variable_expense_entries'
      : 'variable_expenses';
    const expenseCategoryDateColumn = expenseCategoryTable === 'finance_variable_expense_entries' ? 'entry_date' : 'date';

    const { rows: categoryRows } = await pool.query(
      `SELECT category, SUM(amount) AS total
       FROM ${expenseCategoryTable}
       WHERE EXTRACT(YEAR FROM ${expenseCategoryDateColumn}) = $1
       GROUP BY category
       ORDER BY total DESC`,
      [year]
    );

    res.json({
      ...current,
      prev_year: previous,
      expense_categories: categoryRows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
