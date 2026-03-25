import { Router } from 'express';
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { bookings, bookingEvents, poolContributions, poolCycles } from '../../db/schema';
import { logger } from '../../utils/logger';
import { processOnChainSplit } from '../../services/blockchain';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-04-10',
});

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    logger.warn('Stripe webhook signature verification failed', { error: err.message });
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      default:
        logger.debug('Unhandled Stripe event', { type: event.type });
    }

    res.json({ received: true });
  } catch (err: any) {
    logger.error('Stripe webhook handler error', { type: event.type, error: err.message });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
  const bookingId = intent.metadata?.bookingId;
  if (!bookingId) return;

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking || booking.status !== 'pending_payment') return;

  // Trigger on-chain margin split
  let onChainTxHash: string | undefined;
  try {
    const tx = await processOnChainSplit({
      bookingId,
      userId: booking.userId,
      amount: parseFloat(booking.totalAmount),
      currency: booking.currency,
      paymentMethod: 'card',
      stripePaymentIntentId: intent.id,
    });
    onChainTxHash = tx.hash;
  } catch (err: any) {
    logger.error('On-chain split failed', { bookingId, error: err.message });
    // Don't fail the webhook — booking still confirmed, on-chain retried async
  }

  await db
    .update(bookings)
    .set({
      status: 'confirmed',
      stripePaymentIntentId: intent.id,
      onChainTxHash,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));

  await db.insert(bookingEvents).values({
    bookingId,
    eventType: 'payment_succeeded',
    fromStatus: 'pending_payment',
    toStatus: 'confirmed',
    metadata: { stripePaymentIntentId: intent.id, onChainTxHash },
  });

  // Add pool contribution
  await addPoolContribution(booking);

  logger.info('Booking confirmed via Stripe', { bookingId, onChainTxHash });
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
  const bookingId = intent.metadata?.bookingId;
  if (!bookingId) return;

  await db
    .update(bookings)
    .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));

  await db.insert(bookingEvents).values({
    bookingId,
    eventType: 'payment_failed',
    fromStatus: 'pending_payment',
    toStatus: 'cancelled',
    metadata: { stripePaymentIntentId: intent.id, failureMessage: intent.last_payment_error?.message },
  });

  logger.warn('Payment failed', { bookingId });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  await handlePaymentSucceeded({
    id: session.payment_intent as string,
    metadata: { bookingId },
  } as any);
}

async function addPoolContribution(booking: any): Promise<void> {
  try {
    const [activeCycle] = await db
      .select()
      .from(poolCycles)
      .where(eq(poolCycles.status, 'active'))
      .limit(1);

    if (!activeCycle) return;

    await db.insert(poolContributions).values({
      userId: booking.userId,
      bookingId: booking.id,
      cycleId: activeCycle.id,
      amount: booking.poolContribution || '0',
    });

    // Update cycle totals
    await db
      .update(poolCycles)
      .set({
        totalAmount: (parseFloat(activeCycle.totalAmount) + parseFloat(booking.poolContribution || '0')).toFixed(2),
        participantCount: activeCycle.participantCount + 1,
      })
      .where(eq(poolCycles.id, activeCycle.id));
  } catch (err: any) {
    logger.error('Pool contribution failed', { bookingId: booking.id, error: err.message });
  }
}
