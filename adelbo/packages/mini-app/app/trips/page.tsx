'use client';

import { useQuery } from '@tanstack/react-query';
import { bookingsApi } from '@/src/lib/api';
import { useAuthStore } from '@/src/lib/store';
import { Loader2, MapPin, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { clsx } from 'clsx';

const statusColors: Record<string, string> = {
  confirmed: 'chip-success',
  active: 'chip-amber',
  completed: 'chip-muted',
  cancelled: 'chip-muted',
  pending_payment: 'chip-muted',
};

export default function TripsPage() {
  const { token } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingsApi.list().then((r) => r.data),
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 pb-24 text-center">
        <MapPin size={36} className="text-text-muted mb-3" />
        <h2 className="font-display font-bold text-xl text-text-primary mb-2">Your trips</h2>
        <p className="text-text-muted text-sm mb-5">Sign in to see your bookings.</p>
        <Link href="/account" className="btn-primary px-6">Sign in</Link>
      </div>
    );
  }

  const bookings = data?.bookings || [];
  const upcoming = bookings.filter((b: any) => ['confirmed', 'active'].includes(b.booking?.status));
  const past = bookings.filter((b: any) => ['completed', 'cancelled'].includes(b.booking?.status));

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="px-4 pt-8 pb-4">
        <h1 className="font-display text-2xl font-bold text-text-primary">Your trips</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="text-amber animate-spin" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <MapPin size={36} className="text-text-muted mb-3" />
          <p className="font-medium text-text-primary mb-1">No trips yet</p>
          <p className="text-text-muted text-sm mb-5">
            Book your first hotel and earn Travel Credit.
          </p>
          <Link href="/" className="btn-primary px-6">Search hotels</Link>
        </div>
      ) : (
        <div className="px-4 space-y-6">
          {upcoming.length > 0 && (
            <section>
              <p className="section-label mb-3">Upcoming</p>
              <div className="space-y-2">
                {upcoming.map((b: any) => (
                  <TripRow key={b.booking.id} booking={b.booking} hotel={b.hotel} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <p className="section-label mb-3">Past stays</p>
              <div className="space-y-2">
                {past.map((b: any) => (
                  <TripRow key={b.booking.id} booking={b.booking} hotel={b.hotel} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function TripRow({ booking, hotel }: { booking: any; hotel: any }) {
  const nights = Math.round(
    (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000
  );
  return (
    <Link
      href={`/trips/${booking.id}`}
      className="flex items-center gap-3 glass-card p-3 hover:border-amber/30 transition-colors"
    >
      {hotel?.thumbnailUrl ? (
        <img src={hotel.thumbnailUrl} alt={hotel.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-bg-elevated flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🏨</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="font-medium text-text-primary text-sm truncate">{hotel?.name || 'Hotel'}</p>
          <span className={clsx('chip', statusColors[booking.status] || 'chip-muted', 'flex-shrink-0 text-xs')}>
            {booking.status.replace('_', ' ')}
          </span>
        </div>
        <p className="text-text-muted text-xs mt-0.5">
          {format(new Date(booking.checkIn), 'MMM d')} → {format(new Date(booking.checkOut), 'MMM d')} · {nights}n
        </p>
        {booking.status === 'completed' && booking.travelCreditEarned && (
          <p className="text-success text-xs mt-0.5">
            +${parseFloat(booking.travelCreditEarned).toFixed(2)} Travel Credit
          </p>
        )}
      </div>
      <ChevronRight size={15} className="text-text-muted flex-shrink-0" />
    </Link>
  );
}
