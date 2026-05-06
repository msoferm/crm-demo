import React, { useState, useEffect, useRef } from 'react';
import { equipment as equipApi, upload as uploadApi } from '../../api/client.js';
import { useApp } from '../../contexts/AppContext.jsx';
import { CATEGORY_LABELS } from '../../utils/helpers.js';

const EMPTY = {
  name: '', sku: '', category: 'general', quantity: 1, price_per_day: 0,
  description: '', notes: '', image_url: '', shelf_location: '', shelf_row: '', damaged_qty: 0,
};

export default function EquipmentModal({ item, onClose, onSaved }) {
  const { toast } = useApp();
  const [form, setForm] = useState(item ? { ...item } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(item?.image_url || '');
  const fileRef = useRef();

  useEffect(() => {
    setForm(item ? { ...item } : { ...EMPTY });
    setImagePreview(item?.image_url || '');
    setImageFile(null);
  }, [item]);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let imageUrl = form.image_url;

      if (imageFile) {
        const res = await uploadApi.image(imageFile, item?.id);
        imageUrl = res.url;
      }

      const payload = { ...form, image_url: imageUrl, quantity: Number(form.quantity), price_per_day: Number(form.price_per_day), damaged_qty: Number(form.damaged_qty || 0) };

      let saved;
      if (item?.id) {
        saved = await equipApi.update(item.id, payload);
      } else {
        saved = await equipApi.create(payload);
      }

      // If file was uploaded, update the record with the DB-assigned URL
      if (imageFile && saved?.id) {
        await uploadApi.image(imageFile, saved.id);
      }

      toast(item ? 'הציוד עודכן בהצלחה' : 'הציוד נוסף בהצלחה');
      onSaved?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    if (!item?.id) { toast('שמור קודם לפני סנכרון', 'error'); return; }
    setSyncing(true);
    try {
      await equipApi.sync(item.id);
      toast('הציוד סונכרן עם WordPress בהצלחה ✅');
      onSaved?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>{item ? `עריכת ציוד: ${item.name}` : '+ הוספת ציוד חדש'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave}>
          <div className="form-row-2">
            {/* Image */}
            <div style={{ gridColumn: '1 / -1' }}>
              {imagePreview
                ? <img src={imagePreview} alt="תצוגה מקדימה" className="img-preview" />
                : <div className="img-placeholder">📦</div>
              }
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                📷 {imagePreview ? 'החלפת תמונה' : 'העלאת תמונה'}
              </button>
            </div>

            <div className="form-group">
              <label>שם ציוד *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>מק"ט (SKU)</label>
              <input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="אוטומטי אם ריק" />
            </div>
            <div className="form-group">
              <label>קטגוריה</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>כמות במלאי</label>
              <input type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
            </div>
            <div className="form-group">
              <label>מחיר ליום (₪)</label>
              <input type="number" min="0" step="0.01" value={form.price_per_day} onChange={e => set('price_per_day', e.target.value)} />
            </div>
            <div className="form-group">
              <label>כמות פגומה</label>
              <input type="number" min="0" value={form.damaged_qty} onChange={e => set('damaged_qty', e.target.value)} />
            </div>
            <div className="form-group">
              <label>מיקום במדף</label>
              <input value={form.shelf_location} onChange={e => set('shelf_location', e.target.value)} placeholder="מדף א'" />
            </div>
            <div className="form-group">
              <label>שורה במדף</label>
              <input value={form.shelf_row} onChange={e => set('shelf_row', e.target.value)} placeholder="שורה 2" />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>תיאור</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>הערות</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? '⏳ שומר...' : '💾 שמור'}
            </button>
            {item && (
              <button type="button" className="btn btn-warn" onClick={handleSync} disabled={syncing}>
                {syncing ? '⏳ מסנכרן...' : '🔄 סנכרן ל-WordPress'}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>ביטול</button>
          </div>
        </form>
      </div>
    </div>
  );
}
