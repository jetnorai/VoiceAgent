'use client';

import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';
import { bookingsApi } from '@/lib/api';
import { Loader2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

interface StripePaymentFormProps {
  bookingId: string;
}

export function StripePaymentForm({ bookingId }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      toast.error(error.message || 'Payment failed');
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      try {
        await bookingsApi.confirm(bookingId, {
          stripePaymentIntentId: paymentIntent.id,
        });
        toast.success('Booking confirmed!');
        router.push(`/trips/${bookingId}?confirmed=1`);
      } catch {
        toast.error('Payment succeeded but confirmation failed — please contact support');
        router.push(`/trips/${bookingId}`);
      }
    }

    setProcessing(false);
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4">
      <h2 className="font-semibold text-text-primary">Card details</h2>

      <PaymentElement
        options={{
          layout: 'accordion',
        }}
      />

      <button
        type="submit"
        disabled={!stripe || processing}
        className="btn-primary w-full py-4 flex items-center justify-center gap-2"
      >
        {processing ? (
          <><Loader2 size={18} className="animate-spin" /> Processing…</>
        ) : (
          <><Lock size={16} /> Confirm and pay</>
        )}
      </button>

      <p className="text-text-muted text-xs text-center">
        Secured by Stripe. Your card details are never stored on Adelbo.
      </p>
    </form>
  );
}
