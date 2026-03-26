import { Router } from 'express';
import { query, param, validationResult } from 'express-validator';
import { eq } from 'drizzle-orm';
import { liteapi } from '../services/liteapi';
import { hotelTruthLayer, rateAdvisor, priceTiming } from '../services/claude';
import { optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { db } from '../db/client';
import { hotels, reviews, aiRecommendationEvents } from '../db/schema';
import { logger } from '../utils/logger';
import { cache } from '../services/redis';

export const hotelsRouter = Router();

const ADELBO_MARGIN = 0.05;
function applyMargin(amount: number): number {
  return Math.round(amount * (1 + ADELBO_MARGIN) * 100) / 100;
}

// ─── Get hotel detail ──────────────────────────────────────────────────────────
hotelsRouter.get('/:hotelId', optionalAuth, async (req, res, next) => {
  try {
    const { hotelId } = req.params;

    // Check Redis cache first
    const cacheKey = `hotel:${hotelId}`;
    const cachedRedis = await cache.get(cacheKey);
    if (cachedRedis) {
      const verifiedReviews = await db
        .select()
        .from(reviews)
        .where(eq(reviews.hotelId, hotelId))
        .limit(20);

      return res.json({
        hotel: cachedRedis,
        verifiedReviews,
      });
    }

    // Check DB cache
    const [cached] = await db.select().from(hotels).where(eq(hotels.id, hotelId)).limit(1);

    let hotelData: any;
    if (cached && cached.cachedAt && Date.now() - cached.cachedAt.getTime() < 3600000) {
      hotelData = cached;
    } else {
      // Fetch from LiteAPI
      const apiResult = await liteapi.getHotel(hotelId);
      hotelData = apiResult?.data;

      if (!hotelData) {
        return next(new AppError(404, 'Hotel not found', 'HOTEL_NOT_FOUND'));
      }

      // Cache the hotel in DB
      await db
        .insert(hotels)
        .values({
          id: hotelId,
          name: hotelData.name || 'Unknown Hotel',
          city: hotelData.city,
          country: hotelData.country,
          countryCode: hotelData.countryCode,
          latitude: hotelData.latitude?.toString(),
          longitude: hotelData.longitude?.toString(),
          starRating: hotelData.starRating,
          reviewScore: hotelData.guestScore?.toString(),
          thumbnailUrl: hotelData.thumbnailUrl,
          images: hotelData.images || [],
          amenities: hotelData.amenities || [],
          description: hotelData.description,
          address: hotelData.address,
          rawData: hotelData,
          cachedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: hotels.id,
          set: {
            rawData: hotelData,
            cachedAt: new Date(),
          },
        });
    }

    // Store in Redis cache (1 hour TTL)
    await cache.set(cacheKey, hotelData, 3600);

    // Get verified reviews from our DB
    const verifiedReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.hotelId, hotelId))
      .limit(20);

    res.json({
      hotel: hotelData,
      verifiedReviews,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Get hotel rates ──────────────────────────────────────────────────────────
hotelsRouter.get(
  '/:hotelId/rates',
  optionalAuth,
  [
    query('checkin').isDate(),
    query('checkout').isDate(),
    query('adults').isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Invalid parameters', 'VALIDATION_ERROR'));
      }

      const { hotelId } = req.params;
      const {
        checkin,
        checkout,
        adults,
        currency = 'USD',
        guestNationality = 'US',
      } = req.query as Record<string, string>;

      // Check Redis cache first (5-minute TTL for rates)
      const cacheKey = `rates:${hotelId}:${checkin}:${checkout}:${adults}`;
      const cachedRates = await cache.get(cacheKey);
      if (cachedRates) {
        return res.json({ rates: cachedRates, hotelId, checkin, checkout, adults, currency });
      }

      const result = await liteapi.getHotelRates({
        hotelId,
        checkin,
        checkout,
        adults: parseInt(adults),
        currency,
        guestNationality,
      });

      const rates = (result?.data || []).map((rate: any) => ({
        ...rate,
        retailRate: rate.retailRate
          ? {
              ...rate.retailRate,
              total: rate.retailRate.total?.map((t: any) => ({
                ...t,
                amount: applyMargin(t.amount),
                originalAmount: t.amount,
              })),
            }
          : rate.retailRate,
      }));

      // Cache the rates in Redis (5-minute TTL)
      await cache.set(cacheKey, rates, 300);

      res.json({ rates, hotelId, checkin, checkout, adults, currency });
    } catch (err) {
      next(err);
    }
  }
);

// ─── AI: Hotel Truth Layer ────────────────────────────────────────────────────
hotelsRouter.post('/:hotelId/ai/truth', optionalAuth, async (req, res, next) => {
  try {
    const { hotelId } = req.params;
    const { checkin, checkout, adults, userQuery } = req.body;

    if (!checkin || !checkout || !adults) {
      return next(new AppError(400, 'Missing stay details', 'VALIDATION_ERROR'));
    }

    // Fetch hotel data
    const [cachedHotel] = await db.select().from(hotels).where(eq(hotels.id, hotelId)).limit(1);
    let hotelData: any = cachedHotel?.rawData || cachedHotel;

    if (!hotelData) {
      const apiResult = await liteapi.getHotel(hotelId);
      hotelData = apiResult?.data;
    }

    if (!hotelData) {
      return next(new AppError(404, 'Hotel not found', 'HOTEL_NOT_FOUND'));
    }

    // Fetch reviews (LiteAPI + our verified)
    let externalReviews: any[] = [];
    try {
      const reviewResult = await liteapi.getHotelReviews(hotelId);
      externalReviews = reviewResult?.data || [];
    } catch {
      logger.warn('Could not fetch external reviews', { hotelId });
    }

    const aiResponse = await hotelTruthLayer({
      hotel: hotelData,
      rates: [],
      reviews: externalReviews,
      userQuery,
      checkin,
      checkout,
      adults,
    });

    // Log AI event
    await db.insert(aiRecommendationEvents).values({
      userId: req.user?.userId,
      surface: 'hotel_truth',
      hotelId,
      prompt: `Hotel truth for ${hotelId}`,
      response: aiResponse.content,
      inputTokens: aiResponse.inputTokens,
      outputTokens: aiResponse.outputTokens,
      latencyMs: aiResponse.latencyMs,
    });

    res.json({
      content: aiResponse.content,
      latencyMs: aiResponse.latencyMs,
    });
  } catch (err) {
    next(err);
  }
});

// ─── AI: Rate Advisor ─────────────────────────────────────────────────────────
hotelsRouter.post('/:hotelId/ai/rates', optionalAuth, async (req, res, next) => {
  try {
    const { rates, checkin, checkout, tripCertainty = 'likely', currency = 'USD' } = req.body;

    if (!rates?.length || !checkin || !checkout) {
      return next(new AppError(400, 'Missing required fields', 'VALIDATION_ERROR'));
    }

    const aiResponse = await rateAdvisor({ rates, checkin, checkout, tripCertainty, currency });

    res.json({ content: aiResponse.content, latencyMs: aiResponse.latencyMs });
  } catch (err) {
    next(err);
  }
});

// ─── AI: Price Timing ─────────────────────────────────────────────────────────
hotelsRouter.post('/:hotelId/ai/timing', optionalAuth, async (req, res, next) => {
  try {
    const { hotelId } = req.params;
    const { hotelName, currentPrice, checkin, checkout, currency = 'USD' } = req.body;

    // Fetch price index
    let priceIndex: any = {};
    try {
      priceIndex = await liteapi.getPriceIndex({ hotelIds: [hotelId], checkin, checkout, currency });
    } catch {
      logger.warn('Could not fetch price index', { hotelId });
    }

    const aiResponse = await priceTiming({ hotelName, currentPrice, priceIndex, checkin, checkout, currency });
    res.json({ content: aiResponse.content, latencyMs: aiResponse.latencyMs });
  } catch (err) {
    next(err);
  }
});

// ─── AI: Feedback ─────────────────────────────────────────────────────────────
hotelsRouter.post('/ai/feedback', optionalAuth, async (req, res, next) => {
  try {
    const { eventId, helpful } = req.body;
    await db
      .update(aiRecommendationEvents)
      .set({ helpful })
      .where(eq(aiRecommendationEvents.id, eventId));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
