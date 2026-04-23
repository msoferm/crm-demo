const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const wpService = require('../services/wordpress');

const router = express.Router();

// GET /api/equipment
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM equipment ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/equipment/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM equipment WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Equipment not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// GET /api/equipment/:id/availability?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/:id/availability', async (req, res, next) => {
  try {
    const { start, end, excludeOrderId } = req.query;
    const { rows: [equip] } = await pool.query('SELECT * FROM equipment WHERE id=$1', [req.params.id]);
    if (!equip) return res.status(404).json({ error: 'Equipment not found' });

    let query = `
      SELECT COALESCE(SUM(oi.quantity),0) AS reserved
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.equipment_id = $1
        AND o.status IN ('confirmed','picked_up','draft')
        AND o.start_date <= $3
        AND o.end_date >= $2
    `;
    const params = [req.params.id, start || '1970-01-01', end || '9999-12-31'];
    if (excludeOrderId) {
      query += ' AND o.id != $4';
      params.push(excludeOrderId);
    }

    const { rows } = await pool.query(query, params);
    const reserved = parseInt(rows[0].reserved || 0);
    const available = Math.max(0, equip.quantity - reserved);
    res.json({ total: equip.quantity, reserved, available });
  } catch (err) { next(err); }
});

// POST /api/equipment
router.post('/', async (req, res, next) => {
  try {
    const {
      name, sku = '', category = 'general', quantity = 1,
      price_per_day = 0, description = '', notes = '',
      image_url = '', shelf_location = '', shelf_row = '', damaged_qty = 0
    } = req.body;

    if (!name) return res.status(400).json({ error: 'שם ציוד הוא שדה חובה' });

    const { rows } = await pool.query(
      `INSERT INTO equipment
        (id, name, sku, category, quantity, price_per_day, description, notes,
         image_url, shelf_location, shelf_row, damaged_qty)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [uuidv4(), name, sku, category, quantity, price_per_day, description, notes,
       image_url, shelf_location, shelf_row, damaged_qty]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/equipment/:id
router.put('/:id', async (req, res, next) => {
  try {
    const {
      name, sku, category, quantity, price_per_day, description, notes,
      image_url, shelf_location, shelf_row, damaged_qty
    } = req.body;

    const { rows } = await pool.query(
      `UPDATE equipment SET
        name=COALESCE($1,name), sku=COALESCE($2,sku), category=COALESCE($3,category),
        quantity=COALESCE($4,quantity), price_per_day=COALESCE($5,price_per_day),
        description=COALESCE($6,description), notes=COALESCE($7,notes),
        image_url=COALESCE($8,image_url), shelf_location=COALESCE($9,shelf_location),
        shelf_row=COALESCE($10,shelf_row), damaged_qty=COALESCE($11,damaged_qty)
       WHERE id=$12 RETURNING *`,
      [name, sku, category, quantity, price_per_day, description, notes,
       image_url, shelf_location, shelf_row, damaged_qty, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Equipment not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/equipment/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM equipment WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Equipment not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/equipment/:id/sync  — sync single item to WooCommerce
router.post('/:id/sync', async (req, res, next) => {
  try {
    const { rows: [item] } = await pool.query('SELECT * FROM equipment WHERE id=$1', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Equipment not found' });

    const settingsRows = await pool.query("SELECT key, value FROM settings WHERE key IN ('wp_url','wp_consumer_key','wp_consumer_secret','wp_username','wp_app_password')");
    const settings = Object.fromEntries(settingsRows.rows.map(r => [r.key, r.value]));

    if (!settings.wp_url || !settings.wp_consumer_key) {
      return res.status(400).json({ error: 'הגדרות WordPress חסרות' });
    }

    const result = await wpService.syncEquipment(item, settings);

    await pool.query(
      'UPDATE equipment SET wp_product_id=$1, last_synced=$2 WHERE id=$3',
      [result.wp_product_id, new Date(), item.id]
    );

    res.json({ success: true, wp_product_id: result.wp_product_id });
  } catch (err) { next(err); }
});

// POST /api/equipment/sync-all
router.post('/sync-all', async (req, res, next) => {
  try {
    const { rows: items } = await pool.query('SELECT * FROM equipment ORDER BY name');
    const settingsRows = await pool.query("SELECT key, value FROM settings");
    const settings = Object.fromEntries(settingsRows.rows.map(r => [r.key, r.value]));

    const results = [];
    for (const item of items) {
      try {
        const result = await wpService.syncEquipment(item, settings);
        await pool.query('UPDATE equipment SET wp_product_id=$1, last_synced=$2 WHERE id=$3',
          [result.wp_product_id, new Date(), item.id]);
        results.push({ id: item.id, name: item.name, success: true });
      } catch (e) {
        results.push({ id: item.id, name: item.name, success: false, error: e.message });
      }
    }
    res.json({ results });
  } catch (err) { next(err); }
});

// POST /api/equipment/pull-from-wp  — import all WooCommerce products → local DB
router.post('/pull-from-wp', async (req, res, next) => {
  try {
    const settingsRows = await pool.query('SELECT key, value FROM settings');
    const settings = Object.fromEntries(settingsRows.rows.map(r => [r.key, r.value]));

    if (!settings.wp_url || !settings.wp_consumer_key || !settings.wp_consumer_secret) {
      return res.status(400).json({ error: 'הגדרות WooCommerce חסרות' });
    }

    const axios = require('axios');
    const base = settings.wp_url.replace(/\/$/, '');
    const auth = { consumer_key: settings.wp_consumer_key, consumer_secret: settings.wp_consumer_secret };

    // Fetch all products from WooCommerce (paginated)
    let wpProducts = [];
    let page = 1;
    while (true) {
      const { data } = await axios.get(`${base}/wp-json/wc/v3/products`, {
        params: { ...auth, per_page: 100, page, status: 'publish' },
        timeout: 20000,
      });
      if (!data.length) break;
      wpProducts = wpProducts.concat(data);
      if (data.length < 100) break;
      page++;
    }

    const created = [];
    const updated = [];
    const skipped = [];

    for (const wp of wpProducts) {
      const wpId = wp.id;
      const sku = (wp.sku || '').startsWith('crm-') ? '' : (wp.sku || '');
      const imageUrl = wp.images?.[0]?.src || '';
      const category = wp.categories?.[0]?.name || 'general';
      const pricePerDay = parseFloat(wp.regular_price || wp.price || 0);
      const quantity = wp.stock_quantity ?? 1;

      // Check if we already have this product by wp_product_id or SKU
      let existing = null;
      const { rows: byId } = await pool.query('SELECT * FROM equipment WHERE wp_product_id=$1', [wpId]);
      if (byId.length) {
        existing = byId[0];
      } else if (sku) {
        const { rows: bySku } = await pool.query('SELECT * FROM equipment WHERE sku=$1', [sku]);
        if (bySku.length) existing = bySku[0];
      }

      if (existing) {
        // Update existing — don't overwrite local fields the user may have customised
        await pool.query(
          `UPDATE equipment SET
            name=$1, price_per_day=$2, quantity=$3,
            image_url = CASE WHEN image_url='' OR image_url IS NULL THEN $4 ELSE image_url END,
            wp_product_id=$5, last_synced=$6,
            sku = CASE WHEN sku='' OR sku IS NULL THEN $7 ELSE sku END
           WHERE id=$8`,
          [wp.name, pricePerDay, quantity, imageUrl, wpId, new Date(), sku, existing.id]
        );
        updated.push({ wp_id: wpId, name: wp.name });
      } else {
        // Create new local record
        await pool.query(
          `INSERT INTO equipment
            (id, name, sku, category, quantity, price_per_day, description, image_url, wp_product_id, last_synced)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [uuidv4(), wp.name, sku, category, quantity, pricePerDay,
           wp.description ? wp.description.replace(/<[^>]+>/g, '') : '',
           imageUrl, wpId, new Date()]
        );
        created.push({ wp_id: wpId, name: wp.name });
      }
    }

    res.json({
      total: wpProducts.length,
      created: created.length,
      updated: updated.length,
      skipped: skipped.length,
      details: { created, updated },
    });
  } catch (err) { next(err); }
});

module.exports = router;
