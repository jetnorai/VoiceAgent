'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/src/lib/api';
import { Loader2, ChevronLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { MiniHotelCard } from '@/src/components/MiniHotelCard';
import { AISearchBadge } from '@/src/components/AISearchBadge';

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const isIntent = params.get('intent') === '1';
  const query = params.get('q') || '';
  const destination = params.get('destination') || '';
  const checkin = params.get('checkin') || '';
  const checkout = params.get('checkout') || '';
  const adults = parseInt(params.get('adults') || '2');

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', isIntent ? query : destination, checkin, checkout, adults, isIntent],
    queryFn: () =>
      isIntent
        ? searchApi.intent({ query, checkin, checkout, adults }).then((r) => r.data)
        : searchApi.search({ destination, checkin, checkout, adults: adults.toString() }).then((r) => r.data),
    enabled: !!(query || destination) && !!checkin && !!checkout,
  });

  const hotels: any[] = data?.hotels || [];
  const interpretation = data?.interpretation;

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 bg-bg-base sticky top-0 z-10 border-b border-bg-border">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="p-1.5 rounded-lg hover:bg-bg-elevated">
            <ChevronLeft size={20} className="text-text-secondary" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-text-primary truncate">
              {isIntent ? query : destination}
            </h1>
            <p className="text-text-muted text-xs">{checkin} → {checkout} · {adults} guest{adults > 1 ? 's' : ''}</p>
          </div>
        </div>
        {interpretation && <AISearchBadge text={interpretation} />}
      </div>

      <div className="flex-1 px-4 pt-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 size={28} className="text-amber animate-spin mb-3" />
            <p className="text-text-muted text-sm">Finding hotels…</p>
          </div>
        ) : error || hotels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={36} className="text-text-muted mb-3" />
            <p className="font-medium text-text-primary mb-1">No hotels found</p>
            <p className="text-text-muted text-sm">Try different dates or a broader search.</p>
          </div>
        ) : (
          <>
            <p className="text-text-muted text-xs mb-3">{hotels.length} hotels found</p>
            <div className="space-y-3">
              {hotels.map((hotel: any) => (
                <MiniHotelCard
                  key={hotel.hotelId || hotel.id}
                  hotel={hotel}
                  checkin={checkin}
                  checkout={checkout}
                  adults={adults}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="text-amber animate-spin" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
