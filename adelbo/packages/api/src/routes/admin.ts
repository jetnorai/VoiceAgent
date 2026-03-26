/**
 * Admin API — protected by ADMIN_API_KEY header.
 * Mount at /api/admin in index.ts.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { eq, desc, count, sum, and, lte, gte } from 'drizzle-orm';
import { db } from '../db/client';
import { users, bookings, poolCycles, poolContributions, travelCreditLedger, supportCases } from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { distributePool } from '../jobs/poolDistribution';
import { processCompletedStays } from '../jobs/bookingVerification';

export const adminRouter = Router();

// ─── Auth middleware (API key) ────────────────────────────────────────────────
function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
  }
  next();
}

adminRouter.use(requireAdmin);

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────
adminRouter.get('/stats', async (_req, res, next) => {
  try {
    const [totalBookings] = await db.select({ count: count() }).from(bookings);
    const [confirmedBookings] = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.status, 'confirmed'));
    const [completedBookings] = await db
      .select({ count: count() })
      .from(bookings)
      .where(eq(bookings.status, 'completed'));
    const [totalRevenue] = await db
      .select({ total: sum(bookings.marginAmount) })
      .from(bookings)
      .where(eq(bookings.status, 'completed'));
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [activePool] = await db
      .select()
      .from(poolCycles)
      .where(eq(poolCycles.status, 'active'))
      .orderBy(desc(poolCycles.createdAt))
      .limit(1);
    const [openCases] = await db
      .select({ count: count() })
      .from(supportCases)
      .where(eq(supportCases.status, 'open'));

    res.json({
      bookings: {
        total: totalBookings.count,
        confirmed: confirmedBookings.count,
        completed: completedBookings.count,
      },
      revenue: {
        totalMargin: parseFloat(totalRevenue.total || '0').toFixed(2),
      },
      users: { total: totalUsers.count },
      pool: {
        currentCycleId: activePool?.id ?? null,
        currentPoolSize: activePool?.totalAmount ?? '0',
        participants: activePool?.participantCount ?? 0,
        endsAt: activePool?.endsAt ?? null,
      },
      support: { openCases: openCases.count },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/bookings ──────────────────────────────────────────────────
adminRouter.get('/bookings', async (req, res, next) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query as Record<string, string>;
    const conditions = status ? [eq(bookings.status, status as any)] : [];

    const rows = await db
      .select()
      .from(bookings)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(bookings.createdAt))
      .limit(Math.min(parseInt(limit), 200))
      .offset(parseInt(offset));

    res.json({ bookings: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/bookings/:id/status ─────────────────────────────────────
adminRouter.patch('/bookings/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['pending_payment', 'confirmed', 'active', 'completed', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return next(new AppError(400, 'Invalid status', 'VALIDATION_ERROR'));
    }

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));

    await db
      .update(bookings)
      .set({ status, updatedAt: new Date() })
      .where(eq(bookings.id, id));

    logger.warn('Admin status override', { bookingId: id, from: booking.status, to: status, reason });
    res.json({ ok: true, bookingId: id, status });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
adminRouter.get('/users', async (req, res, next) => {
  try {
    const { limit = '50', offset = '0', tier } = req.query as Record<string, string>;
    const conditions = tier ? [eq(users.tier, tier as any)] : [];

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        tier: users.tier,
        reputationScore: users.reputationScore,
        walletAddress: users.walletAddress,
        referralCode: users.referralCode,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(Math.min(parseInt(limit), 200))
      .offset(parseInt(offset));

    res.json({ users: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/pool/cycles ───────────────────────────────────────────────
adminRouter.get('/pool/cycles', async (_req, res, next) => {
  try {
    const cycles = await db
      .select()
      .from(poolCycles)
      .orderBy(desc(poolCycles.cycleNumber));

    res.json({ cycles });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/pool/distribute ─────────────────────────────────────────
adminRouter.post('/pool/distribute', async (req, res, next) => {
  try {
    const { cycleId } = req.body;
    if (!cycleId) return next(new AppError(400, 'cycleId required', 'VALIDATION_ERROR'));

    logger.info('Admin manual pool distribution triggered', { cycleId });
    await distributePool(cycleId);
    res.json({ ok: true, cycleId });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/jobs/verify-bookings ─────────────────────────────────────
adminRouter.post('/jobs/verify-bookings', async (_req, res, next) => {
  try {
    logger.info('Admin manual booking verification triggered');
    await processCompletedStays();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/support ───────────────────────────────────────────────────
adminRouter.get('/support', async (req, res, next) => {
  try {
    const { status = 'open' } = req.query as Record<string, string>;

    const cases = await db
      .select()
      .from(supportCases)
      .where(eq(supportCases.status, status))
      .orderBy(desc(supportCases.createdAt))
      .limit(100);

    res.json({ cases, count: cases.length });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/support/:id ────────────────────────────────────────────
adminRouter.patch('/support/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    await db
      .update(supportCases)
      .set({
        status,
        resolution,
        resolvedAt: status === 'resolved' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(supportCases.id, id));

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
