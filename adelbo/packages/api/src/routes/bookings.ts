import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { bookings, bookingEvents, hotels, travelCreditLedger, poolContributions, poolCycles } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { liteapi } from '../services/liteapi';
import { bookingConfidenceSummary, rescueAgent } from '../services/claude';
import { processOnChainSplit } from '../services/blockchain';
import { logger } from '../utils/logger';
import { sendBookingConfirmation } from '../services/email';
import { v4 as uuidv4 } from 'uuid';

export const bookingsRouter = Router();

const ADELBO_MARGIN = 0.05;
const TRAVEL_CREDIT_RATE = 0.0125; // 1.25%
const POOL_RATE = 0.02; // 2%

// ─── Pre-book (lock rate) ─────────────────────────────────────────────────────
bookingsRouter.post('/prebook', requireAuth, async (req, res, next) => {
  try {
    const { rateId, hotelId, checkin, checkout, adults } = req.body;

    if (!rateId || !hotelId) {
      return next(new AppError(400, 'rateId and hotelId required', 'VALIDATION_ERROR'));
    }

    const preBookResult = await liteapi.preBook({ rateId });

    if (!preBookResult?.data?.prebookId) {
      return next(new AppError(502, 'Could not lock rate — please try again', 'PREBOOK_FAILED'));
    }

    res.json({
      prebookId: preBookResult.data.prebookId,
      rate: preBookResult.data.offer,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
    });
  } catch (err) {
    next(err);
  }
});

// ─── Create booking ───────────────────────────────────────────────────────────
bookingsRouter.post(
  '/',
  requireAuth,
  [
    body('prebookId').notEmpty(),
    body('hotelId').notEmpty(),
    body('checkin').isDate(),
    body('checkout').isDate(),
    body('adults').isInt({ min: 1 }),
    body('guest.firstName').notEmpty(),
    body('guest.lastName').notEmpty(),
    body('guest.email').isEmail(),
    body('paymentMethod').isIn(['card', 'usdc', 'wld', 'stripe_onramp']),
    body('totalAmount').isFloat({ min: 0 }),
    body('currency').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Invalid booking data', 'VALIDATION_ERROR'));
      }

      const {
        prebookId,
        hotelId,
        checkin,
        checkout,
        adults,
        guest,
        paymentMethod,
        totalAmount,
        currency,
        roomType,
        ratePlan,
        cancellationPolicy,
        mealPlan,
        stripePaymentIntentId,
        creditToRedeem = 0,
      } = req.body;

      const baseAmount = totalAmount / (1 + ADELBO_MARGIN);
      const marginAmount = totalAmount - baseAmount;
      const travelCreditEarned = baseAmount * TRAVEL_CREDIT_RATE;
      const poolContribution = baseAmount * POOL_RATE;
      const effectiveAmount = totalAmount - creditToRedeem;

      const clientReference = `adelbo-${uuidv4()}`;

      // Create pending booking record
      const [booking] = await db
        .insert(bookings)
        .values({
          userId: req.user!.userId,
          hotelId,
          liteApiPreBookId: prebookId,
          status: 'pending_payment',
          checkIn: new Date(checkin),
          checkOut: new Date(checkout),
          guests: adults,
          roomType,
          ratePlan,
          cancellationPolicy,
          mealPlan,
          baseAmount: baseAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          currency,
          marginAmount: marginAmount.toFixed(2),
          travelCreditEarned: travelCreditEarned.toFixed(2),
          poolContribution: poolContribution.toFixed(2),
          creditRedeemed: creditToRedeem.toFixed(2),
          paymentMethod,
          stripePaymentIntentId,
          guestFirstName: guest.firstName,
          guestLastName: guest.lastName,
          guestEmail: guest.email,
          guestPhone: guest.phone,
        })
        .returning();

      await db.insert(bookingEvents).values({
        bookingId: booking.id,
        eventType: 'booking_created',
        toStatus: 'pending_payment',
        metadata: { clientReference },
      });

      // Get AI confidence summary
      let confidenceSummary: string | null = null;
      try {
        const [hotelRecord] = await db.select().from(hotels).where(eq(hotels.id, hotelId)).limit(1);
        if (hotelRecord) {
          const aiResult = await bookingConfidenceSummary({
            hotel: hotelRecord,
            rate: { name: ratePlan, cancellationPolicies: cancellationPolicy },
            checkin,
            checkout,
            totalAmount: effectiveAmount,
            currency,
            travelCreditEarned,
            poolContribution,
          });
          confidenceSummary = aiResult.content;
        }
      } catch (aiErr) {
        logger.warn('Could not generate confidence summary', { bookingId: booking.id });
      }

      res.status(201).json({
        bookingId: booking.id,
        status: 'pending_payment',
        clientReference,
        travelCreditToEarn: travelCreditEarned.toFixed(2),
        poolContribution: poolContribution.toFixed(2),
        effectiveAmount: effectiveAmount.toFixed(2),
        currency,
        confidenceSummary,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Confirm booking (called after payment success) ───────────────────────────
bookingsRouter.post('/:bookingId/confirm', requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { stripePaymentIntentId, onChainTxHash } = req.body;

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, req.user!.userId)))
      .limit(1);

    if (!booking) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));
    if (booking.status !== 'pending_payment') {
      return next(new AppError(400, 'Booking already processed', 'INVALID_STATE'));
    }

    // Submit to LiteAPI
    let liteApiResult;
    try {
      liteApiResult = await liteapi.book({
        prebookId: booking.liteApiPreBookId!,
        guestInfo: {
          guestFirstName: booking.guestFirstName!,
          guestLastName: booking.guestLastName!,
          guestEmail: booking.guestEmail!,
          guestPhone: booking.guestPhone || undefined,
        },
        payment: {
          holderName: `${booking.guestFirstName} ${booking.guestLastName}`,
          type: 'CREDIT_CARD',
        },
        clientReference: `adelbo-${bookingId}`,
      });
    } catch (bookErr: any) {
      logger.error('LiteAPI booking failed', { bookingId, error: bookErr.message });
      return next(new AppError(502, 'Booking submission failed — you will not be charged', 'LITEAPI_ERROR'));
    }

    const liteApiBookingId = liteApiResult?.data?.bookingId;

    // Update booking to confirmed
    await db
      .update(bookings)
      .set({
        status: 'confirmed',
        liteApiBookingId,
        stripePaymentIntentId: stripePaymentIntentId || booking.stripePaymentIntentId,
        onChainTxHash,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId));

    await db.insert(bookingEvents).values({
      bookingId,
      eventType: 'booking_confirmed',
      fromStatus: 'pending_payment',
      toStatus: 'confirmed',
      metadata: { liteApiBookingId, onChainTxHash },
    });

    // Send confirmation email
    try {
      await sendBookingConfirmation(booking.guestEmail!, {
        bookingId,
        hotelId: booking.hotelId,
        checkIn: booking.checkIn.toISOString(),
        checkOut: booking.checkOut.toISOString(),
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        travelCreditEarned: booking.travelCreditEarned || '0',
      });
    } catch (emailErr) {
      logger.warn('Confirmation email failed', { bookingId });
    }

    res.json({ status: 'confirmed', liteApiBookingId });
  } catch (err) {
    next(err);
  }
});

