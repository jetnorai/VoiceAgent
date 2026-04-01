import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { intentSearchCopilot } from '../services/claude';

export const aiRouter = Router();

// ─── Intent search copilot ────────────────────────────────────────────────────
aiRouter.post('/intent', optionalAuth, async (req, res, next) => {
  try {
    const { query, checkin, checkout, adults, budget, currency } = req.body;

    if (!query || !checkin || !checkout || !adults) {
      return next(new AppError(400, 'Missing required fields', 'VALIDATION_ERROR'));
    }

    const result = await intentSearchCopilot({ query, checkin, checkout, adults, budget, currency });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
