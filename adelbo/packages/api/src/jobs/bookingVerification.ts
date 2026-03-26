/**
 * Booking Verification Job
 *
 * In production, this is handled by the Chainlink CRE workflow.
 * This file provides the fallback admin trigger and the logic
 * that mirrors what the CRE nodes execute.
 *
 * CRE Workflow: BookingVerification
 * - Trigger: BookingProcessed event from MarginSplitter
 * - Action: Call LiteAPI booking status with BFT multi-node consensus
 * - Schedule: Check at checkout date + 24hr buffer
 * - On verify: Call completeBooking() on MarginSplitter
 */

import { eq, and, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { bookings, bookingEvents, travelCreditLedger, poolContributions, poolCycles } from '../db/schema';
import { liteapi } from '../services/liteapi';
import { logger } from '../utils/logger';
import cron from 'node-cron';

/**
 * Check bookings that should be completed (checkout date + 24hr passed).
 * This runs as a scheduled job and as a fallback to CRE.
 */
export async function processCompletedStays(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000); // 24hr after checkout

  const pendingBookings = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.status, 'confirmed'),
        lte(bookings.checkOut, cutoff),
      )
    )
    .limit(50);

  logger.info(`Processing ${pendingBookings.length} potentially completed bookings`);

  for (const booking of pendingBookings) {
    await verifyAndCompleteBooking(booking);
  }
}

async function verifyAndCompleteBooking(booking: any): Promise<void> {
  try {
    if (!booking.liteApiBookingId) {
      logger.warn('Booking has no LiteAPI ID', { bookingId: booking.id });
      return;
    }

    // Verify stay status with LiteAPI
    const result = await liteapi.getBooking(booking.liteApiBookingId);
    const status = result?.data?.status;

    if (status !== 'CONFIRMED' && status !== 'COMPLETED') {
      logger.info('Booking not yet completeable', { bookingId: booking.id, status });
      return;
    }

    // Mark as completed
    await db
      .update(bookings)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, booking.id));

    await db.insert(bookingEvents).values({
      bookingId: booking.id,
      eventType: 'booking_completed',
      fromStatus: 'confirmed',
      toStatus: 'completed',
      metadata: { source: 'automated_verification', liteApiStatus: status },
    });

    // Issue Travel Credit
    await issueTravelCredit(booking);

    logger.info('Booking completed', { bookingId: booking.id });
  } catch (err: any) {
    logger.error('verifyAndCompleteBooking failed', { bookingId: booking.id, error: err.message });
  }
}

async function issueTravelCredit(booking: any): Promise<void> {
  try {
    if (!booking.travelCreditEarned || parseFloat(booking.travelCreditEarned) <= 0) return;

    // Check if already issued
    const existing = await db
      .select()
      .from(travelCreditLedger)
      .where(
        and(
          eq(travelCreditLedger.bookingId, booking.id),
          eq(travelCreditLedger.type, 'earned'),
        )
      )
      .limit(1);

    if (existing.length > 0) return;

    // Get current balance
    const history = await db
      .select()
      .from(travelCreditLedger)
      .where(eq(travelCreditLedger.userId, booking.userId))
      .orderBy(travelCreditLedger.createdAt)
      .limit(1);

    // Get last balance
    const lastEntry = history[history.length - 1];
    const currentBalance = lastEntry ? parseFloat(lastEntry.balanceAfter) : 0;
    const creditAmount = parseFloat(booking.travelCreditEarned);
    const newBalance = currentBalance + creditAmount;

    await db.insert(travelCreditLedger).values({
      userId: booking.userId,
      bookingId: booking.id,
      type: 'earned',
      amount: creditAmount.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      description: `Travel Credit for completed stay`,
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    });

    logger.info('Travel Credit issued', { bookingId: booking.id, amount: creditAmount });
  } catch (err: any) {
    logger.error('issueTravelCredit failed', { bookingId: booking.id, error: err.message });
  }
}

/**
 * Start the cron-scheduled booking verification job.
 * Runs every 10 minutes. In production this is supplemented by Chainlink CRE.
 */
export function startBookingVerificationJob(): void {
  // Run immediately on start
  processCompletedStays().catch((err) =>
    logger.error('Initial booking verification failed', { error: err.message })
  );

  // Then every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      await processCompletedStays();
    } catch (err: any) {
      logger.error('Booking verification job failed', { error: err.message });
    }
  });

  logger.info('Booking verification job scheduled (every 10 min)');
}
