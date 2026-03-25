import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { randomBytes } from 'crypto';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { addMinutes } from 'date-fns';
import { db } from '../db/client';
import { users, otpTokens, identityMethods } from '../db/schema';
import { signToken, requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { sendOTP } from '../services/email';
import { logger } from '../utils/logger';

export const authRouter = Router();

// ─── Email OTP: request code ──────────────────────────────────────────────────
authRouter.post(
  '/email/request-otp',
  [body('email').isEmail().normalizeEmail()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Invalid email address', 'VALIDATION_ERROR'));
      }

      const { email } = req.body;
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = addMinutes(new Date(), 10);

      await db.insert(otpTokens).values({ email, token, expiresAt });
      await sendOTP(email, token);

      res.json({ message: 'OTP sent to your email', expiresIn: 600 });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Email OTP: verify code ───────────────────────────────────────────────────
authRouter.post(
  '/email/verify-otp',
  [body('email').isEmail().normalizeEmail(), body('token').isLength({ min: 6, max: 6 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Invalid request', 'VALIDATION_ERROR'));
      }

      const { email, token } = req.body;

      // Find valid OTP
      const [otp] = await db
        .select()
        .from(otpTokens)
        .where(
          and(
            eq(otpTokens.email, email),
            eq(otpTokens.token, token),
            gt(otpTokens.expiresAt, new Date()),
            isNull(otpTokens.usedAt),
          )
        )
        .limit(1);

      if (!otp) {
        return next(new AppError(401, 'Invalid or expired code', 'INVALID_OTP'));
      }

      // Mark OTP used
      await db.update(otpTokens).set({ usedAt: new Date() }).where(eq(otpTokens.id, otp.id));

      // Find or create user
      let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (!user) {
        const referralCode = randomBytes(3).toString('hex').toUpperCase();
        [user] = await db
          .insert(users)
          .values({ email, referralCode })
          .returning();

        // Create identity method record
        await db.insert(identityMethods).values({
          userId: user.id,
          method: 'email',
          identifier: email,
          verifiedAt: new Date(),
        });

        logger.info('New user created via email OTP', { userId: user.id });
      }

      const jwtToken = signToken({
        userId: user.id,
        email: user.email || undefined,
        walletAddress: user.walletAddress || undefined,
      });

      res.json({
        token: jwtToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          tier: user.tier,
          walletAddress: user.walletAddress,
          isNewUser: !user.displayName,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── World ID: verify proof ───────────────────────────────────────────────────
authRouter.post(
  '/world/verify',
  [body('proof').notEmpty(), body('nullifierHash').notEmpty(), body('merkleRoot').notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(new AppError(400, 'Invalid World ID proof', 'VALIDATION_ERROR'));
      }

      const { proof, nullifierHash, merkleRoot, walletAddress } = req.body;

      // Verify with World ID Developer Portal
      const verifyResponse = await fetch(
        `https://developer.worldcoin.org/api/v1/verify/${process.env.WORLD_APP_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nullifier_hash: nullifierHash,
            merkle_root: merkleRoot,
            proof,
            verification_level: 'orb',
            action: 'adelbo-login',
          }),
        }
      );

      if (!verifyResponse.ok) {
        return next(new AppError(401, 'World ID verification failed', 'WORLD_ID_INVALID'));
      }

      // Find or create user
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.worldId, nullifierHash))
        .limit(1);

      if (!user) {
        const referralCode = randomBytes(3).toString('hex').toUpperCase();
        [user] = await db
          .insert(users)
          .values({
            worldId: nullifierHash,
            walletAddress,
            referralCode,
          })
          .returning();

        await db.insert(identityMethods).values({
          userId: user.id,
          method: 'world_id',
          identifier: nullifierHash,
          verifiedAt: new Date(),
        });

        logger.info('New user created via World ID', { userId: user.id });
      }

      const jwtToken = signToken({
        userId: user.id,
        worldId: user.worldId || undefined,
        walletAddress: user.walletAddress || undefined,
      });

      res.json({
        token: jwtToken,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          tier: user.tier,
          isNewUser: !user.displayName,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Get current user ─────────────────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
    if (!user) return next(new AppError(404, 'User not found', 'USER_NOT_FOUND'));

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      walletAddress: user.walletAddress,
      tier: user.tier,
      reputationScore: user.reputationScore,
      referralCode: user.referralCode,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Update profile ────────────────────────────────────────────────────────────
authRouter.patch(
  '/me',
  requireAuth,
  [body('displayName').optional().isLength({ min: 2, max: 100 })],
  async (req, res, next) => {
    try {
      const { displayName } = req.body;
      const [updated] = await db
        .update(users)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(users.id, req.user!.userId))
        .returning();

      res.json({ displayName: updated.displayName });
    } catch (err) {
      next(err);
    }
  }
);
