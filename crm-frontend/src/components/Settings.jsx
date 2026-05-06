import React, { useState, useEffect } from 'react';
import { settings as settingsApi } from '../api/client.js';
import { useApp } from '../contexts/AppContext.jsx';
import api from '../api/client.js';

const DEFAULTS = { wp_url: '', wp_consumer_key: '', wp_consumer_secret: '', wp_username: '', wp_app_password: '' };

function ResultBox({ result }) {
  if (!result) return null;
  const ok = result.ok !== false && !result.error;
  return (
    <div style={{
      marginTop: '1rem', padding: '.75rem 1rem', borderRadius: 8,
      background: ok ? '#f0fdf4' : '#fef2f2',
      border: `1px solid ${ok ? '#86efac' : '#fca5a5'}`,
      color: ok ? '#166534' : '#991b1b',
      fontSize: '.88rem', fontWeight: 600,
    }}>
      {result.error || result.message || JSON.stringify(result)}
    </div>
  );
}

function SyncLog({ items }) {
  if (!items?.length) return null;
  const ok = items.filter(i => i.success !== false);
  const fail = items.filter(i => i.success === false);
  return (
    <div style={{ marginTop: '.75rem', fontSize: '.82rem', maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '.5rem' }}>
      {ok.length > 0 && <div style={{ color: 'var(--success)', marginBottom: '.25rem' }}>✅ {ok.length} מוצרים עודכנו בהצלחה</div>}
      {fail.map((i, idx) => (
        <div key={idx} style={{ color: 'var(--danger)' }}>❌ {i.name}: {i.error}</div>
      ))}
    </div>
  );
}

