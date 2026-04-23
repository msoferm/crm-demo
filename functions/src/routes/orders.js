const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const pdfService = require('../services/pdf');

const router = express.Router();

function generateOrderNumber() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${yy}${mm}-${rand}`;
}

// GET /api/orders
router.get('/', async (req, res, next) => {
  try {
    const { status, client_id, from, to } = req.query;
    let where = [];
    const params = [];

    if (status) { params.push(status); where.push(`o.status=$${params.length}`); }
    if (client_id) { params.push(client_id); where.push(`o.client_id=$${params.length}`); }
    if (from) { params.push(from); where.push(`o.end_date>=$${params.length}`); }
    if (to) { params.push(to); where.push(`o.start_date<=$${params.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows: orders } = await pool.query(
      `SELECT o.*,
        c.name AS client_name_resolved,
        c.phone AS client_phone,
        c.email AS client_email,
        c.company AS client_company,
        (SELECT COALESCE(SUM(oi.quantity * oi.price_per_day * oi.days),0) FROM order_items oi WHERE oi.order_id=o.id) AS subtotal
       FROM orders o
       LEFT JOIN clients c ON c.id=o.client_id
       ${whereClause}
       ORDER BY o.start_date DESC`,
      params
    );

    // Load items for each order
    const orderIds = orders.map(o => o.id);
    let itemsByOrder = {};
    if (orderIds.length) {
      const { rows: items } = await pool.query(
        `SELECT * FROM order_items WHERE order_id = ANY($1)`,
        [orderIds]
      );
      items.forEach(item => {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      });
    }

    const result = orders.map(o => ({
      ...o,
      items: itemsByOrder[o.id] || [],
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [order] } = await pool.query(
      `SELECT o.*, c.name AS client_name_resolved, c.phone AS client_phone, c.email AS client_email, c.company AS client_company
       FROM orders o LEFT JOIN clients c ON c.id=o.client_id WHERE o.id=$1`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { rows: items } = await pool.query(
      'SELECT * FROM order_items WHERE order_id=$1 ORDER BY created_at',
      [req.params.id]
    );
    res.json({ ...order, items });
  } catch (err) { next(err); }
});

