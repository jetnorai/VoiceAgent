import request from 'supertest';
import app from '../../index';

const ADMIN_KEY = 'test-admin-key';

describe('Admin routes', () => {
  describe('Authentication', () => {
    it('returns 401 without x-admin-key', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
    });

    it('returns 401 with wrong key', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('x-admin-key', 'wrong-key');
      expect(res.status).toBe(401);
    });

    it('passes with correct key (may fail at DB layer)', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('x-admin-key', ADMIN_KEY);
      // 200 with DB, or 500 without — but NOT 401
      expect(res.status).not.toBe(401);
    });
  });

  describe('PATCH /api/admin/bookings/:id/status', () => {
    it('rejects invalid status', async () => {
      const res = await request(app)
        .patch('/api/admin/bookings/some-id/status')
        .set('x-admin-key', ADMIN_KEY)
        .send({ status: 'invalid_status' });
      expect(res.status).toBe(400);
    });

    it('accepts valid status', async () => {
      const res = await request(app)
        .patch('/api/admin/bookings/nonexistent-id/status')
        .set('x-admin-key', ADMIN_KEY)
        .send({ status: 'confirmed' });
      // 404 (booking not found) or 500 (no DB), but NOT 400
      expect(res.status).not.toBe(400);
      expect(res.status).not.toBe(401);
    });
  });

  describe('POST /api/admin/pool/distribute', () => {
    it('returns 400 without cycleId', async () => {
      const res = await request(app)
        .post('/api/admin/pool/distribute')
        .set('x-admin-key', ADMIN_KEY)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
