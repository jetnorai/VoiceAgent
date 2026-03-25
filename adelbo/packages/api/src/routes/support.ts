import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db/client';
import { supportCases } from '../db/schema';
import { AppError } from '../middleware/errorHandler';
import { eq } from 'drizzle-orm';

const router = Router();

// POST /api/support — open a support case
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { subject, description, bookingId } = req.body;
    if (!subject || !description) throw new AppError('Subject and description required', 400);

    const [sc] = await db.insert(supportCases).values({
      userId: req.user!.id,
      bookingId: bookingId || null,
      subject,
      description,
      status: 'open',
    }).returning();

    res.json({ case: sc });
  } catch (err) {
    next(err);
  }
});

// GET /api/support — list user's cases
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const cases = await db.query.supportCases.findMany({
      where: eq(supportCases.userId, req.user!.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    res.json({ cases });
  } catch (err) {
    next(err);
  }
});

// GET /api/support/:id — get case
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const sc = await db.query.supportCases.findFirst({
      where: eq(supportCases.id, req.params.id),
    });
    if (!sc || sc.userId !== req.user!.id) throw new AppError('Not found', 404);
    res.json({ case: sc });
  } catch (err) {
    next(err);
  }
});

export default router;