// ─── Get user bookings ─────────────────────────────────────────────────────────
bookingsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userBookings = await db
      .select({
        booking: bookings,
        hotel: hotels,
      })
      .from(bookings)
      .leftJoin(hotels, eq(bookings.hotelId, hotels.id))
      .where(eq(bookings.userId, req.user!.userId))
      .orderBy(desc(bookings.createdAt))
      .limit(50);

    res.json({ bookings: userBookings });
  } catch (err) {
    next(err);
  }
});

// ─── Get booking detail ───────────────────────────────────────────────────────
bookingsRouter.get('/:bookingId', requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const [result] = await db
      .select({ booking: bookings, hotel: hotels })
      .from(bookings)
      .leftJoin(hotels, eq(bookings.hotelId, hotels.id))
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, req.user!.userId)))
      .limit(1);

    if (!result) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));

    const events = await db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, bookingId))
      .orderBy(desc(bookingEvents.createdAt));

    res.json({ ...result, events });
  } catch (err) {
    next(err);
  }
});

// ─── Cancel booking ───────────────────────────────────────────────────────────
bookingsRouter.post('/:bookingId/cancel', requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, req.user!.userId)))
      .limit(1);

    if (!booking) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));
    if (!['confirmed', 'active'].includes(booking.status)) {
      return next(new AppError(400, 'Cannot cancel this booking', 'INVALID_STATE'));
    }

    // Cancel via LiteAPI
    if (booking.liteApiBookingId) {
      try {
        await liteapi.cancelBooking(booking.liteApiBookingId);
      } catch (cancelErr: any) {
        logger.error('LiteAPI cancel failed', { bookingId, error: cancelErr.message });
        return next(new AppError(502, 'Cancellation failed — please contact support', 'CANCEL_FAILED'));
      }
    }

    await db
      .update(bookings)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(bookings.id, bookingId));

    await db.insert(bookingEvents).values({
      bookingId,
      eventType: 'booking_cancelled',
      fromStatus: booking.status,
      toStatus: 'cancelled',
      metadata: { reason },
    });

    res.json({ status: 'cancelled' });
  } catch (err) {
    next(err);
  }
});

// ─── AI: Rescue Agent ─────────────────────────────────────────────────────────
bookingsRouter.post('/:bookingId/ai/rescue', requireAuth, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason, newDates, message } = req.body;

    const [result] = await db
      .select({ booking: bookings, hotel: hotels })
      .from(bookings)
      .leftJoin(hotels, eq(bookings.hotelId, hotels.id))
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, req.user!.userId)))
      .limit(1);

    if (!result) return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));

    const aiResponse = await rescueAgent({
      booking: {
        ...result.booking,
        hotelName: result.hotel?.name,
      },
      reason,
      newDates,
      userMessage: message || reason,
    });

    res.json({ content: aiResponse.content, latencyMs: aiResponse.latencyMs });
  } catch (err) {
    next(err);
  }
});
