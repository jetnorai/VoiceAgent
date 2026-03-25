'use client';

import { useQuery } from '@tanstack/react-query';
import { bookingsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { NavBar } from '@/components/layout/NavBar';
import { BookingCard } from '@/components/booking/BookingCard';
import { Loader2, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function TripsPage() {
  const { token } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingsApi.list().then((r) => r.data),
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <MapPin size={40} className="text-text-muted mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Your trips</h1>
          <p className="text-text-muted mb-6">Sign in to see your bookings and travel history.</p>
          <Link href="/auth" className="btn-primary">Sign in</Link>
        </main>
      </div>
    );
  }

  const bookings = data?.bookings || [];
  const upcoming = bookings.filter((b: any) => ['confirmed', 'active'].includes(b.booking?.status));
  const past = bookings.filter((b: any) => ['completed', 'cancelled'].includes(b.booking?.status));

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-8">Your trips</h1>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="text-amber animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <MapPin size={40} className="text-text-muted mx-auto mb-4" />
            <h2 className="font-semibold text-text-primary mb-2">No trips yet</h2>
            <p className="text-text-muted text-sm mb-6">
              Your bookings will appear here. Every completed stay earns Travel Credit.
            </p>
            <Link href="/" className="btn-primary">Search hotels</Link>
          </div>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <section>
                <h2 className="section-label mb-4">Upcoming</h2>
                <div className="space-y-4">
                  {upcoming.map((b: any) => (
                    <BookingCard key={b.booking.id} booking={b.booking} hotel={b.hotel} />
                  ))}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="section-label mb-4">Past stays</h2>
                <div className="space-y-4">
                  {past.map((b: any) => (
                    <BookingCard key={b.booking.id} booking={b.booking} hotel={b.hotel} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
