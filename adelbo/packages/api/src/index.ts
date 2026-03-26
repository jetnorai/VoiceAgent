import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger';
import { authRouter } from './routes/auth';
import { searchRouter } from './routes/search';
import { hotelsRouter } from './routes/hotels';
import { bookingsRouter } from './routes/bookings';
import { rewardsRouter } from './routes/rewards';
import { poolRouter } from './routes/pool';
import { aiRouter } from './routes/ai';
import { reviewsRouter } from './routes/reviews';
import { paymentsRouter } from './routes/payments';
import supportRouter from './routes/support';
import notificationsRouter from './routes/notifications';
import { referralsRouter } from './routes/referrals';
import { adminRouter } from './routes/admin';
import { errorHandler } from './middleware/errorHandler';
import { stripeWebhookRouter } from './routes/webhooks/stripe';
import { startBookingVerificationJob } from './jobs/bookingVerification';
import { startPoolDistributionJob } from './jobs/poolDistribution';

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.WEB_APP_URL || 'http://localhost:3000',
    process.env.MINI_APP_URL || 'https://worldapp.io',
  ],
  credentials: true,
}));

// ─── Stripe webhook (must come before json parser) ────────────────────────────
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRouter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(compression());

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/search', searchRouter);
app.use('/api/hotels', hotelsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/pool', poolRouter);
app.use('/api/ai', aiRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/support', supportRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/admin', adminRouter);

// ─── Error handling ───────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Adelbo API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);

  // Start background jobs
  if (process.env.NODE_ENV !== 'test') {
    startBookingVerificationJob();
    startPoolDistributionJob();
    logger.info('Background jobs started');
  }
});

export default app;
