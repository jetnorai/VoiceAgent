'use client';

import { useQuery } from '@tanstack/react-query';
import { poolApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { NavBar } from '@/components/layout/NavBar';
import { Users, Calendar, Trophy, Clock, ShieldCheck, Loader2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function PoolPage() {
  const { token } = useAuthStore();

  const { data: currentData, isLoading } = useQuery({
    queryKey: ['pool', 'current'],
    queryFn: () => poolApi.getCurrent().then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const { data: standingData } = useQuery({
    queryKey: ['pool', 'standing'],
    queryFn: () => poolApi.getMyStanding().then((r) => r.data),
    enabled: !!token,
  });

  const totalAmount = currentData?.totalAmount
    ? parseFloat(currentData.totalAmount).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
    : '$0';

  const nextDistribution = currentData?.nextDistributionDate
    ? format(new Date(currentData.nextDistributionDate), 'MMMM d, yyyy')
    : '—';

  const pastDistributions = currentData?.pastDistributions || [];

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-2">
            Community Pool
          </h1>
          <p className="text-text-secondary text-base max-w-2xl">
            Every completed Adelbo booking contributes 2% to the Pool. At the end of each month,
            the Pool is shared with the most active, verified travelers — based on booking history,
            not chance.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="text-amber animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pool stats */}
            <div className="glass-card p-6 glow-amber">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <p className="section-label mb-1">Pool size</p>
                  <p className="font-display font-bold text-3xl text-amber">{totalAmount}</p>
                </div>
                <div>
                  <p className="section-label mb-1">Participants</p>
                  <p className="font-display font-bold text-3xl text-text-primary">
                    {currentData?.participantCount || 0}
                  </p>
                </div>
                <div>
                  <p className="section-label mb-1">Days remaining</p>
                  <div className="flex items-center gap-1.5">
                    <Clock size={16} className="text-text-muted" />
                    <p className="font-display font-bold text-3xl text-text-primary">
                      {currentData?.daysUntilDistribution ?? '—'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="section-label mb-1">Distribution</p>
                  <p className="font-semibold text-text-primary">{nextDistribution}</p>
                </div>
              </div>
            </div>

            {/* Eligibility */}
            {token ? (
              <div className={`glass-card p-5 ${currentData?.isEligible ? 'border-success/30' : 'border-bg-border'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${currentData?.isEligible ? 'bg-success/10' : 'bg-bg-elevated'}`}>
                    <ShieldCheck size={18} className={currentData?.isEligible ? 'text-success' : 'text-text-muted'} />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary">
                      {currentData?.isEligible ? 'You\'re eligible this cycle' : 'Not yet eligible this cycle'}
                    </p>
                    <p className="text-text-muted text-sm">
                      {currentData?.isEligible
                        ? 'Complete your stay and you\'ll be in the distribution.'
                        : 'Book and complete a stay this month to participate.'}
                    </p>
                  </div>
                </div>

                {standingData && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-bg-border text-sm">
                    <div>
                      <p className="text-text-muted text-xs">Contributed</p>
                      <p className="font-medium text-text-primary">${parseFloat(standingData.totalContributed || '0').toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Cycles</p>
                      <p className="font-medium text-text-primary">{standingData.cyclesParticipated}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Wins</p>
                      <p className="font-medium text-text-primary">{standingData.wins}</p>
                    </div>
                    <div>
                      <p className="text-text-muted text-xs">Loyalty score</p>
                      <p className="font-medium text-amber">{parseFloat(standingData.loyaltyScore || '0').toFixed(0)}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card p-5 text-center">
                <p className="text-text-muted mb-3">Sign in to check your Pool eligibility and standing.</p>
                <Link href="/auth" className="btn-primary px-6 py-2 text-sm">Sign in</Link>
              </div>
            )}

            {/* How it works */}
            <div className="glass-card p-6">
              <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-amber" />
                How the Pool works
              </h2>
              <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber/10 text-amber text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <p>Every completed Adelbo booking contributes 2% of the booking value to the Pool. The contribution is recorded on World Chain.</p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber/10 text-amber text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <p>At the end of each 30-day cycle, the Pool is distributed to active participants. Winners are selected by loyalty score — based on how much you've contributed, how often you book, and your tier.</p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber/10 text-amber text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                  <p>The selection is deterministic and transparent — all calculations are verifiable on-chain. Higher tiers earn a multiplier that strengthens your position.</p>
                </div>
                <div className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber/10 text-amber text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                  <p>Only completed, oracle-verified stays qualify. Cancelled or refunded bookings do not contribute.</p>
                </div>
              </div>
            </div>

            {/* Past distributions */}
            {pastDistributions.length > 0 && (
              <div className="glass-card p-5">
                <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Trophy size={18} className="text-amber" />
                  Past distributions
                </h2>
                <div className="space-y-3">
                  {pastDistributions.map((cycle: any) => (
                    <div key={cycle.id} className="flex items-center justify-between py-2 border-b border-bg-border last:border-0">
                      <div>
                        <p className="font-medium text-text-primary text-sm">Cycle {cycle.cycleNumber}</p>
                        <p className="text-text-muted text-xs">
                          {cycle.distributedAt
                            ? format(new Date(cycle.distributedAt), 'MMMM yyyy')
                            : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber font-semibold">
                          ${parseFloat(cycle.totalAmount || '0').toLocaleString()}
                        </p>
                        <p className="text-text-muted text-xs">{cycle.participantCount} participants</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
