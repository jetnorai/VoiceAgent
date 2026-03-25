import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('adelbo_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('adelbo_token');
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  verifyWorld: (proof: any) => api.post('/auth/world/verify', proof),
  me: () => api.get('/auth/me'),
};

export const searchApi = {
  search: (params: Record<string, string>) => api.get('/search', { params }),
  intent: (body: object) => api.post('/search/intent', body),
};

export const hotelsApi = {
  get: (hotelId: string) => api.get(`/hotels/${hotelId}`),
  getRates: (hotelId: string, params: Record<string, string>) =>
    api.get(`/hotels/${hotelId}/rates`, { params }),
  aiTruth: (hotelId: string, body: object) => api.post(`/hotels/${hotelId}/ai/truth`, body),
  aiRates: (hotelId: string, body: object) => api.post(`/hotels/${hotelId}/ai/rates`, body),
};

export const bookingsApi = {
  prebook: (body: object) => api.post('/bookings/prebook', body),
  create: (body: object) => api.post('/bookings', body),
  confirm: (id: string, body: object) => api.post(`/bookings/${id}/confirm`, body),
  list: () => api.get('/bookings'),
  get: (id: string) => api.get(`/bookings/${id}`),
  cancel: (id: string) => api.post(`/bookings/${id}/cancel`),
  aiRescue: (id: string, body: object) => api.post(`/bookings/${id}/ai/rescue`, body),
};

export const rewardsApi = {
  getCredit: () => api.get('/rewards/credit'),
};

export const poolApi = {
  getCurrent: () => api.get('/pool/current'),
  getMyStanding: () => api.get('/pool/my-standing'),
};

export const reviewsApi = {
  submit: (body: object) => api.post('/reviews', body),
};
