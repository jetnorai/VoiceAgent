'use client';

import Link from 'next/link';
import { Star, MapPin } from 'lucide-react';

interface MiniHotelCardProps {
  hotel: {
    id: string;
    name: string;
    city?: string;
    country?: string;
    stars?: number;
    thumbnailUrl?: string;
    minRate?: number;
    currency?: string;
    rating?: number;
    reviewCount?: number;
  };
  searchParams?: string;
}

export function MiniHotelCard({ hotel, searchParams = '' }: MiniHotelCardProps) {
  const href = `/hotels/${hotel.id}${searchParams ? `?${searchParams}` : ''}`;

  return (
    <Link href={href} className="flex gap-3 glass-card p-3 hover:border-amber/30 transition-colors">
      {hotel.thumbnailUrl ? (
        <img
          src={hotel.thumbnailUrl}
          alt={hotel.name}
          className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-bg-elevated flex items-center justify-center flex-shrink-0">
          <span className="text-3xl">🏨</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-semibold text-text-primary text-sm leading-tight line-clamp-2">{hotel.name}</h3>
          {hotel.stars && (
            <span className="text-amber text-xs font-medium flex-shrink-0">{'★'.repeat(Math.min(hotel.stars, 5))}</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin size={10} className="text-text-muted flex-shrink-0" />
          <p className="text-text-muted text-xs truncate">
            {[hotel.city, hotel.country].filter(Boolean).join(', ')}
          </p>
        </div>
        {hotel.rating && (
          <div className="flex items-center gap-1 mt-1">
            <Star size={10} className="text-amber fill-amber" />
            <span className="text-xs text-text-secondary font-medium">{hotel.rating.toFixed(1)}</span>
            {hotel.reviewCount && (
              <span className="text-xs text-text-muted">({hotel.reviewCount})</span>
            )}
          </div>
        )}
        {hotel.minRate !== undefined && (
          <p className="text-amber font-bold text-sm mt-1">
            from ${(hotel.minRate * 1.05).toFixed(0)}
            <span className="text-text-muted font-normal text-xs">/night</span>
          </p>
        )}
      </div>
    </Link>
  );
}
