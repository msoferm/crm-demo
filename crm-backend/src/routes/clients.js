const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/clients
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients ORDER BY name ASC');
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/clients/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/clients/:id/orders
router.get('/:id/orders', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*,
        (SELECT COALESCE(SUM(oi.quantity * oi.price_per_day * oi.days),0) FROM order_items oi WHERE oi.order_id=o.id) AS subtotal
       FROM orders o WHERE o.client_id=$1 ORDER BY o.start_date DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/clients
router.post('/', async (req, res, next) => {
  try {
    const { name, company = '', email = '', phone = '', address = '', notes = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'שם לקוח הוא שדה חובה' });

    const { rows } = await pool.query(
      `INSERT INTO clients (id, name, company, email, phone, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [uuidv4(), name, company, email, phone, address, notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { name, company, email, phone, address, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE clients SET
        name=COALESCE($1,name), company=COALESCE($2,company),
        email=COALESCE($3,email), phone=COALESCE($4,phone),
        address=COALESCE($5,address), notes=COALESCE($6,notes)
       WHERE id=$7 RETURNING *`,
      [name, company, email, phone, address, notes, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res, next) => {
  try {
    // Check for active orders
    const { rows } = await pool.query(
      "SELECT COUNT(*) AS cnt FROM orders WHERE client_id=$1 AND status IN ('confirmed','picked_up')",
      [req.params.id]
    );
    if (parseInt(rows[0].cnt) > 0) {
      return res.status(409).json({ error: 'לא ניתן למחוק לקוח עם הזמנות פעילות' });
    }
    const { rowCount } = await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Client not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
