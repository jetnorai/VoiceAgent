import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import Stripe from 'stripe';
import { createPublicClient, http } from 'viem';
import { db } from '../db/client';
import { bookings, bookingEvents } from '../db/schema';
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

    // 1. Validate inputs
    if (!bookingId || !txHash || !txHash.startsWith('0x') || !['usdc', 'wld'].includes(paymentMethod)) {
      return next(new AppError(400, 'Invalid verification request', 'VALIDATION_ERROR'));
    }

    // 2. Fetch booking and verify ownership / state
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

    // 3. Verify transaction on World Chain via viem
    const worldChain = {
      id: 480,
      name: 'World Chain',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [process.env.WORLD_CHAIN_RPC || 'https://worldchain-mainnet.g.alchemy.com/public'] } },
    } as const;

    const publicClient = createPublicClient({
      chain: worldChain,
      transport: http(),
    });

    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });

    // 4. Receipt not found
    if (!receipt) {
      return next(new AppError(404, 'Transaction not found on chain', 'TX_NOT_FOUND'));
    }

    // 5. Transaction failed on chain
    if (receipt.status !== 'success') {
      return next(new AppError(400, 'Transaction failed on chain', 'TX_FAILED'));
    }

    // 6. Verify destination is MarginSplitter
    if (receipt.to?.toLowerCase() !== process.env.MARGIN_SPLITTER_ADDRESS?.toLowerCase()) {
      return next(new AppError(400, 'Transaction not sent to MarginSplitter', 'INVALID_RECIPIENT'));
    }

    logger.info('Crypto payment verified on-chain', { bookingId, txHash, paymentMethod });

    // 7. Update booking to confirmed
    await db
      .update(bookings)
      .set({
        onChainTxHash: txHash,
        paymentMethod,
        status: 'confirmed',
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    // 8. Insert booking event
    await db.insert(bookingEvents).values({
      bookingId,
      eventType: 'payment_confirmed',
      fromStatus: 'pending_payment',
      toStatus: 'confirmed',
      metadata: { txHash, paymentMethod },
      createdAt: new Date(),
    });

    // 9. Return success
    res.json({ verified: true, txHash, bookingId });
  } catch (err) {
    next(err);
  }
});
