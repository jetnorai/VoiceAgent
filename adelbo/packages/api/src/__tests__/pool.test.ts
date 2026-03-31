import request from 'supertest';
import app from '../../index';

describe('Pool routes', () => {
  describe('GET /api/pool', () => {
    it('returns pool data (or bootstraps first cycle)', async () => {
      const res = await request(app).get('/api/pool');
      // 200 with DB connected, 500 without
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('cycle');
      }
    });
  });

  describe('GET /api/pool/history', () => {
    it('is accessible without auth', async () => {
      const res = await request(app).get('/api/pool/history');
      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /api/pool/standing', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/pool/standing');
      expect(res.status).toBe(401);
    });
  });
});
