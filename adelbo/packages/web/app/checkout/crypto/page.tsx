'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { bookingsApi } from '@/lib/api';

function CryptoConfirmContent() {
  const params = useSearchParams();
  const router = useRouter();

  const bookingId = params.get('bookingId');
  const txHash = params.get('txHash');
  const currency = params.get('currency') || 'USDC';

  const [status, setStatus] = useState<'verifying' | 'confirmed' | 'failed'>('verifying');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!bookingId || !txHash) {
      setStatus('failed');
      return;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        const res = await bookingsApi.confirm(bookingId, { txHash, currency });
        if (!cancelled) {
          if (res.data.booking?.status === 'confirmed') {
            setStatus('confirmed');
            setTimeout(() => router.push(`/checkout/success?bookingId=${bookingId}`), 2500);
          } else {
            setAttempts((a) => a + 1);
          }
        }
      } catch {
        if (!cancelled) setAttempts((a) => a + 1);
      }
    };

    if (status === 'verifying') {
      verify();
    }

    return () => { cancelled = true; };
  }, [bookingId, txHash, currency, attempts]);

  // Retry up to 8 times (polling every 3s)
  useEffect(() => {
    if (status !== 'verifying' || attempts === 0) return;
    if (attempts >= 8) { setStatus('failed'); return; }
    const t = setTimeout(() => {
      // trigger retry via attempts change
    }, 3000);
    return () => clearTimeout(t);
  }, [attempts, status]);

  const explorerBase = 'https://worldscan.org/tx/';

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
      {status === 'verifying' && (
        <>
          <div className="w-16 h-16 rounded-full bg-amber/10 border border-amber/20 flex items-center justify-center mb-6">
            <Loader2 size={28} className="text-amber animate-spin" />
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Verifying payment…</h1>
          <p className="text-text-muted max-w-sm">
            Confirming your {currency} transaction on World Chain. This usually takes a few seconds.
          </p>
          {txHash && (
            <a
              href={`${explorerBase}${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex items-center gap-2 text-amber text-sm hover:underline"
            >
              View on World Scan <ExternalLink size={13} />
            </a>
          )}
          <div className="mt-4 flex gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`h-1 w-6 rounded-full transition-colors ${
                  i < attempts ? 'bg-amber' : 'bg-bg-elevated'
                }`}
              />
            ))}
          </div>
        </>
      )}

      {status === 'confirmed' && (
        <>
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-success/20 blur-2xl scale-150" />
            <div className="relative w-16 h-16 rounded-full bg-success/10 border border-success/30 flex items-center justify-center">
              <CheckCircle size={28} className="text-success" />
            </div>
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Payment confirmed!</h1>
          <p className="text-text-muted">Redirecting to your booking…</p>
        </>
      )}

      {status === 'failed' && (
        <>
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary mb-2">Verification failed</h1>
          <p className="text-text-muted max-w-sm mb-6">
            We couldn't confirm your transaction. If your payment went through, check your trips — the booking may still be processing.
          </p>
          {txHash && (
            <a
              href={`${explorerBase}${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-amber text-sm hover:underline mb-6"
            >
              Check transaction on World Scan <ExternalLink size={13} />
            </a>
          )}
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Link href="/trips" className="btn-primary">Check my trips</Link>
            <Link href="/" className="btn-ghost">Back to home</Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function CryptoCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="text-amber animate-spin" />
      </div>
    }>
      <CryptoConfirmContent />
    </Suspense>
  );
}
