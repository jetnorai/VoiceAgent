'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { hotelsApi, bookingsApi, paymentsApi, rewardsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { NavBar } from '@/components/layout/NavBar';
import { Loader2, CreditCard, ShieldCheck, ChevronLeft, Coins } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { StripePaymentForm } from '@/components/booking/StripePaymentForm';
import toast from 'react-hot-toast';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK || '');

function CheckoutContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, token } = useAuthStore();

  const hotelId = params.get('hotelId') || '';
  const rateId = params.get('rateId') || '';
  const checkin = params.get('checkin') || '';
  const checkout = params.get('checkout') || '';
  const adults = parseInt(params.get('adults') || '2');

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'usdc' | 'wld'>('card');
  const [firstName, setFirstName] = useState(user?.displayName?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user?.displayName?.split(' ')[1] || '');
  const [guestEmail, setGuestEmail] = useState(user?.email || '');
  const [applyCredit, setApplyCredit] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data: hotelData } = useQuery({
    queryKey: ['hotel', hotelId],
    queryFn: () => hotelsApi.get(hotelId).then((r) => r.data),
    enabled: !!hotelId,
  });

  const { data: ratesData } = useQuery({
    queryKey: ['rates', hotelId, checkin, checkout, adults],
    queryFn: () =>
      hotelsApi.getRates(hotelId, { checkin, checkout, adults: adults.toString(), currency: 'USD' }).then((r) => r.data),
    enabled: !!hotelId && !!checkin && !!checkout,
  });

  const { data: creditData } = useQuery({
    queryKey: ['credit'],
    queryFn: () => rewardsApi.getCredit().then((r) => r.data),
    enabled: !!token,
  });

  const rate = ratesData?.rates?.find((r: any) => (r.rateId || r.id) === rateId);
  const hotel = hotelData?.hotel;
  const totalAmount = rate?.retailRate?.total?.[0]?.amount || 0;
  const creditBalance = parseFloat(creditData?.balance || '0');
  const creditToApply = applyCredit ? Math.min(creditBalance, totalAmount * 0.5) : 0; // max 50% offset
  const effectiveAmount = totalAmount - creditToApply;
  const nights = Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000);
  const baseAmount = totalAmount / 1.05;
  const travelCreditEarned = baseAmount * 0.0125;
  const poolContribution = baseAmount * 0.02;

  const prebookMutation = useMutation({
    mutationFn: () =>
      bookingsApi.prebook({ rateId, hotelId, checkin, checkout, adults }).then((r) => r.data),
  });

  const createBookingMutation = useMutation({
    mutationFn: (prebookId: string) =>
      bookingsApi.create({
        prebookId,
        hotelId,
        checkin,
        checkout,
        adults,
        guest: { firstName, lastName, email: guestEmail },
        paymentMethod,
        totalAmount,
        currency: 'USD',
        creditToRedeem: creditToApply,
      }).then((r) => r.data),
  });

  const createIntentMutation = useMutation({
    mutationFn: (bId: string) =>
      paymentsApi.createIntent(bId).then((r) => r.data),
  });

  async function handleProceedToPayment() {
    if (!firstName || !lastName || !guestEmail) {
      toast.error('Please fill in guest details');
      return;
    }

    try {
      // 1. Pre-book to lock the rate
      const prebook = await prebookMutation.mutateAsync();

      // 2. Create booking record
      const booking = await createBookingMutation.mutateAsync(prebook.prebookId);
      setBookingId(booking.bookingId);

      if (paymentMethod === 'card') {
        // 3. Create Stripe PaymentIntent
        const intent = await createIntentMutation.mutateAsync(booking.bookingId);
        setClientSecret(intent.clientSecret);
      } else {
        // Crypto payment — handled by wallet
        router.push(`/checkout/crypto?bookingId=${booking.bookingId}&method=${paymentMethod}&amount=${effectiveAmount}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Could not proceed to payment');
    }
  }

  if (!hotel || !rate) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="text-amber animate-spin" />
      </div>
    );
  }

  return (
    <>
      <button onClick={() => router.back()} className="btn-ghost flex items-center gap-1.5 mb-6 -ml-2">
        <ChevronLeft size={16} />
        Back
      </button>

      <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary mb-6">
        Complete your booking
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Guest details */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-text-primary mb-4">Guest details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="section-label mb-1.5 block">First name</label>
                <input className="input w-full" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="section-label mb-1.5 block">Last name</label>
                <input className="input w-full" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="section-label mb-1.5 block">Email for confirmation</label>
                <input type="email" className="input w-full" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-text-primary mb-4">Payment method</h2>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'usdc', label: 'USDC', icon: Coins },
                { id: 'wld', label: 'WLD', icon: Coins },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPaymentMethod(id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    paymentMethod === id
                      ? 'border-amber bg-amber/5'
                      : 'border-bg-border hover:border-amber/30'
                  }`}
                >
                  <Icon size={20} className={paymentMethod === id ? 'text-amber' : 'text-text-muted'} />
                  <span className={`text-sm font-medium ${paymentMethod === id ? 'text-amber' : 'text-text-muted'}`}>
                    {label}
                  </span>
                  {id === 'wld' && <span className="text-xs text-amber/70">2× reputation</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Travel Credit */}
          {creditBalance > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-text-primary">Apply Travel Credit</h2>
                  <p className="text-text-muted text-sm mt-0.5">
                    Balance: <span className="text-success font-medium">${creditBalance.toFixed(2)}</span>
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={applyCredit}
                    onChange={(e) => setApplyCredit(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-bg-elevated rounded-full peer peer-checked:bg-amber peer-focus:outline-none transition-all" />
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-all peer-checked:left-5.5" />
                </label>
              </div>
              {applyCredit && (
                <p className="text-success text-sm mt-2">
                  Applying ${creditToApply.toFixed(2)} — saves ${creditToApply.toFixed(2)} on this booking.
                </p>
              )}
            </div>
          )}

          {/* Payment form or proceed button */}
          {clientSecret && bookingId ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
              <StripePaymentForm bookingId={bookingId} />
            </Elements>
          ) : (
            <button
              onClick={handleProceedToPayment}
              disabled={prebookMutation.isPending || createBookingMutation.isPending || createIntentMutation.isPending}
              className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
            >
              {(prebookMutation.isPending || createBookingMutation.isPending || createIntentMutation.isPending) ? (
                <><Loader2 size={18} className="animate-spin" /> Securing rate…</>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Proceed to payment — ${effectiveAmount.toFixed(2)}
                </>
              )}
            </button>
          )}
        </div>

        {/* Right — booking summary */}
        <div>
          <div className="glass-card p-5 sticky top-20">
            <h2 className="font-semibold text-text-primary mb-4">Booking summary</h2>

            <div className="space-y-3 mb-4">
              <div>
                <p className="font-medium text-text-primary">{hotel.name}</p>
                <p className="text-text-muted text-sm">{hotel.city}</p>
              </div>

              <div className="divider" />

              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Check-in</span>
                <span className="text-text-primary font-medium">{checkin}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Check-out</span>
                <span className="text-text-primary font-medium">{checkout}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Guests</span>
                <span className="text-text-primary font-medium">{adults}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Room</span>
                <span className="text-text-primary font-medium text-right max-w-[140px]">
                  {rate.roomTypeCode || 'Standard Room'}
                </span>
              </div>

              {rate.refundable !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Cancellation</span>
                  <span className={rate.refundable ? 'text-success font-medium' : 'text-text-muted'}>
                    {rate.refundable ? 'Free cancellation' : 'Non-refundable'}
                  </span>
                </div>
              )}

              <div className="divider" />

              {applyCredit && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Travel Credit applied</span>
                  <span className="text-success font-medium">-${creditToApply.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between font-semibold">
                <span className="text-text-primary">Total</span>
                <span className="text-text-primary">${effectiveAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-bg-elevated rounded-xl p-3 space-y-2">
              <p className="text-text-muted text-xs section-label">After stay completes</p>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Travel Credit</span>
                <span className="text-success font-medium">+${travelCreditEarned.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Pool contribution</span>
                <span className="text-amber font-medium">+${poolContribution.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Suspense fallback={<div className="flex justify-center py-20"><Loader2 size={32} className="text-amber animate-spin" /></div>}>
          <CheckoutContent />
        </Suspense>
      </main>
    </div>
  );
}
