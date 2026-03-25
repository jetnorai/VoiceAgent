import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import Stripe from 'stripe';
import { db } from '../db/client';
import { bookings } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

export const paymentsRouter = Router();

// ─── Create Stripe PaymentIntent ──────────────────────────────────────────────
paymentsRouter.post('/stripe/intent', requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user!.userId;

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
      .limit(1);

    if (!booking) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));
    if (booking.status !== 'pending_payment') {
      return next(new AppError(400, 'Booking is not pending payment', 'INVALID_STATE'));
    }

    const effectiveAmount = parseFloat(booking.totalAmount) - parseFloat(booking.creditRedeemed || '0');
    const amountInCents = Math.round(effectiveAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: booking.currency.toLowerCase(),
      metadata: {
        bookingId,
        userId,
        adelboVersion: '0.1.0',
      },
      description: `Adelbo hotel booking ${bookingId.slice(0, 8)}`,
    });

    // Save PaymentIntent ID to booking
    await db
      .update(bookings)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: effectiveAmount,
      currency: booking.currency,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Create Stripe Checkout Session ──────────────────────────────────────────
paymentsRouter.post('/stripe/checkout', requireAuth, async (req, res, next) => {
  try {
    const { bookingId, successUrl, cancelUrl } = req.body;
    const userId = req.user!.userId;

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
      .limit(1);

    if (!booking) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));

    const effectiveAmount = parseFloat(booking.totalAmount) - parseFloat(booking.creditRedeemed || '0');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: booking.currency.toLowerCase(),
            product_data: {
              name: `Hotel Booking — ${booking.checkIn.toISOString().split('T')[0]}`,
              description: `${booking.checkIn.toISOString().split('T')[0]} → ${booking.checkOut.toISOString().split('T')[0]}, ${booking.guests} guest(s)`,
            },
            unit_amount: Math.round(effectiveAmount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { bookingId, userId },
      success_url: `${successUrl}?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    next(err);
  }
});

// ─── Verify crypto payment (USDC/WLD) ────────────────────────────────────────
paymentsRouter.post('/crypto/verify', requireAuth, async (req, res, next) => {
  try {
    const { bookingId, txHash, paymentMethod } = req.body;

    if (!bookingId || !txHash || !['usdc', 'wld'].includes(paymentMethod)) {
      return next(new AppError(400, 'Invalid verification request', 'VALIDATION_ERROR'));
    }

    // In production: verify the transaction on World Chain
    // Check it went to MarginSplitter with correct amount
    // For now, mark as confirmed after basic validation
    logger.info('Crypto payment verification requested', { bookingId, txHash, paymentMethod });

    await db
      .update(bookings)
      .set({
        onChainTxHash: txHash,
        paymentMethod,
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, req.user!.userId)));

    res.json({ verified: true, txHash });
  } catch (err) {
    next(err);
  }
});
