import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Inject auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('adelbo_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('adelbo_token');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  requestOTP: (email: string) => api.post('/auth/email/request-otp', { email }),
  verifyOTP: (email: string, token: string) => api.post('/auth/email/verify-otp', { email, token }),
  verifyWorld: (proof: any) => api.post('/auth/world/verify', proof),
  me: () => api.get('/auth/me'),
  updateProfile: (data: { displayName?: string }) => api.patch('/auth/me', data),
};

// ─── Search ────────────────────────────────────────────────────────────────────
export const searchApi = {
  search: (params: Record<string, string>) => api.get('/search', { params }),
  intent: (body: object) => api.post('/search/intent', body),
  destinations: (q: string) => api.get('/search/destinations', { params: { q } }),
};

// ─── Hotels ────────────────────────────────────────────────────────────────────
export const hotelsApi = {
  get: (hotelId: string) => api.get(`/hotels/${hotelId}`),
  getRates: (hotelId: string, params: Record<string, string>) =>
    api.get(`/hotels/${hotelId}/rates`, { params }),
  aiTruth: (hotelId: string, body: object) => api.post(`/hotels/${hotelId}/ai/truth`, body),
  aiRates: (hotelId: string, body: object) => api.post(`/hotels/${hotelId}/ai/rates`, body),
  aiTiming: (hotelId: string, body: object) => api.post(`/hotels/${hotelId}/ai/timing`, body),
  aiFeedback: (body: object) => api.post('/hotels/ai/feedback', body),
};

// ─── Bookings ──────────────────────────────────────────────────────────────────
export const bookingsApi = {
  prebook: (body: object) => api.post('/bookings/prebook', body),
  create: (body: object) => api.post('/bookings', body),
  confirm: (bookingId: string, body: object) => api.post(`/bookings/${bookingId}/confirm`, body),
  list: () => api.get('/bookings'),
  get: (bookingId: string) => api.get(`/bookings/${bookingId}`),
  cancel: (bookingId: string, reason?: string) =>
    api.post(`/bookings/${bookingId}/cancel`, { reason }),
  aiRescue: (bookingId: string, body: object) =>
    api.post(`/bookings/${bookingId}/ai/rescue`, body),
};

// ─── Rewards ───────────────────────────────────────────────────────────────────
export const rewardsApi = {
  getCredit: () => api.get('/rewards/credit'),
  redeemCredit: (bookingId: string, amount: number) =>
    api.post('/rewards/credit/redeem', { bookingId, amount }),
};

// ─── Pool ──────────────────────────────────────────────────────────────────────
export const poolApi = {
  getCurrent: () => api.get('/pool/current'),
  getHistory: () => api.get('/pool/history'),
  getMyStanding: () => api.get('/pool/my-standing'),
};

// ─── Reviews ───────────────────────────────────────────────────────────────────
export const reviewsApi = {
  getForHotel: (hotelId: string) => api.get(`/reviews/hotel/${hotelId}`),
  submit: (body: object) => api.post('/reviews', body),
  mine: () => api.get('/reviews/mine'),
};

// ─── Payments ──────────────────────────────────────────────────────────────────
export const paymentsApi = {
  createIntent: (bookingId: string) => api.post('/payments/stripe/intent', { bookingId }),
  createCheckout: (bookingId: string, successUrl: string, cancelUrl: string) =>
    api.post('/payments/stripe/checkout', { bookingId, successUrl, cancelUrl }),
  verifyCrypto: (bookingId: string, txHash: string, paymentMethod: string) =>
    api.post('/payments/crypto/verify', { bookingId, txHash, paymentMethod }),
};
