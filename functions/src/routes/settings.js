const express = require('express');
const axios = require('axios');
const pool = require('../db/pool');

const router = express.Router();

const ALLOWED_KEYS = ['wp_url','wp_consumer_key','wp_consumer_secret','wp_username','wp_app_password'];

// GET /api/settings
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings');
    const obj = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json(obj);
  } catch (err) { next(err); }
});

// PUT /api/settings
router.put('/', async (req, res, next) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      await pool.query(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1,$2,NOW())
         ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
        [key, value]
      );
    }
    const { rows } = await pool.query('SELECT key, value FROM settings');
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) { next(err); }
});

// POST /api/settings/test  — test WooCommerce connection from the server side (no CORS)
router.post('/test', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings');
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));

    if (!s.wp_url || !s.wp_consumer_key || !s.wp_consumer_secret) {
      return res.status(400).json({ ok: false, error: 'הגדרות WooCommerce חסרות. שמור קודם את ההגדרות.' });
    }

    const base = s.wp_url.replace(/\/$/, '');

    // Test WooCommerce REST API
    const { data } = await axios.get(`${base}/wp-json/wc/v3/products`, {
      params: {
        consumer_key: s.wp_consumer_key,
        consumer_secret: s.wp_consumer_secret,
        per_page: 1,
      },
      timeout: 10000,
    });

    res.json({ ok: true, message: `✅ חיבור תקין! נמצאו מוצרים ב-WooCommerce.`, products: data.length });
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    res.json({ ok: false, error: `❌ שגיאה (${status || 'network'}): ${msg}` });
  }
});

module.exports = router;