export default function Settings() {
  const { state, toast, loadSettings, loadEquipment } = useApp();
  const [form, setForm] = useState({ ...DEFAULTS });
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);
  const [syncing, setSyncing]     = useState(''); // 'push' | 'pull' | ''
  const [testResult, setTestResult]   = useState(null);
  const [syncResult, setSyncResult]   = useState(null);

  useEffect(() => {
    setForm({ ...DEFAULTS, ...state.settings });
  }, [state.settings]);

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setTestResult(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsApi.update(form);
      toast('הגדרות נשמרו ✅');
      loadSettings();
      setTestResult(null);
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSaving(false); }
  }

  async function handleTest() {
    if (!form.wp_url || !form.wp_consumer_key) {
      toast('יש להזין כתובת URL ומפתחות API', 'error'); return;
    }
    setSaving(true);
    try { await settingsApi.update(form); loadSettings(); }
    catch (err) { toast('שגיאת שמירה: ' + err.message, 'error'); setSaving(false); return; }
    setSaving(false);
    setTesting(true); setTestResult(null);
    try {
      const result = await api.post('/settings/test');
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally { setTesting(false); }
  }

  // ── Push: local → WordPress ────────────────────────────
  async function handlePushAll() {
    if (!confirm('לדחוף את כל הציוד המקומי ל-WordPress? פעולה זו תעדכן/תיצור מוצרים באתר.')) return;
    setSyncing('push'); setSyncResult(null);
    try {
      const res = await api.post('/equipment/sync-all');
      setSyncResult({ type: 'push', items: res.results });
      const ok = res.results.filter(r => r.success).length;
      const fail = res.results.filter(r => !r.success).length;
      toast(`סנכרון הושלם: ${ok} הצליחו${fail ? `, ${fail} נכשלו` : ''}`);
      loadEquipment();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSyncing(''); }
  }

  // ── Pull: WordPress → local ────────────────────────────
  async function handlePullAll() {
    if (!confirm('לייבא את כל המוצרים מ-WordPress? מוצרים חדשים יתווספו, קיימים יתעדכנו.')) return;
    setSyncing('pull'); setSyncResult(null);
    try {
      const res = await api.post('/equipment/pull-from-wp');
      setSyncResult({
        type: 'pull',
        message: `✅ יובאו ${res.total} מוצרים: ${res.created} חדשים, ${res.updated} עודכנו`,
        items: [
          ...res.details.created.map(i => ({ name: i.name, success: true, label: 'חדש' })),
          ...res.details.updated.map(i => ({ name: i.name, success: true, label: 'עודכן' })),
        ],
      });
      toast(`ייבוא הושלם: ${res.created} חדשים, ${res.updated} עודכנו`);
      loadEquipment();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setSyncing(''); }
  }

  const busy = saving || testing || !!syncing;
  const hasWpSettings = state.settings?.wp_url && state.settings?.wp_consumer_key;

  return (
    <div>
      <div className="section-header">
        <h2>⚙️ הגדרות מערכת</h2>
      </div>

      {/* ── WooCommerce credentials ── */}
      <form onSubmit={handleSave}>
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ color: 'var(--primary)', borderBottom: '2px solid var(--border)', paddingBottom: '.4rem', marginBottom: '1rem' }}>
            🔗 חיבור WordPress / WooCommerce
          </h3>

          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '.75rem', marginBottom: '1rem', fontSize: '.84rem', color: '#0369a1' }}>
            <strong>הוראות:</strong> הזן את פרטי החיבור ולחץ <strong>שמור</strong>. לאחר מכן השתמש בלוח הסנכרון למטה.
          </div>

          <div className="form-row-2">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>כתובת האתר (URL)</label>
              <input value={form.wp_url} onChange={e => set('wp_url', e.target.value)} placeholder="https://your-site.com" />
            </div>
            <div className="form-group">
              <label>WooCommerce Consumer Key</label>
              <input value={form.wp_consumer_key} onChange={e => set('wp_consumer_key', e.target.value)} placeholder="ck_xxxxxxxxxxxxxxxx" />
            </div>
            <div className="form-group">
              <label>WooCommerce Consumer Secret</label>
              <input type="password" value={form.wp_consumer_secret} onChange={e => set('wp_consumer_secret', e.target.value)} placeholder="cs_xxxxxxxxxxxxxxxx" />
            </div>
            <div className="form-group">
              <label>שם משתמש WordPress <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(להעלאת תמונות)</span></label>
              <input value={form.wp_username} onChange={e => set('wp_username', e.target.value)} placeholder="admin" />
            </div>
            <div className="form-group">
              <label>Application Password</label>
              <input type="password" value={form.wp_app_password} onChange={e => set('wp_app_password', e.target.value)} placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" />
              <span style={{ fontSize: '.75rem', color: 'var(--muted)' }}>WordPress › משתמשים › פרופיל › Application Passwords</span>
            </div>
          </div>

          <ResultBox result={testResult} />

          <div style={{ marginTop: '1rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn" disabled={busy}>{saving ? '⏳ שומר...' : '💾 שמור הגדרות'}</button>
            <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={busy}>
              {testing ? '⏳ בודק...' : '🔍 שמור ובדוק חיבור'}
            </button>
          </div>
        </div>
      </form>

      {/* ── Sync dashboard ── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ color: 'var(--primary)', borderBottom: '2px solid var(--border)', paddingBottom: '.4rem', marginBottom: '1rem' }}>
          🔄 סנכרון דו-כיווני עם WordPress
        </h3>

        {!hasWpSettings ? (
          <div style={{ color: 'var(--muted)', padding: '1rem 0', fontSize: '.88rem' }}>
            ⚠️ יש להזין ולשמור הגדרות WordPress לפני הסנכרון.
          </div>
        ) : (
          <>
            <div className="form-row-2">

              {/* Push */}
              <div style={{ border: '2px solid #dbeafe', borderRadius: 10, padding: '1rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '.4rem' }}>⬆️</div>
                <strong style={{ color: 'var(--primary)' }}>דחיפה ל-WordPress</strong>
                <p style={{ fontSize: '.82rem', color: 'var(--muted)', margin: '.4rem 0 .75rem' }}>
                  שולח את כל הציוד המקומי ל-WooCommerce. יוצר מוצרים חדשים או מעדכן קיימים.
                </p>
                <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.75rem' }}>
                  📦 {state.equipment.length} פריטים מקומיים
                </div>
                <button
                  className="btn"
                  onClick={handlePushAll}
                  disabled={busy}
                  style={{ width: '100%' }}
                >
                  {syncing === 'push' ? '⏳ מסנכרן...' : '⬆️ דחוף הכל ל-WordPress'}
                </button>
              </div>

              {/* Pull */}
              <div style={{ border: '2px solid #dcfce7', borderRadius: 10, padding: '1rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '.4rem' }}>⬇️</div>
                <strong style={{ color: 'var(--success)' }}>ייבוא מ-WordPress</strong>
                <p style={{ fontSize: '.82rem', color: 'var(--muted)', margin: '.4rem 0 .75rem' }}>
                  מייבא את כל המוצרים מ-WooCommerce. מוסיף חדשים ומעדכן קיימים (לא מוחק).
                </p>
                <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.75rem' }}>
                  🌐 {state.settings?.wp_url?.replace('https://', '') || 'האתר שלך'}
                </div>
                <button
                  className="btn btn-success"
                  onClick={handlePullAll}
                  disabled={busy}
                  style={{ width: '100%' }}
                >
                  {syncing === 'pull' ? '⏳ מייבא...' : '⬇️ ייבא הכל מ-WordPress'}
                </button>
              </div>
            </div>

            {/* Sync result */}
            {syncResult && (
              <div style={{ marginTop: '1rem' }}>
                {syncResult.message && (
                  <div style={{ padding: '.65rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, color: '#166534', fontWeight: 600, fontSize: '.88rem', marginBottom: '.5rem' }}>
                    {syncResult.message}
                  </div>
                )}
                {syncResult.type === 'push' && <SyncLog items={syncResult.items} />}
                {syncResult.type === 'pull' && syncResult.items?.length > 0 && (
                  <div style={{ fontSize: '.82rem', maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '.5rem', marginTop: '.25rem' }}>
                    {syncResult.items.map((i, idx) => (
                      <div key={idx} style={{ color: 'var(--success)', padding: '.1rem 0' }}>
                        ✅ {i.name} <span style={{ color: 'var(--muted)', fontSize: '.75rem' }}>({i.label})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── About ── */}
      <div className="card">
        <h3 style={{ color: 'var(--primary)', borderBottom: '2px solid var(--border)', paddingBottom: '.4rem', marginBottom: '.75rem' }}>ℹ️ על המערכת</h3>
        <p style={{ color: 'var(--muted)', fontSize: '.88rem', lineHeight: 1.8 }}>
          <strong>CRM השכרת ציוד</strong> — מערכת ניהול מלאי והזמנות לאירועים.<br />
          גרסה: 2.0 (React + Node.js + PostgreSQL)<br />
          <strong>אחסון:</strong> PostgreSQL עם נתונים קבועים (volumes).<br />
          <strong>תמונות:</strong> מאוחסנות בשרת ומסונכרנות ל-WordPress.<br />
          <strong>PDF:</strong> תעודות משלוח/החזרה מתוך כל הזמנה.<br />
        </p>
      </div>
    </div>
  );
}
