'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Loader2, Mail, ArrowRight, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuthPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const requestOTPMutation = useMutation({
    mutationFn: (email: string) => authApi.requestOTP(email).then((r) => r.data),
    onSuccess: () => {
      setStep('otp');
      toast.success('Code sent to your email');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to send code');
    },
  });

  const verifyOTPMutation = useMutation({
    mutationFn: ({ email, token }: { email: string; token: string }) =>
      authApi.verifyOTP(email, token).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.token, data.user);
      localStorage.setItem('adelbo_token', data.token);
      toast.success(data.user.isNewUser ? 'Welcome to Adelbo!' : 'Welcome back!');
      router.push('/');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Invalid code');
    },
  });

  function handleRequestOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    requestOTPMutation.mutate(email);
  }

  function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;
    verifyOTPMutation.mutate({ email, token: otp });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-amber flex items-center justify-center mx-auto mb-4">
            <span className="font-display font-black text-bg-base text-xl">A</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Sign in to Adelbo</h1>
          <p className="text-text-muted text-sm mt-1">Smarter stays start here.</p>
        </div>

        <div className="glass-card p-6">
          {step === 'email' ? (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label className="section-label mb-1.5 block">Email address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="email"
                    className="input w-full pl-9"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!email || requestOTPMutation.isPending}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {requestOTPMutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Sending code…</>
                ) : (
                  <>Continue <ArrowRight size={16} /></>
                )}
              </button>

              <p className="text-text-muted text-xs text-center">
                We'll send a 6-digit sign-in code. No password needed.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle size={20} className="text-success" />
                </div>
                <p className="text-sm text-text-secondary">
                  Enter the 6-digit code sent to <strong className="text-text-primary">{email}</strong>
                </p>
              </div>

              <div>
                <input
                  type="text"
                  className="input w-full text-center text-2xl font-bold tracking-widest"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  autoFocus
                  required
                />
              </div>

              <button
                type="submit"
                disabled={otp.length !== 6 || verifyOTPMutation.isPending}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {verifyOTPMutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                ) : (
                  <>Sign in <ArrowRight size={16} /></>
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('email')}
                className="btn-ghost w-full text-sm"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>

        <p className="text-text-muted text-xs text-center mt-4">
          By signing in, you agree to our{' '}
          <a href="/terms" className="underline hover:text-text-primary">Terms</a> and{' '}
          <a href="/privacy" className="underline hover:text-text-primary">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
