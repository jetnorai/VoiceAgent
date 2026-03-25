'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Star, MapPin, Wifi, Coffee } from 'lucide-react';
import { clsx } from 'clsx';

interface HotelCardProps {
  hotel: any;
  checkin: string;
  checkout: string;
  adults: number;
}

export function HotelCard({ hotel, checkin, checkout, adults }: HotelCardProps) {
  const hotelId = hotel.hotelId || hotel.id;
  const name = hotel.name || hotel.hotelName;
  const city = hotel.city;
  const starRating = hotel.starRating || hotel.stars;
  const reviewScore = hotel.reviewScore || hotel.guestScore;
  const minRate = hotel.minRate;
  const thumbnailUrl = hotel.thumbnailUrl || hotel.images?.[0];
  const amenities: string[] = hotel.amenities || [];

  const href = `/hotels/${hotelId}?checkin=${checkin}&checkout=${checkout}&adults=${adults}`;

  const nights = Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000
  );

  return (
    <Link href={href} className="glass-card flex gap-0 overflow-hidden hover:border-amber/30 transition-colors group">
      {/* Image */}
      <div className="relative w-48 sm:w-56 flex-shrink-0 h-40 sm:h-44">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 192px, 224px"
          />
        ) : (
          <div className="w-full h-full bg-bg-elevated flex items-center justify-center">
            <span className="text-4xl">🏨</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-text-primary leading-tight group-hover:text-amber transition-colors line-clamp-1">
              {name}
            </h3>
            {starRating && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {Array.from({ length: starRating }).map((_, i) => (
                  <Star key={i} size={12} className="text-amber fill-amber" />
                ))}
              </div>
            )}
          </div>

          {city && (
            <div className="flex items-center gap-1 text-text-muted text-sm mb-2">
              <MapPin size={12} />
              {city}
            </div>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {amenities.slice(0, 3).map((a: string) => (
                <span key={a} className="chip chip-muted">
                  {a.toLowerCase().includes('wifi') && <Wifi size={10} />}
                  {a.toLowerCase().includes('breakfast') && <Coffee size={10} />}
                  {a.slice(0, 20)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-end justify-between mt-3">
          {reviewScore && (
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-success/15 flex items-center justify-center">
                <span className="text-success text-xs font-bold">{parseFloat(reviewScore).toFixed(1)}</span>
              </div>
              <span className="text-text-muted text-xs">Guest score</span>
            </div>
          )}

          {minRate && (
            <div className="text-right">
              <p className="font-display font-bold text-lg text-text-primary">
                ${parseFloat(minRate).toFixed(0)}
                <span className="text-text-muted text-sm font-normal">/night</span>
              </p>
              {nights > 1 && (
                <p className="text-text-muted text-xs">
                  ${(parseFloat(minRate) * nights).toFixed(0)} total · {nights} nights
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
