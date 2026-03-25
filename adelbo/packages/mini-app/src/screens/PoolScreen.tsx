'use client';

import { useQuery } from '@tanstack/react-query';
import { poolApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Users, Clock, Trophy, ShieldCheck, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

export function PoolScreen() {
  const { token } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['pool', 'current'],
    queryFn: () => poolApi.getCurrent().then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const { data: standing } = useQuery({
    queryKey: ['pool', 'standing'],
    queryFn: () => poolApi.getMyStanding().then((r) => r.data),
    enabled: !!token,
  });

  const totalAmount = data?.totalAmount
    ? parseFloat(data.totalAmount).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })
    : '$0';

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-20">
      {/* Header */}
      <div className="px-4 pt-8 pb-4">
        <h1 className="font-display text-2xl font-bold text-text-primary">Community Pool</h1>
        <p className="text-text-muted text-sm mt-1">
          Every completed stay contributes 2% to the Pool.
        </p>
      </div>

      {/* Pool stats */}
      <div className="mx-4 bg-bg-surface border border-bg-border rounded-2xl p-5 mb-4">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-text-muted text-xs mb-1">Pool size</p>
            <p className="font-display font-bold text-3xl text-amber">{totalAmount}</p>
          </div>
          <div>
            <p className="text-text-muted text-xs mb-1">Participants</p>
            <p className="font-display font-bold text-3xl text-text-primary">
              {data?.participantCount || 0}
            </p>
          </div>
          <div>
            <p className="text-text-muted text-xs mb-1">Days left</p>
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-text-muted" />
              <p className="font-display font-bold text-3xl text-text-primary">
                {data?.daysUntilDistribution ?? '—'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-text-muted text-xs mb-1">Next reward</p>
            <p className="font-semibold text-text-primary text-sm">
              {data?.nextDistributionDate
                ? format(new Date(data.nextDistributionDate), 'MMM d')
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Eligibility */}
      {token ? (
        <div className={`mx-4 bg-bg-surface border rounded-2xl p-4 mb-4 ${data?.isEligible ? 'border-green-900/50' : 'border-bg-border'}`}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className={data?.isEligible ? 'text-success' : 'text-text-muted'} />
            <p className="font-medium text-text-primary text-sm">
              {data?.isEligible ? 'You\'re eligible this cycle' : 'Not eligible this cycle'}
            </p>
          </div>
          <p className="text-text-muted text-xs">
            {data?.isEligible
              ? 'Your completed stay qualifies for this month\'s distribution.'
              : 'Book and complete a stay this month to participate.'}
          </p>

          {standing && (
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-bg-border text-center text-xs">
              <div>
                <p className="text-text-muted">Contributed</p>
                <p className="font-semibold text-text-primary">${parseFloat(standing.totalContributed || '0').toFixed(2)}</p>
              </div>
              <div>
                <p className="text-text-muted">Cycles</p>
                <p className="font-semibold text-text-primary">{standing.cyclesParticipated}</p>
              </div>
              <div>
                <p className="text-text-muted">Wins</p>
                <p className="font-semibold text-amber">{standing.wins}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mx-4 bg-bg-surface border border-bg-border rounded-2xl p-4 mb-4 text-center">
          <p className="text-text-muted text-sm mb-2">Sign in to check your eligibility.</p>
          <Link href="/auth" className="btn-primary text-sm px-5 py-2">Sign in</Link>
        </div>
      )}

      {/* How it works — compact */}
      <div className="mx-4 bg-bg-surface border border-bg-border rounded-2xl p-4">
        <h3 className="font-semibold text-text-primary text-sm mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-amber" />
          How it works
        </h3>
        <div className="space-y-2 text-xs text-text-muted">
          <p>1. Every completed booking contributes 2% of booking value to the Pool.</p>
          <p>2. At month end, the Pool is shared with the most active verified travelers.</p>
          <p>3. Selection is based on loyalty score — booking history, tier, and streak.</p>
          <p>4. Only oracle-verified completed stays qualify.</p>
        </div>
      </div>
    </div>
  );
}
