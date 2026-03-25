'use client';

import { useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { hotelsApi, reviewsApi } from '@/lib/api';
import { NavBar } from '@/components/layout/NavBar';
import { HotelGallery } from '@/components/hotel/HotelGallery';
import { HotelTruthPanel } from '@/components/ai/HotelTruthPanel';
import { RatesPanel } from '@/components/hotel/RatesPanel';
import { ReviewsList } from '@/components/hotel/ReviewsList';
import { Star, MapPin, Loader2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

function HotelDetailContent() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const checkin = params.get('checkin') || '';
  const checkout = params.get('checkout') || '';
  const adults = parseInt(params.get('adults') || '2');
  const [activeTab, setActiveTab] = useState<'overview' | 'rates' | 'reviews'>('overview');

  const { data: hotelData, isLoading: hotelLoading } = useQuery({
    queryKey: ['hotel', id],
    queryFn: () => hotelsApi.get(id).then((r) => r.data),
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => reviewsApi.getForHotel(id).then((r) => r.data),
  });

  const hotel = hotelData?.hotel;
  const verifiedReviews = hotelData?.verifiedReviews || [];

  if (hotelLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-amber animate-spin" />
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-text-muted">Hotel not found.</p>
      </div>
    );
  }

  const nights = checkin && checkout
    ? Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000)
    : 0;

  return (
    <>
      {/* Back */}
      <Link href="/search" className="btn-ghost flex items-center gap-1.5 mb-4 -ml-2">
        <ChevronLeft size={16} />
        Back to results
      </Link>

      {/* Gallery */}
      <HotelGallery images={hotel.images || (hotel.thumbnailUrl ? [hotel.thumbnailUrl] : [])} name={hotel.name} />

      {/* Header */}
      <div className="mt-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-primary mb-2">
              {hotel.name}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              {hotel.city && (
                <div className="flex items-center gap-1 text-text-muted text-sm">
                  <MapPin size={13} />
                  {hotel.city}, {hotel.countryCode || hotel.country}
                </div>
              )}
              {hotel.starRating && (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: hotel.starRating }).map((_, i) => (
                    <Star key={i} size={13} className="text-amber fill-amber" />
                  ))}
                </div>
              )}
              {hotel.reviewScore && (
                <div className="flex items-center gap-1.5">
                  <div className="px-2 py-0.5 rounded-lg bg-success/15 text-success text-sm font-bold">
                    {parseFloat(hotel.reviewScore).toFixed(1)}
                  </div>
                  <span className="text-text-muted text-sm">
                    {hotel.reviewCount ? `${hotel.reviewCount} reviews` : 'Guest score'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {checkin && checkout && (
            <div className="glass-card p-3 text-right">
              <p className="text-text-muted text-xs mb-0.5">{checkin} → {checkout}</p>
              <p className="text-text-muted text-xs">{nights} night{nights > 1 ? 's' : ''} · {adults} guest{adults > 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-bg-surface border border-bg-border mb-6 w-fit">
        {(['overview', 'rates', 'reviews'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab}
            {tab === 'reviews' && verifiedReviews.length > 0 && (
              <span className="ml-1.5 text-xs text-text-muted">({verifiedReviews.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* AI Truth Layer */}
            <HotelTruthPanel
              hotelId={id}
              checkin={checkin}
              checkout={checkout}
              adults={adults}
            />

            {/* Description */}
            {hotel.description && (
              <div className="glass-card p-5">
                <h3 className="font-semibold text-text-primary mb-3">About this hotel</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{hotel.description}</p>
              </div>
            )}

            {/* Amenities */}
            {hotel.amenities?.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="font-semibold text-text-primary mb-3">Amenities</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {hotel.amenities.slice(0, 15).map((a: string) => (
                    <span key={a} className="text-text-secondary text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber/60" />
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rates sidebar */}
          <div>
            <RatesPanel
              hotelId={id}
              checkin={checkin}
              checkout={checkout}
              adults={adults}
              hotel={hotel}
            />
          </div>
        </div>
      )}

      {activeTab === 'rates' && (
        <RatesPanel
          hotelId={id}
          checkin={checkin}
          checkout={checkout}
          adults={adults}
          hotel={hotel}
          expanded
        />
      )}

      {activeTab === 'reviews' && (
        <ReviewsList
          hotelId={id}
          verifiedReviews={verifiedReviews}
        />
      )}
    </>
  );
}

export default function HotelDetailPage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 size={32} className="text-amber animate-spin" /></div>}>
          <HotelDetailContent />
        </Suspense>
      </main>
    </div>
  );
}
