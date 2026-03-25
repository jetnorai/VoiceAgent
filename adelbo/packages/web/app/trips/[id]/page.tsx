'use client';

import { useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { bookingsApi, reviewsApi } from '@/lib/api';
import { NavBar } from '@/components/layout/NavBar';
import { Loader2, CheckCircle, Calendar, MapPin, CreditCard, ChevronLeft, MessageSquare, AlertTriangle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

function TripDetailContent() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const isConfirmed = params.get('confirmed') === '1';
  const [showRescue, setShowRescue] = useState(false);
  const [rescueMessage, setRescueMessage] = useState('');
  const [rescueResponse, setRescueResponse] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, content: '', title: '', travelPurpose: 'leisure', wouldReturn: true });

  const { data, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id).then((r) => r.data),
  });

  const rescueMutation = useMutation({
    mutationFn: ({ reason, message }: { reason: string; message: string }) =>
      bookingsApi.aiRescue(id, { reason, message }).then((r) => r.data),
    onSuccess: (data) => setRescueResponse(data.content),
    onError: () => toast.error('Rescue agent unavailable — please contact support'),
  });

  const submitReviewMutation = useMutation({
    mutationFn: () =>
      reviewsApi.submit({ bookingId: id, ...reviewData }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Review submitted');
      setShowReviewForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Review submission failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(id).then((r) => r.data),
    onSuccess: () => toast.success('Booking cancelled'),
    onError: () => toast.error('Cancellation failed — please contact support'),
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 size={32} className="text-amber animate-spin" /></div>;
  }

  const booking = data?.booking;
  const hotel = data?.hotel;
  const events = data?.events || [];

  if (!booking) {
    return <div className="glass-card p-8 text-center"><p className="text-text-muted">Booking not found.</p></div>;
  }

  const checkIn = new Date(booking.checkIn);
  const checkOut = new Date(booking.checkOut);
  const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000);
  const isCompleted = booking.status === 'completed';
  const canCancel = ['confirmed', 'active'].includes(booking.status);
  const canReview = isCompleted;

  return (
    <>
      {isConfirmed && (
        <div className="glass-card p-5 border-success/30 mb-6 flex items-start gap-3">
          <CheckCircle size={20} className="text-success flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-text-primary">Booking confirmed!</p>
            <p className="text-text-secondary text-sm">
              Your booking is confirmed. A confirmation has been sent to {booking.guestEmail}.
            </p>
          </div>
        </div>
      )}

      <Link href="/trips" className="btn-ghost flex items-center gap-1.5 mb-6 -ml-2">
        <ChevronLeft size={16} /> My trips
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Booking summary */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="font-display text-2xl font-bold text-text-primary">
                  {hotel?.name || 'Hotel Booking'}
                </h1>
                {hotel?.city && (
                  <div className="flex items-center gap-1 text-text-muted text-sm mt-1">
                    <MapPin size={12} /> {hotel.city}
                  </div>
                )}
              </div>
              <span className={clsx(
                'chip',
                booking.status === 'confirmed' ? 'chip-success' :
                booking.status === 'active' ? 'chip-amber' :
                booking.status === 'completed' ? 'chip-muted' : 'chip-muted'
              )}>
                {booking.status.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-text-muted text-xs mb-0.5">Check-in</p>
                <p className="font-medium text-text-primary flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber" />
                  {format(checkIn, 'EEE, MMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-text-muted text-xs mb-0.5">Check-out</p>
                <p className="font-medium text-text-primary flex items-center gap-1.5">
                  <Calendar size={13} className="text-amber" />
                  {format(checkOut, 'EEE, MMM d, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-text-muted text-xs mb-0.5">Duration</p>
                <p className="font-medium text-text-primary">{nights} night{nights > 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-text-muted text-xs mb-0.5">Guests</p>
                <p className="font-medium text-text-primary">{booking.guests}</p>
              </div>
            </div>

            {booking.cancellationPolicy && (
              <div className="mt-4 pt-4 border-t border-bg-border">
                <p className="text-text-muted text-xs mb-1">Cancellation policy</p>
                <p className="text-text-secondary text-sm">{booking.cancellationPolicy}</p>
              </div>
            )}

            {booking.liteApiBookingId && (
              <div className="mt-2">
                <p className="text-text-muted text-xs">
                  Booking reference: <span className="text-text-secondary font-mono">{booking.liteApiBookingId}</span>
                </p>
              </div>
            )}
          </div>

          {/* Rescue Agent */}
          {canCancel && (
            <div className="glass-card p-5">
              <button
                onClick={() => setShowRescue(!showRescue)}
                className="w-full flex items-center gap-2 text-amber text-sm font-medium"
              >
                <Sparkles size={15} />
                Plans changed? Get help from the Rescue Agent
              </button>

              {showRescue && (
                <div className="mt-4 space-y-3">
                  <textarea
                    className="input w-full resize-none h-20 text-sm"
                    placeholder="Describe what changed — new dates, cancellation needed, cost concern…"
                    value={rescueMessage}
                    onChange={(e) => setRescueMessage(e.target.value)}
                  />
                  <button
                    onClick={() => rescueMutation.mutate({ reason: rescueMessage, message: rescueMessage })}
                    disabled={!rescueMessage || rescueMutation.isPending}
                    className="btn-primary text-sm py-2 flex items-center gap-2"
                  >
                    {rescueMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Analysing options…</> : 'Get advice'}
                  </button>
                  {rescueResponse && (
                    <div
                      className="text-text-secondary text-sm leading-relaxed whitespace-pre-line [&_strong]:text-text-primary [&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{
                        __html: rescueResponse
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br />'),
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Review form */}
          {canReview && (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-text-primary flex items-center gap-2">
                  <MessageSquare size={16} className="text-amber" />
                  Leave a verified review
                </h3>
                {!showReviewForm && (
                  <button onClick={() => setShowReviewForm(true)} className="btn-secondary text-sm py-1.5 px-3">
                    Write review
                  </button>
                )}
              </div>

              {showReviewForm && (
                <div className="space-y-4">
                  <div>
                    <label className="section-label mb-2 block">Rating</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button
                          key={r}
                          onClick={() => setReviewData((d) => ({ ...d, rating: r }))}
                          className={`w-10 h-10 rounded-lg font-bold transition-colors ${
                            reviewData.rating >= r ? 'bg-amber text-bg-base' : 'bg-bg-elevated text-text-muted'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="section-label mb-1.5 block">Summary (optional)</label>
                    <input
                      className="input w-full"
                      placeholder="Great location, excellent service…"
                      value={reviewData.title}
                      onChange={(e) => setReviewData((d) => ({ ...d, title: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="section-label mb-1.5 block">Your review (min 50 characters)</label>
                    <textarea
                      className="input w-full resize-none h-28"
                      placeholder="Share what the stay was really like…"
                      value={reviewData.content}
                      onChange={(e) => setReviewData((d) => ({ ...d, content: e.target.value }))}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => submitReviewMutation.mutate()}
                      disabled={reviewData.content.length < 50 || submitReviewMutation.isPending}
                      className="btn-primary text-sm py-2"
                    >
                      {submitReviewMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Submit review'}
                    </button>
                    <button onClick={() => setShowReviewForm(false)} className="btn-ghost text-sm py-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cancel */}
          {canCancel && (
            <div className="glass-card p-5 border-red-900/20">
              <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-red-400" />
                Cancel booking
              </h3>
              <p className="text-text-muted text-sm mb-3">
                Cancellation is subject to the rate's cancellation policy above.
              </p>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="text-red-400 text-sm font-medium border border-red-900/30 px-4 py-2 rounded-lg hover:bg-red-900/10 transition-colors"
              >
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel this booking'}
              </button>
            </div>
          )}
        </div>

        {/* Right — payment summary */}
        <div>
          <div className="glass-card p-5 sticky top-20">
            <h2 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-amber" />
              Payment
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Total paid</span>
                <span className="font-semibold text-text-primary">
                  {booking.currency} {parseFloat(booking.totalAmount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Payment method</span>
                <span className="text-text-primary capitalize">{booking.paymentMethod?.replace('_', ' ') || '—'}</span>
              </div>
              {booking.creditRedeemed && parseFloat(booking.creditRedeemed) > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Credit applied</span>
                  <span className="text-success">-${parseFloat(booking.creditRedeemed).toFixed(2)}</span>
                </div>
              )}
            </div>

            {booking.travelCreditEarned && (
              <div className="mt-4 pt-4 border-t border-bg-border">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Travel Credit</span>
                  <span className={isCompleted ? 'text-success font-medium' : 'text-text-muted'}>
                    {isCompleted ? '+' : ''}${parseFloat(booking.travelCreditEarned).toFixed(2)}
                    {!isCompleted && ' (on completion)'}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-text-muted">Pool contribution</span>
                  <span className={isCompleted ? 'text-amber font-medium' : 'text-text-muted'}>
                    ${parseFloat(booking.poolContribution || '0').toFixed(2)}
                    {!isCompleted && ' (on completion)'}
                  </span>
                </div>
              </div>
            )}

            {booking.onChainTxHash && (
              <div className="mt-4 pt-4 border-t border-bg-border">
                <p className="text-text-muted text-xs">On-chain transaction</p>
                <p className="font-mono text-xs text-text-secondary mt-0.5 break-all">{booking.onChainTxHash}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function TripDetailPage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 size={32} className="text-amber animate-spin" /></div>}>
          <TripDetailContent />
        </Suspense>
      </main>
    </div>
  );
}
