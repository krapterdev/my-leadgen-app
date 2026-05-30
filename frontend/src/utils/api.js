import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
    return Promise.reject(new Error(errorMessage));
  }
);

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getProfile: () => api.get('/auth/me'),
};

export const mailboxAPI = {
  getAll: () => api.get('/mailbox'),
  create: (data) => api.post('/mailbox', data),
  update: (id, data) => api.put(`/mailbox/${id}`, data),
  verify: (id) => api.post(`/mailbox/${id}/verify`),
  delete: (id) => api.delete(`/mailbox/${id}`),
};

export const contactAPI = {
  getAll: (params) => api.get('/contact', { params }),
  create: (data) => api.post('/contact', data),
  uploadCSV: (formData) => api.post('/contact/upload', formData),
  update: (id, data) => api.put(`/contact/${id}`, data),
  delete: (id) => api.delete(`/contact/${id}`),
  bulkDelete: (ids) => api.post('/contact/bulk-delete', { ids }),
  cleanTrash: () => api.post('/contact/clean-trash'),
  scrape: (data) => api.post('/contact/scrape', data),
};

export const campaignAPI = {
  getAll: () => api.get('/campaign'),
  create: (data) => api.post('/campaign', data),
  get: (id) => api.get(`/campaign/${id}`),
  start: (id) => api.post(`/campaign/${id}/start`),
  pause: (id) => api.post(`/campaign/${id}/pause`),
  resume: (id) => api.post(`/campaign/${id}/resume`),
  stop: (id) => api.post(`/campaign/${id}/stop`),
  restart: (id, confirmed = false) => api.post(`/campaign/${id}/restart`, { confirmed }),
  delete: (id) => api.delete(`/campaign/${id}`),
};

export const dnsAPI = {
  getAll: () => api.get('/dns'),
  save: (data) => api.post('/dns', data),
  generate: (domain) => api.post('/dns/generate', { domain }),
  verify: (id) => api.post(`/dns/${id}/verify`),
};

export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getCampaign: (id) => api.get(`/analytics/campaign/${id}`),
};

export const settingsAPI = {
  getAll: () => api.get('/settings'),
  updateProfile: (data) => api.put('/settings/profile', data),
  updatePreferences: (data) => api.put('/settings/preferences', data),
};

export const templateAPI = {
  getAll: () => api.get('/template'),
  create: (data) => api.post('/template', data),
  get: (id) => api.get(`/template/${id}`),
  update: (id, data) => api.put(`/template/${id}`, data),
  delete: (id) => api.delete(`/template/${id}`),
};

export const dashboardAPI = {
  getStats: (timeframe) => api.get('/dashboard/stats', { params: { timeframe } }),
  getCampaignPerformance: (id) => api.get(`/dashboard/campaign/${id}/performance`),
};

export default api;