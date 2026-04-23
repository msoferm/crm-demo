const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Sync a single equipment item to WooCommerce.
 * Returns { wp_product_id }
 */
async function syncEquipment(item, settings) {
  const { wp_url, wp_consumer_key, wp_consumer_secret, wp_username, wp_app_password } = settings;

  if (!wp_url || !wp_consumer_key || !wp_consumer_secret) {
    throw new Error('הגדרות WordPress / WooCommerce חסרות');
  }

  const base = wp_url.replace(/\/$/, '');
  const auth = { consumer_key: wp_consumer_key, consumer_secret: wp_consumer_secret };

  const sku = item.sku ? String(item.sku).trim() : `crm-${item.id.slice(0, 12)}`;

  const payload = {
    name: item.name,
    sku,
    type: 'simple',
    status: 'publish',
    regular_price: String(item.price_per_day || 0),
    stock_quantity: item.quantity,
    manage_stock: true,
    description: item.description || '',
    short_description: item.notes || '',
    categories: item.category ? [{ name: item.category }] : [],
  };

  // Upload image to WP media library if we have a local URL starting with /uploads
  if (item.image_url && item.image_url.startsWith('/uploads/') && wp_username && wp_app_password) {
    try {
      const wpImageId = await uploadImageToWordPress(item.image_url, settings);
      if (wpImageId) payload.images = [{ id: wpImageId }];
    } catch (imgErr) {
      console.warn('Image upload failed (continuing without image):', imgErr.message);
    }
  }

  // Try PUT first if we know the WP product ID
  if (item.wp_product_id) {
    try {
      const { data } = await axios.put(
        `${base}/wp-json/wc/v3/products/${item.wp_product_id}`,
        payload, { params: auth, timeout: 15000 }
      );
      return { wp_product_id: data.id };
    } catch (e) {
      // Fall through to POST if 404
      if (e.response?.status !== 404) throw new Error(`WordPress API: ${e.response?.data?.message || e.message}`);
    }
  }

  // POST (create)
  try {
    const { data } = await axios.post(`${base}/wp-json/wc/v3/products`, payload, {
      params: auth, timeout: 15000
    });
    return { wp_product_id: data.id };
  } catch (e) {
    // Handle duplicate SKU
    if (e.response?.data?.code === 'product_invalid_sku') {
      const existing = await findProductBySku(base, auth, sku);
      if (existing) {
        const { data } = await axios.put(`${base}/wp-json/wc/v3/products/${existing}`, payload, {
          params: auth, timeout: 15000
        });
        return { wp_product_id: data.id };
      }
    }
    throw new Error(`WordPress API: ${e.response?.data?.message || e.message}`);
  }
}

async function findProductBySku(base, auth, sku) {
  try {
    const { data } = await axios.get(`${base}/wp-json/wc/v3/products`, {
      params: { ...auth, sku, per_page: 1 }, timeout: 10000
    });
    return data[0]?.id || null;
  } catch { return null; }
}

async function uploadImageToWordPress(imageUrl, settings) {
  const { wp_url, wp_username, wp_app_password } = settings;
  const base = wp_url.replace(/\/$/, '');

  // imageUrl is a local path like /uploads/filename.jpg
  // We need the file on disk — construct the backend path
  const uploadsDir = require('path').join(__dirname, '../../uploads');
  const filename = imageUrl.replace('/uploads/', '');
  const filePath = require('path').join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) return null;

  const fileBuffer = fs.readFileSync(filePath);
  const ext = require('path').extname(filename).slice(1) || 'jpeg';
  const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  const creds = Buffer.from(`${wp_username}:${wp_app_password}`).toString('base64');

  // Try raw binary upload
  try {
    const { data } = await axios.post(`${base}/wp-json/wp/v2/media`, fileBuffer, {
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
      timeout: 30000,
    });
    return data.id;
  } catch (e1) {
    // Try FormData
    try {
      const form = new FormData();
      form.append('file', fileBuffer, { filename, contentType: mimeType });
      const { data } = await axios.post(`${base}/wp-json/wp/v2/media`, form, {
        headers: { ...form.getHeaders(), Authorization: `Basic ${creds}` },
        timeout: 30000,
      });
      return data.id;
    } catch (e2) {
      throw new Error(`Image upload failed: ${e2.response?.data?.message || e2.message}`);
    }
  }
}

module.exports = { syncEquipment };
