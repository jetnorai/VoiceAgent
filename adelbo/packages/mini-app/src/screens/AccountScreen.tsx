'use client';

import { useQuery } from '@tanstack/react-query';
import { rewardsApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { verifyWorldId } from '@/lib/minikit';
import { useMutation } from '@tanstack/react-query';
import { User, CreditCard, Trophy, LogOut, Globe } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const TIER_LABELS: Record<string, string> = {
  explorer: 'Explorer',
  adventurer: 'Adventurer',
  voyager: 'Voyager',
  globetrotter: 'Globetrotter',
};

export function AccountScreen() {
  const router = useRouter();
  const { token, user, setAuth, clearAuth } = useAuthStore();

  const { data: creditData } = useQuery({
    queryKey: ['credit'],
    queryFn: () => rewardsApi.getCredit().then((r) => r.data),
    enabled: !!token,
  });

  const worldIdMutation = useMutation({
    mutationFn: async () => {
      const proof = await verifyWorldId();
      if (!proof) throw new Error('Verification cancelled');
      return authApi.verifyWorld({ ...proof, walletAddress: (window as any).WorldApp?.walletAddress }).then((r) => r.data);
    },
    onSuccess: (data) => {
      setAuth(data.token, data.user);
      localStorage.setItem('adelbo_token', data.token);
      toast.success('Signed in with World ID');
    },
    onError: (err: any) => {
      toast.error(err.message || 'World ID verification failed');
    },
  });

  if (!token) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 pb-20">
        <div className="w-14 h-14 rounded-2xl bg-amber/10 flex items-center justify-center mb-4">
          <User size={28} className="text-amber" />
        </div>
        <h2 className="font-display text-xl font-bold text-text-primary mb-2">Your account</h2>
        <p className="text-text-muted text-sm text-center mb-6">
          Sign in to view your Travel Credit, Pool standing, and bookings.
        </p>

        <button
          onClick={() => worldIdMutation.mutate()}
          disabled={worldIdMutation.isPending}
          className="btn-primary w-full flex items-center justify-center gap-2 mb-3"
        >
          <Globe size={18} />
          {worldIdMutation.isPending ? 'Verifying…' : 'Sign in with World ID'}
        </button>

        <p className="text-text-muted text-xs text-center">Verified human. No password needed.</p>
      </div>
    );
  }

  const balance = parseFloat(creditData?.balance || '0');
  const tier = (user?.tier || 'explorer') as string;

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-20">
      <div className="px-4 pt-8 pb-4">
        <h1 className="font-display text-2xl font-bold text-text-primary">Account</h1>
      </div>

      {/* Profile card */}
      <div className="mx-4 bg-bg-surface border border-bg-border rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber/20 border border-amber/30 flex items-center justify-center">
            <span className="text-amber text-lg font-bold">
              {(user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-text-primary">{user?.displayName || user?.email || 'Traveler'}</p>
            <p className="text-amber text-sm font-medium">{TIER_LABELS[tier] || 'Explorer'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-elevated rounded-xl p-3 text-center">
            <p className="text-text-muted text-xs mb-1">Travel Credit</p>
            <p className="font-display font-bold text-lg text-success">${balance.toFixed(2)}</p>
          </div>
          <div className="bg-bg-elevated rounded-xl p-3 text-center">
            <p className="text-text-muted text-xs mb-1">Reputation</p>
            <p className="font-display font-bold text-lg text-text-primary">{user?.reputationScore || 0}</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="mx-4 bg-bg-surface border border-bg-border rounded-2xl overflow-hidden mb-4">
        <Link href="/trips" className="flex items-center gap-3 px-4 py-4 border-b border-bg-border hover:bg-bg-elevated transition-colors">
          <CreditCard size={18} className="text-text-muted" />
          <span className="text-text-primary">My trips</span>
        </Link>
        <Link href="/rewards" className="flex items-center gap-3 px-4 py-4 border-b border-bg-border hover:bg-bg-elevated transition-colors">
          <CreditCard size={18} className="text-text-muted" />
          <span className="text-text-primary">Travel Credit</span>
        </Link>
        <Link href="/pool" className="flex items-center gap-3 px-4 py-4 hover:bg-bg-elevated transition-colors">
          <Trophy size={18} className="text-text-muted" />
          <span className="text-text-primary">Pool standing</span>
        </Link>
      </div>

      <div className="mx-4">
        <button
          onClick={() => { clearAuth(); localStorage.removeItem('adelbo_token'); }}
          className="w-full flex items-center justify-center gap-2 text-red-400 text-sm py-3 border border-red-900/30 rounded-xl hover:bg-red-900/10 transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  );
}
