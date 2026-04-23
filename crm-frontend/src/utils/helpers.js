export const STATUS_LABELS = {
  draft: 'טיוטה',
  confirmed: 'מאושר',
  picked_up: 'נאסף',
  returned: 'הוחזר',
  cancelled: 'מבוטל',
};

export const STATUS_COLORS = {
  draft: '#6b7280',
  confirmed: '#2563eb',
  picked_up: '#d97706',
  returned: '#16a34a',
  cancelled: '#dc2626',
};

export const PAYMENT_LABELS = {
  unpaid: 'לא שולם',
  paid: 'שולם',
  partial: 'שולם חלקית',
};

export const PAYMENT_COLORS = {
  unpaid: '#dc2626',
  paid: '#16a34a',
  partial: '#d97706',
};

export const CATEGORY_LABELS = {
  general: 'כללי',
  lighting: 'תאורה',
  sound: 'קול',
  staging: 'במה',
  furniture: 'ריהוט',
  av: 'מולטימדיה',
  power: 'חשמל',
  decor: 'עיצוב',
  other: 'אחר',
};

export const PAYMENT_METHODS = ['מזומן', 'העברה בנקאית', "ביט / פייבוקס", 'כרטיס אשראי', 'צ\'ק', 'אחר'];

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('he-IL');
  } catch { return dateStr; }
}

export function formatCurrency(n) {
  return `₪${parseFloat(n || 0).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function calcOrderTotals(order) {
  const subtotal = (order.items || []).reduce(
    (sum, i) => sum + i.quantity * i.price_per_day * i.days, 0
  );
  let discount = 0;
  if (order.discount_type === 'percent') {
    discount = subtotal * (parseFloat(order.discount_value) / 100);
  } else {
    discount = parseFloat(order.discount_value) || 0;
  }
  return { subtotal, discount, total: Math.max(0, subtotal - discount) };
}

export function daysBetween(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  return Math.max(1, Math.ceil((b - a) / 86400000) + 1);
}

export function dateToIso(d) {
  return d.toISOString().slice(0, 10);
}

export function today() {
  return dateToIso(new Date());
}

export function statusReservesInventory(status) {
  return ['confirmed', 'picked_up', 'draft'].includes(status);
}

export function getImageSrc(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('/uploads')) return url;
  return null;
}
