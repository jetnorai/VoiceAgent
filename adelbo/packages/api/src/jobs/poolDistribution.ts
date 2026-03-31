/**
 * Pool Distribution Job
 *
 * In production, this is triggered by the Chainlink CRE monthly cron.
 * The CRE DON runs BFT consensus across nodes to compute deterministic
 * winner selection, then calls RewardPool.distributePool() on-chain.
 *
 * This file mirrors the off-chain computation logic for transparency
 * and provides the admin fallback trigger.
 */

import { eq, and, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { poolCycles, poolContributions, users } from '../db/schema';
import { logger } from '../utils/logger';
import cron from 'node-cron';
import { distributePoolOnChain } from '../services/blockchain';

interface PoolParticipant {
  userId: string;
  walletAddress: string | null;
  totalContribution: number;
  loyaltyScore: number;
}

/**
 * Compute winner list for a cycle using the same deterministic algorithm
 * as the Chainlink CRE nodes.
 *
 * loyaltyScore = contribution × bookingCount × tierMultiplier × streakBonus
 */
export async function computeCycleWinners(
  cycleId: string,
  winnerCount: number = 3
): Promise<PoolParticipant[]> {
  const contributions = await db
    .select({
      contribution: poolContributions,
      user: users,
    })
    .from(poolContributions)
    .leftJoin(users, eq(poolContributions.userId, users.id))
    .where(eq(poolContributions.cycleId, cycleId));

  if (contributions.length === 0) return [];

  // Aggregate per user
  const participantMap = new Map<string, PoolParticipant>();
  for (const { contribution, user } of contributions) {
    if (!participantMap.has(contribution.userId)) {
      participantMap.set(contribution.userId, {
        userId: contribution.userId,
        walletAddress: user?.walletAddress || user?.custodialWalletAddress || null,
        totalContribution: 0,
        loyaltyScore: 0,
      });
    }
    const p = participantMap.get(contribution.userId)!;
    p.totalContribution += parseFloat(contribution.amount);
  }

  // Compute loyalty scores
  const tierMultipliers: Record<string, number> = {
    explorer: 1,
    adventurer: 2,
    voyager: 3,
    globetrotter: 5,
  };

  for (const [userId, participant] of participantMap) {
    const userContribs = contributions.filter(c => c.contribution.userId === userId);
    const user = contributions.find(c => c.contribution.userId === userId)?.user;
    const tier = user?.tier || 'explorer';
    const tierMult = tierMultipliers[tier] || 1;
    const bookingCount = userContribs.length;
    const streakBonus = bookingCount >= 3 ? 1.2 : 1;

    participant.loyaltyScore = participant.totalContribution * bookingCount * tierMult * streakBonus;
  }

  // Sort by loyalty score descending (deterministic)
  const sorted = Array.from(participantMap.values()).sort(
    (a, b) => b.loyaltyScore - a.loyaltyScore
  );

  return sorted.slice(0, Math.min(winnerCount, sorted.length));
}

/**
 * Distribute pool (admin fallback — normally done by CRE).
 */
export async function distributePool(cycleId: string): Promise<void> {
  const [cycle] = await db.select().from(poolCycles).where(eq(poolCycles.id, cycleId)).limit(1);
  if (!cycle) throw new Error('Cycle not found');
  if (cycle.status !== 'active') throw new Error('Cycle not active');
  if (new Date() < cycle.endsAt) throw new Error('Cycle not yet ended');

  const totalAmount = parseFloat(cycle.totalAmount);
  const winnerCount = cycle.winnerCount || 3;
  const winners = await computeCycleWinners(cycleId, winnerCount);

  if (winners.length === 0) {
    logger.warn('No pool participants for distribution', { cycleId });
    await db.update(poolCycles).set({ status: 'completed', distributedAt: new Date() }).where(eq(poolCycles.id, cycleId));
    return;
  }

  // Proportional distribution by loyalty score
  const totalScore = winners.reduce((s, w) => s + w.loyaltyScore, 0);

  let distributed = 0;
  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i];
    const amount = i === winners.length - 1
      ? totalAmount - distributed
      : Math.round((totalAmount * winner.loyaltyScore / totalScore) * 100) / 100;

    distributed += amount;

    await db
      .update(poolContributions)
      .set({
        isWinner: true,
        winnerRank: i + 1,
        distributionAmount: amount.toFixed(2),
      })
      .where(
        and(
          eq(poolContributions.userId, winner.userId),
          eq(poolContributions.cycleId, cycleId)
        )
      );

    logger.info('Pool winner', { rank: i + 1, userId: winner.userId, amount, loyaltyScore: winner.loyaltyScore });
  }

  // Execute on-chain distribution for winners with wallet addresses
  const onChainWinners = winners.filter((w) => w.walletAddress);
  if (onChainWinners.length > 0) {
    try {
      const { hash } = await distributePoolOnChain(onChainWinners as Array<{ walletAddress: string; loyaltyScore: number }>);
      logger.info('On-chain pool distribution tx', { cycleId, hash });
    } catch (err: any) {
      logger.error('On-chain distribution failed, payouts pending manual retry', {
        cycleId,
        error: err.message,
      });
      // Do not throw — DB state is already updated, on-chain can be retried
    }
  }

  await db
    .update(poolCycles)
    .set({ status: 'completed', distributedAt: new Date() })
    .where(eq(poolCycles.id, cycleId));

  logger.info('Pool distributed', { cycleId, totalAmount, winnerCount: winners.length });
}

/**
 * Start the cron-scheduled pool distribution job.
 * Runs daily at 00:05 UTC. Finds all active cycles that have passed their end date.
 */
export function startPoolDistributionJob(): void {
  cron.schedule('5 0 * * *', async () => {
    try {
      const expired = await db
        .select()
        .from(poolCycles)
        .where(
          and(
            eq(poolCycles.status, 'active'),
            lte(poolCycles.endsAt, new Date()),
          )
        );

      if (expired.length === 0) {
        logger.info('Pool distribution: no expired cycles');
        return;
      }

      for (const cycle of expired) {
        logger.info('Distributing pool cycle', { cycleId: cycle.id });
        await distributePool(cycle.id);
      }
    } catch (err: any) {
      logger.error('Pool distribution job failed', { error: err.message });
    }
  });

  logger.info('Pool distribution job scheduled (daily 00:05 UTC)');
}