// POST /api/orders
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      client_id, event_name = '', location = '', start_date, end_date,
      status = 'draft', payment_status = 'unpaid', payment_method = '',
      discount_type = 'percent', discount_value = 0, notes = '',
      items = [], client_name = ''
    } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'תאריך התחלה וסיום הם שדות חובה' });
    }

    const order_number = generateOrderNumber();
    const { rows: [order] } = await client.query(
      `INSERT INTO orders
        (id, order_number, client_id, client_name, event_name, location, start_date, end_date,
         status, payment_status, payment_method, discount_type, discount_value, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [uuidv4(), order_number, client_id || null, client_name, event_name, location,
       start_date, end_date, status, payment_status, payment_method,
       discount_type, discount_value, notes]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (id, order_id, equipment_id, equipment_name, equipment_sku, quantity, price_per_day, days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uuidv4(), order.id, item.equipment_id || null, item.equipment_name,
         item.equipment_sku || '', item.quantity, item.price_per_day, item.days]
      );
    }

    await client.query('COMMIT');

    const { rows: orderItems } = await pool.query(
      'SELECT * FROM order_items WHERE order_id=$1', [order.id]
    );
    res.status(201).json({ ...order, items: orderItems });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PUT /api/orders/:id
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      client_id, event_name, location, start_date, end_date, status,
      payment_status, payment_method, discount_type, discount_value, notes,
      items, client_name
    } = req.body;

    const { rows: [order] } = await client.query(
      `UPDATE orders SET
        client_id=COALESCE($1,client_id), client_name=COALESCE($2,client_name),
        event_name=COALESCE($3,event_name), location=COALESCE($4,location),
        start_date=COALESCE($5,start_date), end_date=COALESCE($6,end_date),
        status=COALESCE($7,status), payment_status=COALESCE($8,payment_status),
        payment_method=COALESCE($9,payment_method), discount_type=COALESCE($10,discount_type),
        discount_value=COALESCE($11,discount_value), notes=COALESCE($12,notes)
       WHERE id=$13 RETURNING *`,
      [client_id, client_name, event_name, location, start_date, end_date,
       status, payment_status, payment_method, discount_type, discount_value,
       notes, req.params.id]
    );

    if (!order) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Order not found' }); }

    // Replace items if provided
    if (Array.isArray(items)) {
      await client.query('DELETE FROM order_items WHERE order_id=$1', [order.id]);
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (id, order_id, equipment_id, equipment_name, equipment_sku, quantity, price_per_day, days)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uuidv4(), order.id, item.equipment_id || null, item.equipment_name,
           item.equipment_sku || '', item.quantity, item.price_per_day, item.days]
        );
      }
    }

    await client.query('COMMIT');

    const { rows: orderItems } = await pool.query(
      'SELECT * FROM order_items WHERE order_id=$1', [order.id]
    );
    res.json({ ...order, items: orderItems });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// DELETE /api/orders/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/orders/:id/delivery-note  — returns HTML document
router.get('/:id/delivery-note', async (req, res, next) => {
  try {
    const { rows: [order] } = await pool.query(
      `SELECT o.*, c.name AS client_name_resolved, c.phone AS client_phone,
              c.email AS client_email, c.address AS client_address, c.company AS client_company
       FROM orders o LEFT JOIN clients c ON c.id=o.client_id WHERE o.id=$1`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { rows: items } = await pool.query(
      `SELECT oi.*, e.shelf_location, e.shelf_row
       FROM order_items oi LEFT JOIN equipment e ON e.id=oi.equipment_id
       WHERE oi.order_id=$1 ORDER BY oi.created_at`,
      [req.params.id]
    );

    pdfService.generateDeliveryNote({ ...order, items }, res);
  } catch (err) { next(err); }
});

// GET /api/orders/:id/return-note  — returns HTML document
router.get('/:id/return-note', async (req, res, next) => {
  try {
    const { rows: [order] } = await pool.query(
      `SELECT o.*, c.name AS client_name_resolved, c.phone AS client_phone,
              c.email AS client_email, c.address AS client_address, c.company AS client_company
       FROM orders o LEFT JOIN clients c ON c.id=o.client_id WHERE o.id=$1`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { rows: items } = await pool.query(
      `SELECT oi.*, e.shelf_location, e.shelf_row
       FROM order_items oi LEFT JOIN equipment e ON e.id=oi.equipment_id
       WHERE oi.order_id=$1 ORDER BY oi.created_at`,
      [req.params.id]
    );

    pdfService.generateReturnNote({ ...order, items }, res);
  } catch (err) { next(err); }
});

// POST /api/orders/:id/delivery-note-signed  — HTML with signature + checked items
router.post('/:id/delivery-note-signed', async (req, res, next) => {
  try {
    const { rows: [order] } = await pool.query(
      `SELECT o.*, c.name AS client_name_resolved, c.phone AS client_phone,
              c.email AS client_email, c.address AS client_address, c.company AS client_company
       FROM orders o LEFT JOIN clients c ON c.id=o.client_id WHERE o.id=$1`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { rows: items } = await pool.query(
      `SELECT oi.*, e.shelf_location, e.shelf_row
       FROM order_items oi LEFT JOIN equipment e ON e.id=oi.equipment_id
       WHERE oi.order_id=$1 ORDER BY oi.created_at`,
      [req.params.id]
    );

    pdfService.generateSignedDeliveryNote({ ...order, items }, req.body, res);
  } catch (err) { next(err); }
});

// POST /api/orders/:id/return-note-signed  — HTML with conditions + both signatures
router.post('/:id/return-note-signed', async (req, res, next) => {
  try {
    const { rows: [order] } = await pool.query(
      `SELECT o.*, c.name AS client_name_resolved, c.phone AS client_phone,
              c.email AS client_email, c.address AS client_address, c.company AS client_company
       FROM orders o LEFT JOIN clients c ON c.id=o.client_id WHERE o.id=$1`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { rows: items } = await pool.query(
      `SELECT oi.*, e.shelf_location, e.shelf_row
       FROM order_items oi LEFT JOIN equipment e ON e.id=oi.equipment_id
       WHERE oi.order_id=$1 ORDER BY oi.created_at`,
      [req.params.id]
    );

    // Save return log entries for missing/damaged tracking
    const formItems = req.body.items || [];
    for (const fi of formItems) {
      const orderItem = items.find(i => i.id === fi.id);
      if (!orderItem) continue;
      if (fi.condition !== 'ok' || (fi.returned_qty !== undefined && parseInt(fi.returned_qty) < orderItem.quantity)) {
        await pool.query(
          `INSERT INTO return_logs (id, order_id, order_number, client_name, equipment_name, ordered_qty, returned_qty, condition, notes)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            order.id, order.order_number,
            order.client_name_resolved || order.client_name || '',
            orderItem.equipment_name,
            orderItem.quantity,
            fi.returned_qty !== undefined ? parseInt(fi.returned_qty) : orderItem.quantity,
            fi.condition || 'ok',
            fi.notes || '',
          ]
        );
      }
    }

    pdfService.generateSignedReturnNote({ ...order, items }, req.body, res);
  } catch (err) { next(err); }
});

module.exports = router;
