# מערכת ניהול השכרת ציוד לאירועים

מערכת ווב פשוטה לניהול השכרת ציוד לאירועים.

## מה המערכת כוללת
- ניהול קטלוג ציוד עם כמות במלאי ומחיר יומי
- ניהול לקוחות
- ניהול הזמנות השכרה עם:
  - פריטי הזמנה
  - חישוב ימי השכרה
  - חישוב מע״מ, הנחה, מקדמה ויתרה
  - בדיקת זמינות מלאי לפי חפיפת תאריכים
- דשבורד עם:
  - הכנסות חודשיות
  - איסופים/החזרות קרובים
  - התראות מלאי נמוך
- ייצוא/ייבוא גיבוי (JSON)

## הפעלה
1. לפתוח את הקובץ `index.html` בדפדפן.
2. להוסיף ציוד ולקוחות.
3. להתחיל לנהל הזמנות השכרה.

הנתונים נשמרים בדפדפן ב־`localStorage`.

## WordPress / WooCommerce product sync
- A new **WordPress Sync** tab is available in the app.
- Enter:
  - WordPress site URL (for example `https://example.com`)
  - WooCommerce Consumer Key
  - WooCommerce Consumer Secret
- Available actions:
  - `Test Connection`
  - `Import from WordPress` (pull: WooCommerce -> CRM)
  - `Push to WordPress` (push: CRM -> WooCommerce)
  - `Two-way Sync` (pull + push)
- You can enable `Auto sync products after local equipment changes` for automatic push after local create/update/delete.
- After changing sync mapping/version, run `Import from WordPress` once to backfill fields into local products.
- Synced product fields:
  - Product name
  - Product description
  - SKU
  - Price
  - Quantity
  - Category
  - Size
  - Main image

### Notes
- This is implemented via WooCommerce REST API (`/wp-json/wc/v3/products`).
- Credentials are stored locally in browser `localStorage` for this single-user local app.
- If the browser blocks requests, configure CORS on your WordPress server and verify WooCommerce REST API permissions.

## Excel Finance Modules
- Added full finance tabs based on the workbook:
  - `הכנסות`
  - `מעקב תשלומים פתוחים`
  - `מעקב חוסרים`
  - `הוצאות קבועות`
  - `הוצאות משתנות`
  - `סיכום שנתי`
- Bootstrap data is loaded from `excel-bootstrap-data.js` (generated from `השכרת ציוד הקמפוס.xlsx`).
- You can reload workbook data at any time via the `טעינת נתוני אקסל` button.
- New management functions:
  - Add fixed expense rows
  - Add variable expense rows
  - Annual summary with monthly profit calculation
