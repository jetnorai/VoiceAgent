import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { intentSearchCopilot } from '../services/claude';
import { requireX402Payment } from '../middleware/x402';

export const aiRouter = Router();

// ─── Intent search copilot ────────────────────────────────────────────────────
aiRouter.post('/intent', optionalAuth, requireX402Payment({ usdCents: 5, description: 'Adelbo AI intent search — $0.05' }), async (req, res, next) => {
  try {
    const { query, checkin, checkout, adults, budget, currency } = req.body;

    if (!query || !checkin || !checkout || !adults) {
      return next(new AppError(400, 'Missing required fields', 'VALIDATION_ERROR'));
    }

    const result = await intentSearchCopilot({ query, checkin, checkout, adults, budget, currency });
    res.json(result);
    // Settle x402 payment after response
    if (res.locals.x402Settle) res.locals.x402Settle().catch(() => {});
  } catch (err) {
    next(err);
  }
});
