const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/variable-expenses?year=2026&month=3&category=...
router.get('/', async (req, res, next) => {
  try {
    const { year, month, category } = req.query;
    const where = [];
    const params = [];

    if (year)     { params.push(year);     where.push(`EXTRACT(YEAR  FROM date) = $${params.length}`); }
    if (month)    { params.push(month);    where.push(`EXTRACT(MONTH FROM date) = $${params.length}`); }
    if (category) { params.push(category); where.push(`category = $${params.length}`); }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM variable_expenses ${clause} ORDER BY date DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/variable-expenses/categories
router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT category FROM variable_expenses ORDER BY category`
    );
    res.json(rows.map(r => r.category));
  } catch (err) { next(err); }
});

// POST /api/variable-expenses
router.post('/', async (req, res, next) => {
  try {
    const { name, amount, date, category = 'כללי', notes = '' } = req.body;
    if (!name || amount === undefined || !date) {
      return res.status(400).json({ error: 'שם, סכום ותאריך הם שדות חובה' });
    }
    const { rows: [row] } = await pool.query(
      `INSERT INTO variable_expenses (id, name, amount, date, category, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [uuidv4(), name, amount, date, category, notes]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// PUT /api/variable-expenses/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, amount, date, category, notes } = req.body;
    const { rows: [row] } = await pool.query(
      `UPDATE variable_expenses SET
         name=COALESCE($1,name), amount=COALESCE($2,amount),
         date=COALESCE($3,date), category=COALESCE($4,category),
         notes=COALESCE($5,notes)
       WHERE id=$6 RETURNING *`,
      [name, amount, date, category, notes, req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'לא נמצא' });
    res.json(row);
  } catch (err) { next(err); }
});

// DELETE /api/variable-expenses/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM variable_expenses WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'לא נמצא' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
