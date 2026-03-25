'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { hotelsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Loader2, Sparkles, ChevronDown, ChevronUp, Check, ShieldCheck, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface RatesPanelProps {
  hotelId: string;
  checkin: string;
  checkout: string;
  adults: number;
  hotel: any;
  expanded?: boolean;
}

export function RatesPanel({ hotelId, checkin, checkout, adults, hotel, expanded }: RatesPanelProps) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [showAI, setShowAI] = useState(false);
  const [selectedRate, setSelectedRate] = useState<string | null>(null);
  const [tripCertainty, setTripCertainty] = useState<'definite' | 'likely' | 'uncertain'>('likely');

  const { data: ratesData, isLoading } = useQuery({
    queryKey: ['rates', hotelId, checkin, checkout, adults],
    queryFn: () =>
      hotelsApi.getRates(hotelId, {
        checkin,
        checkout,
        adults: adults.toString(),
        currency: 'USD',
      }).then((r) => r.data),
    enabled: !!checkin && !!checkout,
    staleTime: 5 * 60 * 1000,
  });

  const { data: aiRates, isLoading: aiLoading } = useQuery({
    queryKey: ['ai-rates', hotelId, checkin, checkout, adults, tripCertainty],
    queryFn: () =>
      hotelsApi.aiRates(hotelId, {
        rates: ratesData?.rates || [],
        checkin,
        checkout,
        tripCertainty,
        currency: 'USD',
      }).then((r) => r.data),
    enabled: showAI && !!ratesData?.rates?.length,
    staleTime: 10 * 60 * 1000,
  });

  const rates: any[] = ratesData?.rates || [];
  const nights = checkin && checkout
    ? Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000)
    : 1;

  function handleSelectRate(rateId: string) {
    if (!token) {
      toast.error('Sign in to book');
      router.push('/auth');
      return;
    }
    router.push(
      `/checkout?hotelId=${hotelId}&rateId=${rateId}&checkin=${checkin}&checkout=${checkout}&adults=${adults}`
    );
  }

  if (!checkin || !checkout) {
    return (
      <div className="glass-card p-5">
        <p className="text-text-muted text-sm">Select dates to see rates.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <h3 className="font-semibold text-text-primary mb-4">Available rates</h3>

        {isLoading ? (
          <div className="flex items-center gap-2 text-text-muted py-4">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading live rates…</span>
          </div>
        ) : rates.length === 0 ? (
          <p className="text-text-muted text-sm">No rates available for these dates.</p>
        ) : (
          <div className="space-y-3">
            {rates.slice(0, expanded ? undefined : 5).map((rate: any) => {
              const totalAmount = rate.retailRate?.total?.[0]?.amount;
              const perNight = totalAmount ? totalAmount / nights : null;
              const isRefundable = rate.refundable;
              const rateId = rate.rateId || rate.id;

              return (
                <div
                  key={rateId}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedRate === rateId
                      ? 'border-amber bg-amber/5'
                      : 'border-bg-border hover:border-amber/30'
                  }`}
                  onClick={() => setSelectedRate(rateId)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-text-primary text-sm">
                        {rate.roomTypeCode || rate.name || 'Standard Room'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {isRefundable ? (
                          <span className="flex items-center gap-1 text-xs text-success">
                            <RotateCcw size={10} /> Free cancellation
                          </span>
                        ) : (
                          <span className="text-xs text-text-muted">Non-refundable</span>
                        )}
                        {rate.boardType && (
                          <span className="text-xs text-text-muted">· {rate.boardType}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {perNight && (
                        <>
                          <p className="font-display font-bold text-text-primary">
                            ${perNight.toFixed(0)}<span className="text-text-muted text-xs font-normal">/night</span>
                          </p>
                          <p className="text-text-muted text-xs">${totalAmount.toFixed(0)} total</p>
                        </>
                      )}
                    </div>
                  </div>

                  {selectedRate === rateId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSelectRate(rateId); }}
                      className="btn-primary w-full mt-3 py-2.5 text-sm flex items-center justify-center gap-2"
                    >
                      <Check size={15} />
                      Book this rate
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* AI Rate Advisor toggle */}
        {rates.length > 0 && (
          <div className="mt-4 pt-4 border-t border-bg-border">
            <button
              onClick={() => setShowAI(!showAI)}
              className="w-full flex items-center justify-between text-sm text-amber font-medium"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} />
                Rate advisor — which one should I pick?
              </span>
              {showAI ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAI && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  {(['definite', 'likely', 'uncertain'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setTripCertainty(c)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                        tripCertainty === c
                          ? 'bg-amber text-bg-base'
                          : 'bg-bg-elevated text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <p className="text-text-muted text-xs text-center">Trip certainty</p>

                {aiLoading ? (
                  <div className="flex items-center gap-2 text-text-muted py-2">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">Analysing rate options…</span>
                  </div>
                ) : aiRates?.content ? (
                  <div
                    className="text-text-secondary text-xs leading-relaxed whitespace-pre-line [&_strong]:text-text-primary [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{
                      __html: aiRates.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br />'),
                    }}
                  />
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Credit summary */}
      {selectedRate && rates.find((r: any) => (r.rateId || r.id) === selectedRate) && (
        <div className="glass-card p-4 border-success/20">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={15} className="text-success" />
            <span className="text-sm font-medium text-text-primary">On completion of stay</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Travel Credit earned</span>
            <span className="text-success font-medium">
              +$
              {(
                (parseFloat(
                  rates.find((r: any) => (r.rateId || r.id) === selectedRate)?.retailRate?.total?.[0]?.amount || '0'
                ) / 1.05) * 0.0125
              ).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-text-muted">Pool contribution</span>
            <span className="text-amber font-medium">
              +$
              {(
                (parseFloat(
                  rates.find((r: any) => (r.rateId || r.id) === selectedRate)?.retailRate?.total?.[0]?.amount || '0'
                ) / 1.05) * 0.02
              ).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
