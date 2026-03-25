'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, rewardsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Loader2, User, Mail, Wallet, Star, LogOut, Save, Shield } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const tierColors: Record<string, string> = {
  bronze: 'text-amber-600',
  silver: 'text-slate-400',
  gold: 'text-amber-400',
  platinum: 'text-violet-400',
};

export default function AccountPage() {
  const { token, user, clearAuth } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [editing, setEditing] = useState(false);

  const { data: creditData } = useQuery({
    queryKey: ['credit'],
    queryFn: () => rewardsApi.getCredit().then((r) => r.data),
    enabled: !!token,
  });

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateMe({ displayName }),
    onSuccess: () => {
      toast.success('Profile updated');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => toast.error('Failed to update'),
  });

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield size={40} className="text-amber" />
        <h2 className="text-2xl font-display font-bold text-text-primary">Sign in to Adelbo</h2>
        <p className="text-text-muted text-center max-w-sm">
          Access your trips, Travel Credit, and exclusive pool rewards.
        </p>
        <Link href="/auth" className="btn-primary px-8">Sign in</Link>
      </div>
    );
  }

  const credit = parseFloat(creditData?.balance || '0');
  const tier = user?.tier || 'bronze';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="font-display text-3xl font-bold text-text-primary">Account</h1>

      {/* Profile card */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-amber/10 border border-amber/20 flex items-center justify-center mb-3">
              <User size={24} className="text-amber" />
            </div>
            <p className={`text-sm font-semibold uppercase tracking-wider ${tierColors[tier] || 'text-amber'}`}>
              {tier} member
            </p>
          </div>
          <div className="text-right">
            <p className="text-text-muted text-xs">Travel Credit</p>
            <p className="text-2xl font-bold text-success">${credit.toFixed(2)}</p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <input
              className="input w-full"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {user?.displayName && (
              <div className="flex items-center gap-2 text-text-secondary text-sm">
                <User size={14} className="text-text-muted" />
                {user.displayName}
              </div>
            )}
            {user?.email && (
              <div className="flex items-center gap-2 text-text-secondary text-sm">
                <Mail size={14} className="text-text-muted" />
                {user.email}
              </div>
            )}
            {user?.walletAddress && (
              <div className="flex items-center gap-2 text-text-muted text-xs font-mono">
                <Wallet size={12} />
                {user.walletAddress.slice(0, 6)}…{user.walletAddress.slice(-4)}
              </div>
            )}
            <button onClick={() => setEditing(true)} className="btn-ghost text-sm mt-1">Edit profile</button>
          </div>
        )}
      </div>

      {/* Reputation */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-medium text-text-primary flex items-center gap-2">
            <Star size={16} className="text-amber" />
            Reputation
          </p>
          <span className={`chip ${tier === 'bronze' ? 'chip-muted' : tier === 'gold' ? 'chip-amber' : 'chip-muted'}`}>
            {tier}
          </span>
        </div>
        <div className="text-sm text-text-muted space-y-1">
          <p>Score: <span className="text-text-primary font-semibold">{user?.reputationScore || 0}</span></p>
          <p className="text-xs">Earn points by booking, reviewing, and paying with WLD (2× points).</p>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-center">
          {[
            { label: 'Silver', threshold: 200 },
            { label: 'Gold', threshold: 600 },
            { label: 'Platinum', threshold: 1500 },
          ].map((t) => (
            <div
              key={t.label}
              className={`p-2 rounded-lg border ${
                (user?.reputationScore || 0) >= t.threshold
                  ? 'border-amber/30 bg-amber/5 text-amber'
                  : 'border-bg-border text-text-muted'
              }`}
            >
              <p className="font-semibold">{t.label}</p>
              <p>{t.threshold}+ pts</p>
            </div>
          ))}
        </div>
      </div>

      {/* Links */}
      <div className="glass-card divide-y divide-bg-border">
        {[
          { href: '/trips', label: 'My trips' },
          { href: '/rewards', label: 'Travel Credit & rewards' },
          { href: '/pool', label: 'Community Pool' },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between px-5 py-4 hover:bg-bg-elevated transition-colors text-text-secondary text-sm"
          >
            {label}
            <span className="text-text-muted">→</span>
          </Link>
        ))}
      </div>

      {/* Sign out */}
      <button
        onClick={() => { clearAuth(); router.push('/'); toast.success('Signed out'); }}
        className="flex items-center gap-2 text-red-400 text-sm hover:text-red-300 transition-colors"
      >
        <LogOut size={15} />
        Sign out
      </button>
    </div>
  );
}
