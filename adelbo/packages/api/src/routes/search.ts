import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { liteapi } from '../services/liteapi';
import { intentSearchCopilot } from '../services/claude';
import { optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { db } from '../db/client';
import { hotels } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { cache } from '../services/redis';

export const searchRouter = Router();

const ADELBO_MARGIN = 0.05; // 5%

function applyMargin(amount: number): number {
  return Math.round(amount * (1 + ADELBO_MARGIN) * 100) / 100;
}

// ─── Standard hotel search ─────────────────────────────────────────────────────
searchRouter.get(
  '/',
  optionalAuth,
  [
    query('checkin').isDate(),
    query('checkout').isDate(),
    query('adults').isInt({ min: 1, max: 10 }),
    query('destination').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Invalid search parameters', 'VALIDATION_ERROR'));
      }

      const {
        checkin,
        checkout,
        adults,
        destination,
        currency = 'USD',
        limit = '20',
        offset = '0',
      } = req.query as Record<string, string>;

      // Check Redis cache first (5-minute TTL for search results)
      const cacheKey = `search:${destination}:${checkin}:${checkout}:${adults}:${currency}:${limit}:${offset}`;
      const cachedResults = await cache.get(cacheKey);
      if (cachedResults) {
        return res.json(cachedResults);
      }

      // Try to determine if destination is a city or country code
      const isCountryCode = /^[A-Z]{2}$/.test(destination);

      const results = await liteapi.searchHotels({
        checkin,
        checkout,
        adults: parseInt(adults),
        currency,
        cityName: isCountryCode ? undefined : destination,
        countryCode: isCountryCode ? destination : undefined,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Apply Adelbo 5% margin to all prices
      const hotelsWithMargin = (results?.data || []).map((hotel: any) => ({
        ...hotel,
        minRate: hotel.minRate ? applyMargin(hotel.minRate) : null,
        _originalMinRate: hotel.minRate,
      }));

      const responseBody = {
        hotels: hotelsWithMargin,
        total: results?.total || hotelsWithMargin.length,
        checkin,
        checkout,
        adults: parseInt(adults),
        currency,
      };

      // Cache the search results in Redis (5-minute TTL)
      await cache.set(cacheKey, responseBody, 300);

      res.json(responseBody);
    } catch (err) {
      next(err);
    }
  }
);

// ─── AI-powered intent search ─────────────────────────────────────────────────
// Not cached — results are personalized per user query
searchRouter.post('/intent', optionalAuth, async (req, res, next) => {
  try {
    const { query: userQuery, checkin, checkout, adults, budget, currency = 'USD' } = req.body;

    if (!userQuery || !checkin || !checkout || !adults) {
      return next(new AppError(400, 'Missing required fields', 'VALIDATION_ERROR'));
    }

    // Get AI interpretation
    const aiResult = await intentSearchCopilot({
      query: userQuery,
      checkin,
      checkout,
      adults,
      budget,
      currency,
    });

    const { structuredQuery } = aiResult;

    // Execute the structured search
    let searchResults;
    try {
      searchResults = await liteapi.searchHotels({
        checkin,
        checkout,
        adults,
        currency,
        cityName: structuredQuery.destination,
        limit: 20,
      });
    } catch (searchErr) {
      logger.warn('LiteAPI search failed after intent parse', { error: searchErr });
      searchResults = { data: [] };
    }

    const allHotels = (searchResults?.data || []).map((hotel: any) => ({
      ...hotel,
      minRate: hotel.minRate ? applyMargin(hotel.minRate) : null,
    }));

    // Categorize results (simple heuristic categorization)
    const categorized = {
      bestForWork: allHotels.filter((h: any) =>
        h.amenities?.some((a: string) =>
          ['wifi', 'business center', 'desk', 'meeting room'].some(k => a.toLowerCase().includes(k))
        )
      ).slice(0, 5),
      bestVibeMatch: allHotels.slice(0, 5),
      bestValue: [...allHotels].sort((a: any, b: any) =>
        (a.reviewScore || 0) / (a.minRate || 1) - (b.reviewScore || 0) / (b.minRate || 1)
      ).slice(0, 5),
      bestFlexibility: allHotels.filter((h: any) => h.minRate).slice(0, 5),
    };

    res.json({
      query: userQuery,
      interpretation: aiResult.summary,
      structuredQuery,
      hotels: allHotels,
      categories: categorized,
      checkin,
      checkout,
      adults,
      currency,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Destination suggestions (autocomplete) ───────────────────────────────────
searchRouter.get('/destinations', async (req, res, next) => {
  try {
    const { q } = req.query as { q?: string };
    if (!q || q.length < 2) {
      return res.json({ destinations: [] });
    }

    // Return popular destinations that match
    const popularDestinations = [
      { name: 'Paris, France', code: 'FR', type: 'city' },
      { name: 'London, United Kingdom', code: 'GB', type: 'city' },
      { name: 'New York, United States', code: 'US', type: 'city' },
      { name: 'Tokyo, Japan', code: 'JP', type: 'city' },
      { name: 'Barcelona, Spain', code: 'ES', type: 'city' },
      { name: 'Amsterdam, Netherlands', code: 'NL', type: 'city' },
      { name: 'Dubai, UAE', code: 'AE', type: 'city' },
      { name: 'Rome, Italy', code: 'IT', type: 'city' },
      { name: 'Bali, Indonesia', code: 'ID', type: 'city' },
      { name: 'Bangkok, Thailand', code: 'TH', type: 'city' },
      { name: 'Singapore', code: 'SG', type: 'city' },
      { name: 'Sydney, Australia', code: 'AU', type: 'city' },
      { name: 'Lisbon, Portugal', code: 'PT', type: 'city' },
      { name: 'Istanbul, Turkey', code: 'TR', type: 'city' },
      { name: 'Miami, United States', code: 'US', type: 'city' },
    ];

    const filtered = popularDestinations.filter(d =>
      d.name.toLowerCase().includes(q.toLowerCase())
    );

    res.json({ destinations: filtered });
  } catch (err) {
    next(err);
  }
});
