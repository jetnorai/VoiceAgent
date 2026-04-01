'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { hotelsApi, bookingsApi, paymentsApi, rewardsApi } from '@/src/lib/api';
import { useAuthStore } from '@/src/lib/store';
import { payWithUsdc, payWithWld } from '@/src/lib/minikit';
import { Loader2, ChevronLeft, Coins, CreditCard, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

function CheckoutContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, token } = useAuthStore();

  const hotelId = params.get('hotelId') || '';
  const rateId = params.get('rateId') || '';
  const checkin = params.get('checkin') || '';
  const checkout = params.get('checkout') || '';
  const adults = parseInt(params.get('adults') || '2');

  const [paymentMethod, setPaymentMethod] = useState<'usdc' | 'wld'>('usdc');
  const [firstName, setFirstName] = useState(user?.displayName?.split(' ')[0] || '');
  const [lastName, setLastName] = useState(user?.displayName?.split(' ')[1] || '');
  const [email, setEmail] = useState(user?.email || '');
  const [processing, setProcessing] = useState(false);

  const { data: hotelData } = useQuery({
    queryKey: ['hotel', hotelId],
    queryFn: () => hotelsApi.get(hotelId).then((r) => r.data),
    enabled: !!hotelId,
  });

  const { data: ratesData } = useQuery({
    queryKey: ['rates', hotelId, checkin, checkout, adults],
    queryFn: () =>
      hotelsApi.getRates(hotelId, { checkin, checkout, adults: adults.toString(), currency: 'USD' })
        .then((r) => r.data),
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
  const nights = checkin && checkout
    ? Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000)
    : 1;
  const travelCreditEarned = (totalAmount / 1.05) * 0.0125;
  const creditBalance = parseFloat(creditData?.balance || '0');

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
        guest: { firstName, lastName, email },
        paymentMethod,
        totalAmount,
        currency: 'USD',
      }).then((r) => r.data),
  });

  const confirmMutation = useMutation({
    mutationFn: ({ bookingId, txHash }: { bookingId: string; txHash: string }) =>
      bookingsApi.confirm(bookingId, { onChainTxHash: txHash }).then((r) => r.data),
  });

  async function handlePay() {
    if (!firstName || !lastName || !email) {
      toast.error('Please fill in all details');
      return;
    }
    if (!token) {
      toast.error('Please sign in first');
      router.push('/account');
      return;
    }

    setProcessing(true);
    try {
      // 1. Pre-book rate
      const prebook = await prebookMutation.mutateAsync();

      // 2. Create booking record
      const booking = await createBookingMutation.mutateAsync(prebook.prebookId);

      // 3. Pay via World Wallet
      const contractAddress = process.env.NEXT_PUBLIC_MARGIN_SPLITTER_ADDRESS || '';
      const amountDecimal = totalAmount.toFixed(2); // USD decimal string e.g. "149.99"
      const description = `Adelbo — ${hotel?.name || 'Hotel booking'}`;

      let result;
      if (paymentMethod === 'usdc') {
        result = await payWithUsdc(contractAddress, amountDecimal, booking.bookingId, description);
      } else {
        // WLD: backend converts at oracle price — approximate here
        // In production the backend computes exact WLD amount
        result = await payWithWld(contractAddress, amountDecimal, booking.bookingId, description);
      }

      if (!result.success) {
        toast.error(result.error || 'Payment was cancelled');
        return;
      }

      // 4. Confirm booking with tx hash
      await confirmMutation.mutateAsync({ bookingId: booking.bookingId, txHash: result.transactionId || '' });

      toast.success('Booking confirmed!');
      router.push(`/trips/${booking.bookingId}?confirmed=1`);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Booking failed');
    } finally {
      setProcessing(false);
    }
  }

  if (!hotel || !rate) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="text-amber animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-32">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b border-bg-border">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-text-muted text-sm mb-3">
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="font-display text-xl font-bold text-text-primary">Complete booking</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Booking summary */}
        <div className="glass-card p-4">
          <p className="font-semibold text-text-primary">{hotel.name}</p>
          <p className="text-text-muted text-sm mt-0.5">{checkin} → {checkout} · {nights} night{nights > 1 ? 's' : ''}</p>
          <p className="text-text-muted text-sm">{rate.roomTypeCode || 'Standard Room'}</p>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-bg-border">
            <span className="text-text-muted text-sm">Total</span>
            <span className="font-bold text-text-primary text-lg">${totalAmount.toFixed(2)}</span>
          </div>
          {travelCreditEarned > 0 && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-success">
              <ShieldCheck size={11} />
              +${travelCreditEarned.toFixed(2)} Travel Credit after stay
            </div>
          )}
        </div>

        {/* Guest details */}
        <div className="glass-card p-4 space-y-3">
          <p className="font-medium text-text-primary text-sm">Guest details</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <input
            type="email"
            className="input w-full"
            placeholder="Email for confirmation"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* Payment method */}
        <div className="glass-card p-4">
          <p className="font-medium text-text-primary text-sm mb-3">Pay with World Wallet</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: 'usdc', label: 'USDC', sub: 'Stablecoin' },
              { id: 'wld', label: 'WLD', sub: '2× reputation' },
            ] as const).map(({ id, label, sub }) => (
              <button
                key={id}
                onClick={() => setPaymentMethod(id)}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                  paymentMethod === id ? 'border-amber bg-amber/5' : 'border-bg-border'
                }`}
              >
                <Coins size={20} className={paymentMethod === id ? 'text-amber mb-1' : 'text-text-muted mb-1'} />
                <span className={`text-sm font-semibold ${paymentMethod === id ? 'text-amber' : 'text-text-muted'}`}>{label}</span>
                <span className="text-xs text-text-muted">{sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Credit balance info */}
        {creditBalance > 0 && (
          <div className="glass-card p-3 flex items-center gap-2">
            <ShieldCheck size={15} className="text-success flex-shrink-0" />
            <p className="text-xs text-text-secondary">
              You have <span className="text-success font-medium">${creditBalance.toFixed(2)}</span> in Travel Credit.
              Credit can be applied on the web app checkout.
            </p>
          </div>
        )}
      </div>

      {/* Pay button */}
      <div className="fixed bottom-16 left-0 right-0 max-w-miniapp mx-auto px-4 pb-3 pt-2 bg-gradient-to-t from-bg-base to-transparent z-20">
        <button
          onClick={handlePay}
          disabled={processing || !firstName || !lastName || !email}
          className="btn-primary w-full flex items-center justify-center gap-2 py-4"
        >
          {processing ? (
            <><Loader2 size={18} className="animate-spin" /> Processing…</>
          ) : (
            <><ShieldCheck size={18} /> Pay ${totalAmount.toFixed(2)} with {paymentMethod.toUpperCase()}</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="text-amber animate-spin" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
