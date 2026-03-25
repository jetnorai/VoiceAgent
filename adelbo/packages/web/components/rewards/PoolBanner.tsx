'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { poolApi } from '@/lib/api';
import { Users, Clock, ArrowRight } from 'lucide-react';

export function PoolBanner() {
  const { data } = useQuery({
    queryKey: ['pool', 'current'],
    queryFn: () => poolApi.getCurrent().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const totalAmount = data?.totalAmount ? parseFloat(data.totalAmount).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }) : '—';
  const participants = data?.participantCount || 0;
  const days = data?.daysUntilDistribution ?? '—';

  return (
    <div className="bg-bg-surface border-y border-bg-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center flex-shrink-0">
              <Users size={20} className="text-amber" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-text-primary">Community Pool</span>
                <span className="chip chip-amber text-xs">Active</span>
              </div>
              <p className="text-text-muted text-sm">
                Every completed booking contributes 2% to the Pool — shared with active travelers monthly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 sm:gap-8 flex-shrink-0">
            <div className="text-center">
              <p className="font-display font-bold text-xl text-amber">{totalAmount}</p>
              <p className="text-text-muted text-xs">Pool size</p>
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-xl text-text-primary">{participants}</p>
              <p className="text-text-muted text-xs">Participants</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1">
                <Clock size={12} className="text-text-muted" />
                <p className="font-display font-bold text-xl text-text-primary">{days}</p>
              </div>
              <p className="text-text-muted text-xs">Days left</p>
            </div>

            <Link
              href="/pool"
              className="flex items-center gap-1.5 text-amber text-sm font-medium hover:underline"
            >
              View Pool <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
