import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { db } from '../db/client';
import { notifications } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// GET /api/notifications
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const unreadCount = rows.filter((n) => !n.readAt).length;
    res.json({ notifications: rows, unreadCount });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', requireAuth, async (req, res, next) => {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, req.params.id),
          eq(notifications.userId, req.user!.id)
        )
      );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.userId, req.user!.id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
