'use client';

import { useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { hotelsApi, reviewsApi } from '@/src/lib/api';
import { useAuthStore } from '@/src/lib/store';
import { Loader2, ChevronLeft, Star, MapPin, Sparkles, ChevronDown, ChevronUp, Check } from 'lucide-react';
import Image from 'next/image';
import { HotelTruthPanel } from '@/src/components/HotelTruthPanel';
import toast from 'react-hot-toast';

function HotelContent() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { token } = useAuthStore();

  const checkin = params.get('checkin') || '';
  const checkout = params.get('checkout') || '';
  const adults = parseInt(params.get('adults') || '2');
  const [showTruth, setShowTruth] = useState(false);
  const [showAIRates, setShowAIRates] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [tripCertainty, setTripCertainty] = useState<'definite' | 'likely' | 'uncertain'>('likely');

  const { data: hotelData, isLoading } = useQuery({
    queryKey: ['hotel', id],
    queryFn: () => hotelsApi.get(id).then((r) => r.data),
  });

  const { data: ratesData, isLoading: ratesLoading } = useQuery({
    queryKey: ['rates', id, checkin, checkout, adults],
    queryFn: () =>
      hotelsApi.getRates(id, { checkin, checkout, adults: adults.toString(), currency: 'USD' }).then((r) => r.data),
    enabled: !!checkin && !!checkout,
  });

  const { data: aiRatesData, isLoading: aiRatesLoading } = useQuery({
    queryKey: ['ai-rates', id, checkin, checkout, adults, tripCertainty],
    queryFn: () =>
      hotelsApi.aiRates(id, {
        rates: ratesData?.rates || [],
        checkin, checkout, tripCertainty, currency: 'USD',
      }).then((r) => r.data),
    enabled: showAIRates && !!ratesData?.rates?.length,
    staleTime: 10 * 60 * 1000,
  });

  const hotel = hotelData?.hotel;
  const rates: any[] = ratesData?.rates || [];
  const nights = checkin && checkout
    ? Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000)
    : 1;

  function handleBook() {
    if (!selectedRateId) return;
    if (!token) {
      toast.error('Sign in to book');
      router.push('/account');
      return;
    }
    router.push(`/checkout?hotelId=${id}&rateId=${selectedRateId}&checkin=${checkin}&checkout=${checkout}&adults=${adults}`);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="text-amber animate-spin" />
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <p className="text-text-muted">Hotel not found.</p>
        <button onClick={() => router.back()} className="btn-ghost mt-4">Go back</button>
      </div>
    );
  }

  const selectedRate = rates.find((r: any) => (r.rateId || r.id) === selectedRateId);

  return (
    <div className="flex flex-col min-h-screen pb-32">
      {/* Hero image */}
      <div className="relative h-56 w-full">
        {hotel.thumbnailUrl || hotel.images?.[0] ? (
          <Image
            src={hotel.thumbnailUrl || hotel.images[0]}
            alt={hotel.name}
            fill
            className="object-cover"
            priority
            sizes="480px"
          />
        ) : (
          <div className="w-full h-full bg-bg-elevated flex items-center justify-center">
            <span className="text-5xl">🏨</span>
          </div>
        )}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-bg-base/80 backdrop-blur-sm flex items-center justify-center"
        >
          <ChevronLeft size={18} className="text-text-primary" />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="font-display text-xl font-bold text-text-primary leading-tight">{hotel.name}</h1>
            {hotel.starRating && (
              <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                {Array.from({ length: hotel.starRating }).map((_, i) => (
                  <Star key={i} size={11} className="text-amber fill-amber" />
                ))}
              </div>
            )}
          </div>
          {hotel.city && (
            <div className="flex items-center gap-1 text-text-muted text-sm mt-1">
              <MapPin size={12} />
              {hotel.city}{hotel.country ? `, ${hotel.country}` : ''}
            </div>
          )}
          {hotel.reviewScore && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="px-1.5 py-0.5 rounded-md bg-success/15 text-success text-xs font-bold">
                {parseFloat(hotel.reviewScore).toFixed(1)}
              </span>
              <span className="text-text-muted text-xs">{hotel.reviewCount ? `${hotel.reviewCount} reviews` : 'Guest score'}</span>
            </div>
          )}
        </div>

        {/* AI Truth Layer toggle */}
        {checkin && checkout && (
          <div className="glass-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-4"
              onClick={() => setShowTruth(!showTruth)}
            >
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-amber" />
                <span className="text-sm font-medium text-text-primary">Is this hotel right for me?</span>
              </div>
              {showTruth ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
            </button>
            {showTruth && (
              <div className="px-4 pb-4 border-t border-bg-border">
                <HotelTruthPanel hotelId={id} checkin={checkin} checkout={checkout} adults={adults} />
              </div>
            )}
          </div>
        )}

        {/* Amenities */}
        {hotel.amenities?.length > 0 && (
          <div>
            <p className="section-label mb-2">Amenities</p>
            <div className="flex gap-2 flex-wrap">
              {hotel.amenities.slice(0, 8).map((a: string) => (
                <span key={a} className="chip chip-muted">{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Rates */}
        <div>
          <p className="section-label mb-2">Available rates</p>
          {ratesLoading ? (
            <div className="flex items-center gap-2 text-text-muted py-4">
              <Loader2 size={15} className="animate-spin" />
              <span className="text-sm">Loading live rates…</span>
            </div>
          ) : rates.length === 0 ? (
            <p className="text-text-muted text-sm py-2">No rates available for these dates.</p>
          ) : (
            <div className="space-y-2">
              {rates.slice(0, 6).map((rate: any) => {
                const rateId = rate.rateId || rate.id;
                const totalAmount = rate.retailRate?.total?.[0]?.amount;
                const perNight = totalAmount ? totalAmount / nights : null;
                const isSelected = selectedRateId === rateId;

                return (
                  <button
                    key={rateId}
                    onClick={() => setSelectedRateId(isSelected ? null : rateId)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      isSelected ? 'border-amber bg-amber/5' : 'border-bg-border bg-bg-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {rate.roomTypeCode || 'Standard Room'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {rate.refundable ? (
                            <span className="text-xs text-success">Free cancellation</span>
                          ) : (
                            <span className="text-xs text-text-muted">Non-refundable</span>
                          )}
                          {rate.boardType && (
                            <span className="text-xs text-text-muted">· {rate.boardType}</span>
                          )}
                        </div>
                      </div>
                      {perNight && (
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-text-primary">${perNight.toFixed(0)}<span className="text-text-muted text-xs font-normal">/night</span></p>
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="mt-2 flex items-center gap-1.5 text-amber text-xs font-medium">
                        <Check size={12} /> Selected — tap Book below
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* AI Rate Advisor */}
          {rates.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowAIRates(!showAIRates)}
                className="flex items-center gap-1.5 text-amber text-xs font-medium"
              >
                <Sparkles size={12} />
                Which rate should I pick?
                {showAIRates ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showAIRates && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1">
                    {(['definite', 'likely', 'uncertain'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setTripCertainty(c)}
                        className={`flex-1 py-1 px-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                          tripCertainty === c ? 'bg-amber text-bg-base' : 'bg-bg-elevated text-text-muted'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  {aiRatesLoading ? (
                    <div className="flex items-center gap-2 text-text-muted py-2">
                      <Loader2 size={13} className="animate-spin" />
                      <span className="text-xs">Analysing…</span>
                    </div>
                  ) : aiRatesData?.content ? (
                    <div
                      className="text-text-secondary text-xs leading-relaxed [&_strong]:text-text-primary [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{
                        __html: aiRatesData.content
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
      </div>

      {/* Sticky book button */}
      <div className="fixed bottom-16 left-0 right-0 max-w-miniapp mx-auto px-4 pb-3 pt-2 bg-gradient-to-t from-bg-base to-transparent safe-area-bottom z-20">
        {selectedRate ? (
          <div className="glass-card p-3 mb-2">
            <div className="flex justify-between text-xs text-text-muted mb-0.5">
              <span>After stay completes</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Travel Credit</span>
              <span className="text-success font-medium">
                +${((parseFloat(selectedRate.retailRate?.total?.[0]?.amount || '0') / 1.05) * 0.0125).toFixed(2)}
              </span>
            </div>
          </div>
        ) : null}
        <button
          onClick={handleBook}
          disabled={!selectedRateId}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
        >
          {selectedRateId
            ? `Book — $${(selectedRate?.retailRate?.total?.[0]?.amount || 0).toFixed(0)}`
            : 'Select a rate to book'}
        </button>
      </div>
    </div>
  );
}

export default function HotelPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="text-amber animate-spin" />
      </div>
    }>
      <HotelContent />
    </Suspense>
  );
}
