'use client';

import { useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { bookingsApi, reviewsApi } from '@/src/lib/api';
import { Loader2, ChevronLeft, CheckCircle, Calendar, Sparkles, MessageSquare, AlertTriangle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function TripDetailContent() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const isConfirmed = params.get('confirmed') === '1';

  const [showRescue, setShowRescue] = useState(false);
  const [rescueMsg, setRescueMsg] = useState('');
  const [rescueResponse, setRescueResponse] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [review, setReview] = useState({ rating: 5, content: '', title: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id).then((r) => r.data),
  });

  const rescueMutation = useMutation({
    mutationFn: () =>
      bookingsApi.aiRescue(id, { reason: rescueMsg, message: rescueMsg }).then((r) => r.data),
    onSuccess: (d) => setRescueResponse(d.content),
    onError: () => toast.error('Rescue agent unavailable'),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      reviewsApi.submit({ bookingId: id, ...review }).then((r) => r.data),
    onSuccess: () => { toast.success('Review submitted!'); setShowReview(false); },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(id).then((r) => r.data),
    onSuccess: () => toast.success('Booking cancelled'),
    onError: () => toast.error('Cancellation failed — contact support'),
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 size={28} className="text-amber animate-spin" /></div>;
  }

  const booking = data?.booking;
  const hotel = data?.hotel;
  if (!booking) return <div className="p-6 text-center text-text-muted">Booking not found.</div>;

  const isCompleted = booking.status === 'completed';
  const canCancel = ['confirmed', 'active'].includes(booking.status);

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b border-bg-border">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-text-muted text-sm mb-2">
          <ChevronLeft size={16} /> My trips
        </button>
        {isConfirmed && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20 mt-2">
            <CheckCircle size={16} className="text-success flex-shrink-0" />
            <p className="text-sm text-text-primary font-medium">Booking confirmed!</p>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Summary */}
        <div className="glass-card p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h2 className="font-display font-bold text-lg text-text-primary leading-tight">{hotel?.name || 'Hotel'}</h2>
              <p className="text-text-muted text-sm">{hotel?.city}</p>
            </div>
            <span className={clsx('chip', booking.status === 'confirmed' ? 'chip-success' : booking.status === 'completed' ? 'chip-muted' : 'chip-muted')}>
              {booking.status.replace('_', ' ')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-text-muted text-xs">Check-in</p>
              <p className="font-medium text-text-primary flex items-center gap-1">
                <Calendar size={12} className="text-amber" />
                {format(new Date(booking.checkIn), 'EEE, MMM d')}
              </p>
            </div>
            <div>
              <p className="text-text-muted text-xs">Check-out</p>
              <p className="font-medium text-text-primary flex items-center gap-1">
                <Calendar size={12} className="text-amber" />
                {format(new Date(booking.checkOut), 'EEE, MMM d')}
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-bg-border text-sm">
            <span className="text-text-muted">Total paid</span>
            <span className="font-bold text-text-primary">{booking.currency} {parseFloat(booking.totalAmount).toFixed(2)}</span>
          </div>

          {booking.travelCreditEarned && (
            <div className="flex justify-between items-center mt-1 text-sm">
              <span className="text-text-muted">Travel Credit</span>
              <span className={isCompleted ? 'text-success font-medium' : 'text-text-muted'}>
                {isCompleted ? '+' : ''}${parseFloat(booking.travelCreditEarned).toFixed(2)}
                {!isCompleted ? ' on completion' : ''}
              </span>
            </div>
          )}

          {booking.onChainTxHash && (
            <div className="mt-3 pt-3 border-t border-bg-border">
              <p className="text-text-muted text-xs">On-chain tx</p>
              <p className="font-mono text-xs text-text-muted mt-0.5 truncate">{booking.onChainTxHash}</p>
            </div>
          )}
        </div>

        {/* Cancellation policy */}
        {booking.cancellationPolicy && (
          <div className="glass-card p-4">
            <p className="section-label mb-1.5">Cancellation policy</p>
            <p className="text-text-secondary text-sm">{booking.cancellationPolicy}</p>
          </div>
        )}

        {/* Rescue Agent */}
        {canCancel && (
          <div className="glass-card p-4">
            <button
              onClick={() => setShowRescue(!showRescue)}
              className="flex items-center gap-2 text-amber text-sm font-medium w-full"
            >
              <Sparkles size={14} />
              Plans changed? Get help
            </button>
            {showRescue && (
              <div className="mt-3 space-y-2">
                <textarea
                  className="input w-full resize-none h-16 text-xs"
                  placeholder="What changed? (new dates, need to cancel, cost concern…)"
                  value={rescueMsg}
                  onChange={(e) => setRescueMsg(e.target.value)}
                />
                <button
                  onClick={() => rescueMutation.mutate()}
                  disabled={!rescueMsg || rescueMutation.isPending}
                  className="btn-primary text-xs py-2 w-full"
                >
                  {rescueMutation.isPending ? <Loader2 size={13} className="animate-spin mx-auto" /> : 'Get advice'}
                </button>
                {rescueResponse && (
                  <div
                    className="text-text-secondary text-xs leading-relaxed [&_strong]:text-text-primary [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{
                      __html: rescueResponse.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />'),
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Review */}
        {isCompleted && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-text-primary text-sm flex items-center gap-1.5">
                <MessageSquare size={14} className="text-amber" />
                Leave a verified review
              </p>
              {!showReview && (
                <button onClick={() => setShowReview(true)} className="text-amber text-xs font-medium">Write</button>
              )}
            </div>
            {showReview && (
              <div className="space-y-3 mt-2">
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setReview((d) => ({ ...d, rating: r }))}
                      className={`w-9 h-9 rounded-lg font-bold text-sm transition-colors ${
                        review.rating >= r ? 'bg-amber text-bg-base' : 'bg-bg-elevated text-text-muted'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  className="input w-full resize-none h-20 text-xs"
                  placeholder="Share what the stay was really like (min 50 characters)…"
                  value={review.content}
                  onChange={(e) => setReview((d) => ({ ...d, content: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => reviewMutation.mutate()}
                    disabled={review.content.length < 50 || reviewMutation.isPending}
                    className="btn-primary flex-1 text-xs py-2"
                  >
                    {reviewMutation.isPending ? <Loader2 size={13} className="animate-spin mx-auto" /> : 'Submit review'}
                  </button>
                  <button onClick={() => setShowReview(false)} className="btn-ghost text-xs py-2 px-3">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cancel */}
        {canCancel && (
          <button
            onClick={() => {
              if (confirm('Are you sure you want to cancel this booking?')) {
                cancelMutation.mutate();
              }
            }}
            disabled={cancelMutation.isPending}
            className="w-full text-red-400 text-sm py-3 border border-red-900/30 rounded-xl hover:bg-red-900/10 transition-colors"
          >
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel booking'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 size={28} className="text-amber animate-spin" /></div>}>
      <TripDetailContent />
    </Suspense>
  );
}
