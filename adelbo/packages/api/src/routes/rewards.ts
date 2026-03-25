import { Router } from 'express';
import { eq, desc, sum, and, gte } from 'drizzle-orm';
import { db } from '../db/client';
import { travelCreditLedger, bookings, users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const rewardsRouter = Router();

// ─── Get Travel Credit balance and history ────────────────────────────────────
rewardsRouter.get('/credit', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    const history = await db
      .select()
      .from(travelCreditLedger)
      .where(eq(travelCreditLedger.userId, userId))
      .orderBy(desc(travelCreditLedger.createdAt))
      .limit(50);

    // Current balance = last entry's balanceAfter
    const balance = history.length > 0 ? parseFloat(history[0].balanceAfter) : 0;

    // Lifetime earned
    const earned = history
      .filter(e => e.type === 'earned')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const redeemed = history
      .filter(e => e.type === 'redeemed')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    res.json({
      balance: balance.toFixed(2),
      lifetimeEarned: earned.toFixed(2),
      lifetimeRedeemed: redeemed.toFixed(2),
      history,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Redeem credit (apply to booking) ────────────────────────────────────────
rewardsRouter.post('/credit/redeem', requireAuth, async (req, res, next) => {
  try {
    const { bookingId, amount } = req.body;
    const userId = req.user!.userId;

    if (!bookingId || !amount || amount <= 0) {
      return next(new AppError(400, 'Invalid redemption request', 'VALIDATION_ERROR'));
    }

    // Get current balance
    const history = await db
      .select()
      .from(travelCreditLedger)
      .where(eq(travelCreditLedger.userId, userId))
      .orderBy(desc(travelCreditLedger.createdAt))
      .limit(1);

    const currentBalance = history.length > 0 ? parseFloat(history[0].balanceAfter) : 0;

    if (amount > currentBalance) {
      return next(new AppError(400, `Insufficient credit. Available: ${currentBalance.toFixed(2)}`, 'INSUFFICIENT_CREDIT'));
    }

    // Get booking
    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
      .limit(1);

    if (!booking || booking.status !== 'pending_payment') {
      return next(new AppError(400, 'Cannot apply credit to this booking', 'INVALID_STATE'));
    }

    const newBalance = currentBalance - amount;

    await db.insert(travelCreditLedger).values({
      userId,
      bookingId,
      type: 'redeemed',
      amount: amount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      description: `Applied to booking ${bookingId.slice(0, 8)}...`,
    });

    // Update booking with credit redeemed
    await db
      .update(bookings)
      .set({
        creditRedeemed: amount.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    res.json({
      applied: amount.toFixed(2),
      newBalance: newBalance.toFixed(2),
    });
  } catch (err) {
    next(err);
  }
});

// ─── Issue credit (called internally after stay completion) ──────────────────
rewardsRouter.post('/credit/issue', requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user!.userId;

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
      .limit(1);

    if (!booking || booking.status !== 'completed') {
      return next(new AppError(400, 'Can only issue credit for completed stays', 'INVALID_STATE'));
    }

    if (!booking.travelCreditEarned || parseFloat(booking.travelCreditEarned) <= 0) {
      return next(new AppError(400, 'No credit to issue for this booking', 'NO_CREDIT'));
    }

    // Check if already issued
    const [existing] = await db
      .select()
      .from(travelCreditLedger)
      .where(and(
        eq(travelCreditLedger.bookingId, bookingId),
        eq(travelCreditLedger.type, 'earned'),
      ))
      .limit(1);

    if (existing) {
      return next(new AppError(409, 'Credit already issued for this booking', 'ALREADY_ISSUED'));
    }

    // Get current balance
    const history = await db
      .select()
      .from(travelCreditLedger)
      .where(eq(travelCreditLedger.userId, userId))
      .orderBy(desc(travelCreditLedger.createdAt))
      .limit(1);

    const currentBalance = history.length > 0 ? parseFloat(history[0].balanceAfter) : 0;
    const creditAmount = parseFloat(booking.travelCreditEarned);
    const newBalance = currentBalance + creditAmount;

    await db.insert(travelCreditLedger).values({
      userId,
      bookingId,
      type: 'earned',
      amount: creditAmount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      description: `Stay completed at ${booking.hotelId}`,
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000), // 1 year
    });

    res.json({
      issued: creditAmount.toFixed(2),
      newBalance: newBalance.toFixed(2),
    });
  } catch (err) {
    next(err);
  }
});
