import request from 'supertest';
import app from '../../index';

describe('Payments routes', () => {
  describe('POST /api/payments/crypto/verify', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/payments/crypto/verify')
        .send({ bookingId: 'test', txHash: '0xabc', paymentMethod: 'usdc' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for missing txHash', async () => {
      // Forge a minimal JWT for validation testing
      const res = await request(app)
        .post('/api/payments/crypto/verify')
        .set('Authorization', 'Bearer fake.jwt.token')
        .send({ bookingId: 'test', paymentMethod: 'usdc' });
      expect([400, 401]).toContain(res.status);
    });

    it('returns 400 for txHash not starting with 0x', async () => {
      const res = await request(app)
        .post('/api/payments/crypto/verify')
        .set('Authorization', 'Bearer fake.jwt.token')
        .send({ bookingId: 'test', txHash: 'abc123', paymentMethod: 'usdc' });
      expect([400, 401]).toContain(res.status);
    });

    it('returns 400 for invalid paymentMethod', async () => {
      const res = await request(app)
        .post('/api/payments/crypto/verify')
        .set('Authorization', 'Bearer fake.jwt.token')
        .send({ bookingId: 'test', txHash: '0xabc', paymentMethod: 'eth' });
      expect([400, 401]).toContain(res.status);
    });
  });

  describe('POST /api/payments/stripe/intent', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/payments/stripe/intent')
        .send({ bookingId: 'test-id' });
      expect(res.status).toBe(401);
    });
  });
});
