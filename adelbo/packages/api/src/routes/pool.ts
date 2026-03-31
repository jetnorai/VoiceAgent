import { Router } from 'express';
import { eq, desc, and, sum } from 'drizzle-orm';
import { db } from '../db/client';
import { poolCycles, poolContributions, bookings, users } from '../db/schema';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const poolRouter = Router();

// ─── Get current pool state ───────────────────────────────────────────────────
poolRouter.get('/current', optionalAuth, async (req, res, next) => {
  try {
    // Get active cycle
    const [activeCycle] = await db
      .select()
      .from(poolCycles)
      .where(eq(poolCycles.status, 'active'))
      .orderBy(desc(poolCycles.cycleNumber))
      .limit(1);

    if (!activeCycle) {
      // Bootstrap first cycle if none exists
      const now = new Date();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const [newCycle] = await db
        .insert(poolCycles)
        .values({
          cycleNumber: 1,
          startsAt: new Date(now.getFullYear(), now.getMonth(), 1),
          endsAt: monthEnd,
          totalAmount: '0',
          participantCount: 0,
          status: 'active',
        })
        .returning();

      return res.json({
        cycle: newCycle,
        totalAmount: '0.00',
        participantCount: 0,
        isEligible: false,
        daysUntilDistribution: Math.ceil((monthEnd.getTime() - now.getTime()) / 86400000),
        pastDistributions: [],
      });
    }

    // Check user eligibility
    let isEligible = false;
    let userContribution = null;
    if (req.user) {
      const [contrib] = await db
        .select()
        .from(poolContributions)
        .where(and(
          eq(poolContributions.userId, req.user.userId),
          eq(poolContributions.cycleId, activeCycle.id),
        ))
        .limit(1);
      isEligible = !!contrib;
      userContribution = contrib;
    }

    // Past distributions
    const pastCycles = await db
      .select()
      .from(poolCycles)
      .where(eq(poolCycles.status, 'completed'))
      .orderBy(desc(poolCycles.cycleNumber))
      .limit(6);

    const now = new Date();
    const daysUntilDistribution = Math.max(0,
      Math.ceil((activeCycle.endsAt.getTime() - now.getTime()) / 86400000)
    );

    res.json({
      cycle: activeCycle,
      totalAmount: activeCycle.totalAmount,
      participantCount: activeCycle.participantCount,
      isEligible,
      userContribution,
      daysUntilDistribution,
      nextDistributionDate: activeCycle.endsAt.toISOString(),
      pastDistributions: pastCycles,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Get pool history ─────────────────────────────────────────────────────────
poolRouter.get('/history', optionalAuth, async (req, res, next) => {
  try {
    const cycles = await db
      .select()
      .from(poolCycles)
      .where(eq(poolCycles.status, 'completed'))
      .orderBy(desc(poolCycles.cycleNumber))
      .limit(12);

    res.json({ cycles });
  } catch (err) {
    next(err);
  }
});

// ─── Get user's pool eligibility and standing ─────────────────────────────────
poolRouter.get('/my-standing', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    const contributions = await db
      .select()
      .from(poolContributions)
      .where(eq(poolContributions.userId, userId))
      .orderBy(desc(poolContributions.createdAt))
      .limit(20);

    const totalContributed = contributions.reduce(
      (sum, c) => sum + parseFloat(c.amount), 0
    );

    const wins = contributions.filter(c => c.isWinner);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    res.json({
      contributions,
      totalContributed: totalContributed.toFixed(2),
      cyclesParticipated: contributions.length,
      wins: wins.length,
      totalWon: wins.reduce((sum, w) => sum + parseFloat(w.distributionAmount || '0'), 0).toFixed(2),
      tier: user?.tier || 'explorer',
      tierMultiplier: getTierMultiplier(user?.tier || 'explorer'),
      reputationScore: user?.reputationScore || 0,
      loyaltyScore: calculateLoyaltyScore(contributions, user?.tier),
    });
  } catch (err) {
    next(err);
  }
});

function getTierMultiplier(tier: string): number {
  const multipliers: Record<string, number> = {
    explorer: 1,
    adventurer: 2,
    voyager: 3,
    globetrotter: 5,
  };
  return multipliers[tier] || 1;
}

function calculateLoyaltyScore(contributions: any[], tier?: string | null): number {
  if (!contributions.length) return 0;
  const totalContribution = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
  const bookingCount = contributions.length;
  const tierMult = getTierMultiplier(tier || 'explorer');
  const streakBonus = bookingCount >= 3 ? 1.2 : 1;
  return Math.round(totalContribution * bookingCount * tierMult * streakBonus * 100) / 100;
}

// POST /api/pool/cycle/new — open the next 30-day cycle (called by CRE after distribution)
poolRouter.post('/cycle/new', async (req, res, next) => {
  try {
    const key = req.headers['x-admin-key'];
    if (!key || key !== process.env.ADMIN_API_KEY) {
      return next(new AppError(401, 'Unauthorized', 'UNAUTHORIZED'));
    }

    // Get latest cycle number
    const [latest] = await db
      .select()
      .from(poolCycles)
      .orderBy(desc(poolCycles.cycleNumber))
      .limit(1);

    const nextNumber = (latest?.cycleNumber ?? 0) + 1;
    const startsAt = new Date();
    const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [cycle] = await db
      .insert(poolCycles)
      .values({ cycleNumber: nextNumber, startsAt, endsAt, status: 'active' })
      .returning();

    logger.info('New pool cycle created', { cycleId: cycle.id, cycleNumber: nextNumber });
    res.status(201).json({ cycle });
  } catch (err) {
    next(err);
  }
});
