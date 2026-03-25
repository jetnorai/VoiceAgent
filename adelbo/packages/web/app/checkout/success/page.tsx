'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function SuccessContent() {
  const params = useSearchParams();
  const bookingId = params.get('bookingId');

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-success/20 blur-2xl scale-150" />
        <div className="relative w-20 h-20 rounded-full bg-success/10 border border-success/30 flex items-center justify-center">
          <CheckCircle size={36} className="text-success" />
        </div>
      </div>

      <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Booking confirmed!</h1>
      <p className="text-text-muted max-w-sm mb-8">
        Your reservation is confirmed. Check your email for details and check-in instructions.
      </p>

      <div className="glass-card p-5 w-full max-w-sm space-y-3 mb-8 text-left">
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-amber flex-shrink-0" />
          <div>
            <p className="text-text-muted text-xs">Booking ID</p>
            <p className="font-mono text-sm text-text-primary">{bookingId || '—'}</p>
          </div>
        </div>
        <div className="pt-2 border-t border-bg-border">
          <p className="text-xs text-text-muted">
            Travel Credit (1.25% of stay) will be deposited when your stay is completed.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        {bookingId && (
          <Link href={`/trips/${bookingId}`} className="btn-primary flex items-center justify-center gap-2">
            View booking <ArrowRight size={16} />
          </Link>
        )}
        <Link href="/trips" className="btn-secondary">All trips</Link>
        <Link href="/" className="btn-ghost">Back to home</Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-amber border-t-transparent rounded-full" /></div>}>
      <SuccessContent />
    </Suspense>
  );
}
