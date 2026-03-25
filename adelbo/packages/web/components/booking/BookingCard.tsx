'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { MapPin, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface BookingCardProps {
  booking: any;
  hotel: any;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  confirmed: { label: 'Confirmed', color: 'chip-success', icon: CheckCircle },
  active: { label: 'Active stay', color: 'chip-amber', icon: Clock },
  completed: { label: 'Completed', color: 'chip-muted', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'chip-muted', icon: XCircle },
  pending_payment: { label: 'Pending', color: 'chip-muted', icon: Clock },
};

export function BookingCard({ booking, hotel }: BookingCardProps) {
  const cfg = statusConfig[booking.status] || statusConfig.pending_payment;
  const Icon = cfg.icon;

  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);

  return (
    <Link
      href={`/trips/${booking.id}`}
      className="glass-card p-5 flex items-start gap-4 hover:border-amber/30 transition-colors group"
    >
      {/* Hotel thumbnail */}
      {hotel?.thumbnailUrl ? (
        <img
          src={hotel.thumbnailUrl}
          alt={hotel.name}
          className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-bg-elevated flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🏨</span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-text-primary truncate group-hover:text-amber transition-colors">
            {hotel?.name || 'Hotel'}
          </h3>
          <span className={clsx('chip flex-shrink-0', cfg.color)}>
            <Icon size={10} />
            {cfg.label}
          </span>
        </div>

        <div className="flex items-center gap-1 text-text-muted text-sm mb-2">
          <MapPin size={11} />
          {hotel?.city || 'Unknown location'}
        </div>

        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="flex items-center gap-1 text-text-muted">
            <Calendar size={11} />
            {format(checkIn, 'MMM d')} → {format(checkOut, 'MMM d, yyyy')}
          </span>
          <span className="text-text-muted">·</span>
          <span className="text-text-muted">{nights} night{nights > 1 ? 's' : ''}</span>
          <span className="text-text-muted">·</span>
          <span className="font-medium text-text-primary">${parseFloat(booking.totalAmount).toFixed(0)}</span>
        </div>

        {booking.travelCreditEarned && booking.status === 'completed' && (
          <p className="text-success text-xs mt-1.5">
            +${parseFloat(booking.travelCreditEarned).toFixed(2)} Travel Credit earned
          </p>
        )}
      </div>
    </Link>
  );
}
