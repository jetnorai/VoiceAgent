import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { eq, and, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../db/client';
import { reviews, bookings, hotels, users } from '../db/schema';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const reviewsRouter = Router();

// ─── Get hotel reviews ────────────────────────────────────────────────────────
reviewsRouter.get('/hotel/:hotelId', optionalAuth, async (req, res, next) => {
  try {
    const { hotelId } = req.params;

    const hotelReviews = await db
      .select({
        review: reviews,
      })
      .from(reviews)
      .where(eq(reviews.hotelId, hotelId))
      .orderBy(desc(reviews.createdAt))
      .limit(50);

    const averageRating =
      hotelReviews.length > 0
        ? hotelReviews.reduce((sum, r) => sum + r.review.rating, 0) / hotelReviews.length
        : null;

    res.json({
      reviews: hotelReviews.map(r => ({
        id: r.review.id,
        rating: r.review.rating,
        title: r.review.title,
        content: r.review.content,
        tags: r.review.tags,
        travelPurpose: r.review.travelPurpose,
        wouldReturn: r.review.wouldReturn,
        onChainVerified: r.review.onChainVerified,
        createdAt: r.review.createdAt,
        // Don't expose userId or bookingId
      })),
      averageRating: averageRating ? Math.round(averageRating * 10) / 10 : null,
      count: hotelReviews.length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Submit review (verified stay only) ──────────────────────────────────────
reviewsRouter.post(
  '/',
  requireAuth,
  [
    body('bookingId').isUUID(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('content').isLength({ min: 50, max: 2000 }),
    body('title').optional().isLength({ max: 200 }),
    body('travelPurpose').optional().isIn(['leisure', 'business', 'family', 'couple']),
    body('wouldReturn').optional().isBoolean(),
    body('tags').optional().isArray(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Invalid review data', 'VALIDATION_ERROR'));
      }

      const { bookingId, rating, content, title, travelPurpose, wouldReturn, tags } = req.body;
      const userId = req.user!.userId;

      // Verify stay is completed
      const [booking] = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId)))
        .limit(1);

      if (!booking) {
        return next(new AppError(404, 'Booking not found', 'NOT_FOUND'));
      }

      if (booking.status !== 'completed') {
        return next(new AppError(403, 'Reviews can only be submitted after stay completion', 'STAY_NOT_COMPLETED'));
      }

      // Check for existing review
      const [existing] = await db
        .select()
        .from(reviews)
        .where(eq(reviews.bookingId, bookingId))
        .limit(1);

      if (existing) {
        return next(new AppError(409, 'You have already reviewed this stay', 'REVIEW_EXISTS'));
      }

      const contentHash = '0x' + createHash('keccak256').update(content).digest('hex');

      const [review] = await db
        .insert(reviews)
        .values({
          userId,
          bookingId,
          hotelId: booking.hotelId,
          rating,
          title,
          content,
          tags: tags || [],
          travelPurpose,
          wouldReturn,
          contentHash,
          onChainVerified: false, // Will be set by CRE oracle
        })
        .returning();

      // TODO: Trigger on-chain verification via Chainlink CRE

      logger.info('Review submitted', { reviewId: review.id, hotelId: booking.hotelId });

      res.status(201).json({
        id: review.id,
        rating: review.rating,
        onChainVerified: false,
        message: 'Review submitted. It will be verified and published shortly.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Get user's reviews ────────────────────────────────────────────────────────
reviewsRouter.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const userReviews = await db
      .select({ review: reviews, hotel: hotels })
      .from(reviews)
      .leftJoin(hotels, eq(reviews.hotelId, hotels.id))
      .where(eq(reviews.userId, req.user!.userId))
      .orderBy(desc(reviews.createdAt));

    res.json({ reviews: userReviews });
  } catch (err) {
    next(err);
  }
});
