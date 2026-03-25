'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/lib/api';
import { NavBar } from '@/components/layout/NavBar';
import { HotelCard } from '@/components/hotel/HotelCard';
import { SearchFilters } from '@/components/search/SearchFilters';
import { AISearchBadge } from '@/components/ai/AISearchBadge';
import { Loader2, Search } from 'lucide-react';

type Category = 'all' | 'bestForWork' | 'bestVibeMatch' | 'bestValue' | 'bestFlexibility';

function SearchResults() {
  const params = useSearchParams();
  const isIntent = params.get('intent') === '1';
  const query = params.get('q') || '';
  const destination = params.get('destination') || '';
  const checkin = params.get('checkin') || '';
  const checkout = params.get('checkout') || '';
  const adults = parseInt(params.get('adults') || '2');
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', isIntent ? query : destination, checkin, checkout, adults, isIntent],
    queryFn: () =>
      isIntent
        ? searchApi.intent({ query, checkin, checkout, adults }).then((r) => r.data)
        : searchApi.search({ destination, checkin, checkout, adults: adults.toString() }).then((r) => r.data),
    enabled: !!(query || destination) && !!checkin && !!checkout,
  });

  const allHotels: any[] = data?.hotels || [];
  const categories = data?.categories;
  const interpretation = data?.interpretation;

  function getDisplayedHotels() {
    if (!isIntent || !categories || activeCategory === 'all') return allHotels;
    return categories[activeCategory] || [];
  }

  const displayedHotels = getDisplayedHotels();

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary mb-1">
          {isIntent ? query : destination}
        </h1>
        <p className="text-text-muted text-sm">
          {checkin} → {checkout} · {adults} guest{adults > 1 ? 's' : ''}
          {!isLoading && allHotels.length > 0 && ` · ${allHotels.length} hotels`}
        </p>
        {interpretation && <AISearchBadge text={interpretation} />}
      </div>

      {/* Category tabs (intent mode only) */}
      {isIntent && categories && (
        <div className="flex gap-2 flex-wrap mb-6">
          {(
            [
              { key: 'all', label: 'All results' },
              { key: 'bestForWork', label: 'Best for work' },
              { key: 'bestVibeMatch', label: 'Best vibe' },
              { key: 'bestValue', label: 'Best value' },
              { key: 'bestFlexibility', label: 'Best flexibility' },
            ] as { key: Category; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === key
                  ? 'bg-amber text-bg-base'
                  : 'bg-bg-elevated text-text-muted hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="text-amber animate-spin" />
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center">
          <p className="text-text-muted">Search failed. Please try again.</p>
        </div>
      ) : displayedHotels.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Search size={40} className="text-text-muted mx-auto mb-4" />
          <p className="font-semibold text-text-primary mb-1">No hotels found</p>
          <p className="text-text-muted text-sm">Try different dates or a different destination.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {displayedHotels.map((hotel: any) => (
            <HotelCard
              key={hotel.hotelId || hotel.id}
              hotel={hotel}
              checkin={checkin}
              checkout={checkout}
              adults={adults}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 size={32} className="text-amber animate-spin" /></div>}>
          <SearchResults />
        </Suspense>
      </main>
    </div>
  );
}
