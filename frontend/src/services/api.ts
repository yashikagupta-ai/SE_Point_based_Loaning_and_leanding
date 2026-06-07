import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: { name: string; email: string; password: string }) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
};

export const walletApi = {
  getWallet: () => api.get('/wallet'),
  getTransactions: (params?: { page?: number; limit?: number }) => api.get('/wallet/transactions', { params }),
  transfer: (toUserId: string, amount: number, description?: string) =>
    api.post('/wallet/transfer', { toUserId, amount, description }),
  purchasePoints: (points: number, pricePaid: number) =>
    api.post('/wallet/purchase', { points, pricePaid }),
};

export const itemApi = {
  getListings:    (params?: { category?: string; page?: number; limit?: number; mine?: boolean; borrowedByMe?: boolean }) =>
    api.get('/items', { params }),
  getListing:     (id: string) => api.get(`/items/${id}`),
  createListing:  (data: { itemName: string; description: string; category: string; pointsPerDay: number; maxDuration: number; condition: string; image?: File | null }) => {
    const fd = new FormData();
    fd.append('itemName',    data.itemName);
    fd.append('description', data.description);
    fd.append('category',    data.category);
    fd.append('pointsPerDay', String(data.pointsPerDay));
    fd.append('maxDuration',  String(data.maxDuration));
    fd.append('condition',    data.condition);
    if (data.image) fd.append('image', data.image);
    return api.post('/items', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  requestBorrow:  (id: string, data: { message?: string; duration: number }) =>
    api.post(`/items/${id}/request`, data),
  approveBorrow:  (id: string, reqId: string, agreedPoints?: number) => api.post(`/items/${id}/requests/${reqId}/approve`, agreedPoints !== undefined ? { agreedPoints } : {}),
  rejectBorrow:   (id: string, reqId: string, reason?: string) => api.post(`/items/${id}/requests/${reqId}/reject`, { reason }),
  returnItem:     (id: string) => api.post(`/items/${id}/return`),
  unlist:         (id: string) => api.delete(`/items/${id}`),
  relist:         (id: string) => api.post(`/items/${id}/relist`),
  hardDelete:     (id: string) => api.delete(`/items/${id}/hard`),
};

export const loanApi = {
  createRequest: (data: { amount: number; purpose: string; duration: number }) =>
    api.post('/loans/request', data),
  getRequests: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/loans/requests', { params }),
  getRequestById: (id: string) => api.get(`/loans/request/${id}`),
  approve: (id: string) => api.post(`/loans/request/${id}/approve`),
  reject: (id: string, reason?: string) => api.post(`/loans/request/${id}/reject`, { reason }),
  getActiveLoans: () => api.get('/loans/active'),
  getLoanById: (id: string) => api.get(`/loans/${id}`),
  repay: (id: string, amount: number) => api.post(`/loans/${id}/repay`, { amount }),
  calculate: (amount: number, duration: number) =>
    api.get(`/loans/calculate/${amount}/${duration}`),
};

export const userApi = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: any) => api.put('/users/profile', data),
  getCreditScore: () => api.get('/users/credit-score'),
  getBorrowingHistory: () => api.get('/users/history/borrowing'),
  getLendingHistory: () => api.get('/users/history/lending'),
  getBadges: () => api.get('/users/badges'),
  getStats: () => api.get('/users/stats'),
  uploadKYC: (file: File) => {
    const fd = new FormData();
    fd.append('document', file);
    return api.post('/users/kyc', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const notificationApi = {
  getAll:          () => api.get('/notifications'),
  getUnreadCount:  () => api.get('/notifications/unread-count'),
  markRead:        (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead:     () => api.put('/notifications/read-all'),
};

export const chatApi = {
  sendRequest:    (toUserId: string, message?: string, itemTitle?: string) => api.post('/chat/request', { toUserId, message, itemTitle }),
  getIncoming:    () => api.get('/chat/requests/incoming'),
  getOutgoing:    () => api.get('/chat/requests/outgoing'),
  acceptRequest:  (id: string) => api.post(`/chat/request/${id}/accept`),
  declineRequest: (id: string) => api.post(`/chat/request/${id}/decline`),
  getContacts:    () => api.get('/chat/contacts'),
  getUnread:      () => api.get('/chat/unread'),
};

export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params?: any) => api.get('/admin/users', { params }),
  getUserDetails: (id: string) => api.get(`/admin/users/${id}`),
  freezeUser: (id: string, reason?: string) => api.post(`/admin/users/${id}/freeze`, { reason }),
  activateUser: (id: string) => api.post(`/admin/users/${id}/activate`),
  getTransactions: (params?: any) => api.get('/admin/transactions', { params }),
  getStats: () => api.get('/admin/stats'),
  getRiskHeatmap: () => api.get('/admin/risk-heatmap'),
  getFraudAlerts: () => api.get('/admin/fraud-alerts'),
  deleteAllItems: () => api.delete('/admin/items/all'),
  // New
  getAllItems: (params?: any) => api.get('/admin/items', { params }),
  deleteItem: (id: string) => api.delete(`/admin/items/${id}`),
  getCategories: () => api.get('/admin/categories'),
  getSettings: () => api.get('/admin/settings'),
  adjustSettings: (setting: string, value: any) => api.post('/admin/settings', { setting, value }),
  getReport: (type: string, params?: any) => api.get(`/admin/reports/${type}`, { params }),
  resolveDispute: (loanId: string, resolution: string, action: string) =>
    api.post('/admin/resolve-dispute', { loanId, resolution, action }),
};
