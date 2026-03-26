import { Router } from 'express';
import { eq, and, count, sum } from 'drizzle-orm';
import { db } from '../db/client';
import { users, travelCreditLedger, bookings } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const referralsRouter = Router();

// Generate a random 6-char alphanumeric code
function generateCode(): string {
  return Math.random().toString(36).toUpperCase().slice(2, 8);
}

// GET /api/referrals — get my referral code + stats
referralsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    // Fetch or generate code
    let [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return next(new AppError(404, 'User not found', 'NOT_FOUND'));

    if (!user.referralCode) {
      // Generate a unique code
      let code: string;
      let attempts = 0;
      do {
        code = generateCode();
        const [existing] = await db.select().from(users).where(eq(users.referralCode, code)).limit(1);
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      await db.update(users).set({ referralCode: code! }).where(eq(users.id, userId));
      user = { ...user, referralCode: code! };
    }

    // Count referrals
    const referred = await db
      .select({ count: count() })
      .from(users)
      .where(eq(users.referredBy, userId));
    const referralCount = referred[0]?.count ?? 0;

    // Total credit earned from referrals
    const creditRows = await db
      .select({ total: sum(travelCreditLedger.amount) })
      .from(travelCreditLedger)
      .where(
        and(
          eq(travelCreditLedger.userId, userId),
          eq(travelCreditLedger.description, 'Referral bonus')
        )
      );
    const referralCreditEarned = parseFloat(creditRows[0]?.total || '0').toFixed(2);

    res.json({
      referralCode: user.referralCode,
      referralCount,
      referralCreditEarned,
      shareUrl: `${process.env.WEB_APP_URL || 'https://adelbo.com'}/?ref=${user.referralCode}`,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/referrals/apply — referee applies a referral code (once only)
referralsRouter.post('/apply', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return next(new AppError(400, 'code required', 'VALIDATION_ERROR'));
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return next(new AppError(404, 'User not found', 'NOT_FOUND'));

    if (user.referredBy) {
      return next(new AppError(409, 'Referral code already applied', 'ALREADY_APPLIED'));
    }

    // Find the referrer
    const [referrer] = await db
      .select()
      .from(users)
      .where(eq(users.referralCode, code.toUpperCase()))
      .limit(1);

    if (!referrer) return next(new AppError(404, 'Invalid referral code', 'INVALID_CODE'));
    if (referrer.id === userId) return next(new AppError(400, 'Cannot use your own code', 'SELF_REFERRAL'));

    // Record referral on referee
    await db.update(users).set({ referredBy: referrer.id, updatedAt: new Date() }).where(eq(users.id, userId));

    // Helper: get latest credit balance for a user
    async function getBalance(uid: string): Promise<number> {
      const rows = await db
        .select({ bal: travelCreditLedger.balanceAfter })
        .from(travelCreditLedger)
        .where(eq(travelCreditLedger.userId, uid))
        .orderBy(travelCreditLedger.createdAt)
        .limit(1);
      return parseFloat(rows[rows.length - 1]?.bal || '0');
    }

    const REFEREE_BONUS = 10.00;  // $10 welcome credit
    const REFERRER_BONUS = 15.00; // $15 for the referrer

    // Issue welcome credit to referee
    const refereeBal = await getBalance(userId);
    await db.insert(travelCreditLedger).values({
      userId,
      type: 'earned',
      amount: REFEREE_BONUS.toFixed(2),
      balanceAfter: (refereeBal + REFEREE_BONUS).toFixed(2),
      description: 'Welcome bonus — referral',
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    });

    // Issue referrer bonus
    const referrerBal = await getBalance(referrer.id);
    await db.insert(travelCreditLedger).values({
      userId: referrer.id,
      type: 'earned',
      amount: REFERRER_BONUS.toFixed(2),
      balanceAfter: (referrerBal + REFERRER_BONUS).toFixed(2),
      description: 'Referral bonus',
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    });

    logger.info('Referral applied', { referrerId: referrer.id, refereeId: userId });

    res.json({
      ok: true,
      welcomeCredit: REFEREE_BONUS,
      message: `$${REFEREE_BONUS} Travel Credit added to your account`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/referrals/leaderboard — top referrers (public, for social proof)
referralsRouter.get('/leaderboard', async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        referrerId: users.referredBy,
        count: count(),
      })
      .from(users)
      .where(eq(users.referredBy, users.referredBy)) // non-null
      .groupBy(users.referredBy)
      .orderBy(count())
      .limit(10);

    res.json({ leaderboard: rows });
  } catch (err) {
    next(err);
  }
});
