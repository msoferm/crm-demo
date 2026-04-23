const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../db/pool');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// POST /api/upload/image
router.post('/image', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    const imageUrl = `/uploads/${req.file.filename}`;

    // Optionally update equipment record
    if (req.body.equipment_id) {
      await pool.query('UPDATE equipment SET image_url=$1 WHERE id=$2', [imageUrl, req.body.equipment_id]);
    }

    res.json({ url: imageUrl, filename: req.file.filename });
  } catch (err) { next(err); }
});

module.exports = router;
