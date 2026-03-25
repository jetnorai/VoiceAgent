'use client';

import { useQuery } from '@tanstack/react-query';
import { rewardsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { NavBar } from '@/components/layout/NavBar';
import { CreditCard, TrendingUp, ArrowDownLeft, ArrowUpRight, Loader2, Gift } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { clsx } from 'clsx';

const TIER_INFO = {
  explorer: { label: 'Explorer', color: 'text-text-secondary', next: 'Adventurer', nextAt: 200 },
  adventurer: { label: 'Adventurer', color: 'text-violet', next: 'Voyager', nextAt: 600 },
  voyager: { label: 'Voyager', color: 'text-amber', next: 'Globetrotter', nextAt: 1500 },
  globetrotter: { label: 'Globetrotter', color: 'text-amber', next: null, nextAt: null },
};

export default function RewardsPage() {
  const { token, user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['credit'],
    queryFn: () => rewardsApi.getCredit().then((r) => r.data),
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <Gift size={40} className="text-text-muted mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Your rewards</h1>
          <p className="text-text-muted mb-6">Sign in to see your Travel Credit balance and history.</p>
          <Link href="/auth" className="btn-primary">Sign in</Link>
        </main>
      </div>
    );
  }

  const tier = (user?.tier || 'explorer') as keyof typeof TIER_INFO;
  const tierInfo = TIER_INFO[tier];
  const balance = parseFloat(data?.balance || '0');
  const lifetimeEarned = parseFloat(data?.lifetimeEarned || '0');
  const lifetimeRedeemed = parseFloat(data?.lifetimeRedeemed || '0');
  const history = data?.history || [];
  const score = user?.reputationScore || 0;
  const progressToNext = tierInfo.nextAt
    ? Math.min(100, (score / tierInfo.nextAt) * 100)
    : 100;

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-8">Your rewards</h1>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="text-amber animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Travel Credit balance */}
            <div className="glass-card p-6 glow-amber">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="section-label mb-1">Travel Credit balance</p>
                  <p className="font-display text-5xl font-black text-text-primary">
                    ${balance.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber/10 flex items-center justify-center">
                  <CreditCard size={24} className="text-amber" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-bg-border">
                <div>
                  <p className="text-text-muted text-xs">Lifetime earned</p>
                  <p className="font-semibold text-success">${lifetimeEarned.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Lifetime redeemed</p>
                  <p className="font-semibold text-text-primary">${lifetimeRedeemed.toFixed(2)}</p>
                </div>
              </div>

              {balance > 0 && (
                <Link href="/" className="btn-primary mt-4 flex items-center justify-center gap-2 py-2.5 text-sm">
                  Use credit on next booking
                </Link>
              )}
            </div>

            {/* Tier / status */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="section-label mb-1">Your tier</p>
                  <p className={clsx('font-display font-bold text-2xl', tierInfo.color)}>
                    {tierInfo.label}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-text-muted text-xs">Reputation score</p>
                  <p className="font-bold text-text-primary text-lg">{score.toLocaleString()}</p>
                </div>
              </div>

              {tierInfo.nextAt && (
                <>
                  <div className="h-2 rounded-full bg-bg-elevated overflow-hidden mb-2">
                    <div
                      className="h-full bg-amber rounded-full transition-all duration-500"
                      style={{ width: `${progressToNext}%` }}
                    />
                  </div>
                  <p className="text-text-muted text-xs">
                    {score} / {tierInfo.nextAt} points to {tierInfo.next}
                  </p>
                </>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-bg-border text-sm">
                <div>
                  <p className="text-text-muted text-xs mb-0.5">Pool weight</p>
                  <p className="text-text-primary font-medium">
                    {tier === 'explorer' ? '1×' : tier === 'adventurer' ? '2×' : tier === 'voyager' ? '3×' : '5×'}
                  </p>
                </div>
                <div>
                  <p className="text-text-muted text-xs mb-0.5">Rate discount</p>
                  <p className="text-text-primary font-medium">
                    {tier === 'explorer' ? '0%' : tier === 'adventurer' ? '1%' : tier === 'voyager' ? '2%' : '3%'}
                  </p>
                </div>
              </div>
            </div>

            {/* Transaction history */}
            {history.length > 0 && (
              <div className="glass-card p-5">
                <h2 className="font-semibold text-text-primary mb-4">Credit history</h2>
                <div className="space-y-3">
                  {history.map((entry: any) => (
                    <div key={entry.id} className="flex items-center gap-3">
                      <div className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                        entry.type === 'earned' ? 'bg-success/10' : 'bg-bg-elevated'
                      )}>
                        {entry.type === 'earned'
                          ? <ArrowDownLeft size={15} className="text-success" />
                          : <ArrowUpRight size={15} className="text-text-muted" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-text-primary">{entry.description}</p>
                        <p className="text-xs text-text-muted">
                          {format(new Date(entry.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <span className={clsx(
                        'font-medium text-sm',
                        entry.type === 'earned' ? 'text-success' : 'text-text-primary'
                      )}>
                        {entry.type === 'earned' ? '+' : '-'}${parseFloat(entry.amount).toFixed(2)}
                      </span>
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
