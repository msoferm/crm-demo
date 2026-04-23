const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/fixed-expenses
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM fixed_expenses ORDER BY active DESC, name ASC');
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/fixed-expenses
router.post('/', async (req, res, next) => {
  try {
    const { name, amount, frequency = 'monthly', category = 'כללי', notes = '', active = true } = req.body;
    if (!name || amount === undefined) return res.status(400).json({ error: 'שם וסכום הם שדות חובה' });

    const { rows: [row] } = await pool.query(
      `INSERT INTO fixed_expenses (id, name, amount, frequency, category, notes, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [uuidv4(), name, amount, frequency, category, notes, active]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// PUT /api/fixed-expenses/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, amount, frequency, category, notes, active } = req.body;
    const { rows: [row] } = await pool.query(
      `UPDATE fixed_expenses SET
         name=COALESCE($1,name), amount=COALESCE($2,amount),
         frequency=COALESCE($3,frequency), category=COALESCE($4,category),
         notes=COALESCE($5,notes), active=COALESCE($6,active)
       WHERE id=$7 RETURNING *`,
      [name, amount, frequency, category, notes, active, req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'לא נמצא' });
    res.json(row);
  } catch (err) { next(err); }
});

// DELETE /api/fixed-expenses/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM fixed_expenses WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'לא נמצא' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
