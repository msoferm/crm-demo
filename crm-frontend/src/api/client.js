import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  r => r.data,
  err => {
    const msg = err.response?.data?.error || err.message || 'שגיאת שרת';
    return Promise.reject(new Error(msg));
  }
);

export const equipment = {
  list: () => api.get('/equipment'),
  get: id => api.get(`/equipment/${id}`),
  create: data => api.post('/equipment', data),
  update: (id, data) => api.put(`/equipment/${id}`, data),
  remove: id => api.delete(`/equipment/${id}`),
  sync: id => api.post(`/equipment/${id}/sync`),
  availability: (id, start, end, excludeOrderId) =>
    api.get(`/equipment/${id}/availability`, { params: { start, end, excludeOrderId } }),
};

export const clients = {
  list: () => api.get('/clients'),
  get: id => api.get(`/clients/${id}`),
  create: data => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  remove: id => api.delete(`/clients/${id}`),
  orders: id => api.get(`/clients/${id}/orders`),
};

export const orders = {
  list: params => api.get('/orders', { params }),
  get: id => api.get(`/orders/${id}`),
  create: data => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  remove: id => api.delete(`/orders/${id}`),
  deliveryNoteUrl: id => `/api/orders/${id}/delivery-note`,
  returnNoteUrl: id => `/api/orders/${id}/return-note`,
};

export const settings = {
  get: () => api.get('/settings'),
  update: data => api.put('/settings', data),
};

export const finances = {
  revenue:          (year) => api.get('/finances/revenue', { params: { year } }),
  openPayments:     () => api.get('/finances/open-payments'),
  missingItems:     (params) => api.get('/finances/missing-items', { params }),
  fixedExpenses:    (year) => api.get('/finances/fixed-expenses', { params: { year } }),
  variableExpenses: (params) => api.get('/finances/variable-expenses', { params }),
  annualSummary:    (year) => api.get('/finances/annual-summary', { params: { year } }),
  importBootstrap:  () => api.post('/finances/import-bootstrap'),
};

export const fixedExpenses = {
  list:   ()         => api.get('/fixed-expenses'),
  create: data       => api.post('/fixed-expenses', data),
  update: (id, data) => api.put(`/fixed-expenses/${id}`, data),
  remove: id         => api.delete(`/fixed-expenses/${id}`),
};

export const variableExpenses = {
  list:   (params)   => api.get('/variable-expenses', { params }),
  create: data       => api.post('/variable-expenses', data),
  update: (id, data) => api.put(`/variable-expenses/${id}`, data),
  remove: id         => api.delete(`/variable-expenses/${id}`),
};

export const upload = {
  image: (file, equipmentId) => {
    const form = new FormData();
    form.append('image', file);
    if (equipmentId) form.append('equipment_id', equipmentId);
    return api.post('/upload/image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export default api;
