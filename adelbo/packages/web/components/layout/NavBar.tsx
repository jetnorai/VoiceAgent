'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useAuthStore } from '@/lib/store';
import { Globe, LayoutDashboard, Gift, Users, LogIn } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Explore', icon: Globe },
  { href: '/trips', label: 'Trips', icon: LayoutDashboard },
  { href: '/rewards', label: 'Rewards', icon: Gift },
  { href: '/pool', label: 'Pool', icon: Users },
];

export function NavBar() {
  const pathname = usePathname();
  const { user, token } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-bg-border bg-bg-base/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-amber flex items-center justify-center">
            <span className="font-display font-black text-bg-base text-sm">A</span>
          </div>
          <span className="font-display font-bold text-xl text-text-primary">adelbo</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === href
                  ? 'text-text-primary bg-bg-elevated'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated/50'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {token && user ? (
            <Link href="/account" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber/20 border border-amber/30 flex items-center justify-center">
                <span className="text-amber text-xs font-bold">
                  {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                </span>
              </div>
            </Link>
          ) : (
            <Link href="/auth" className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
              <LogIn size={15} />
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="sm:hidden flex border-t border-bg-border">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
              pathname === href ? 'text-amber' : 'text-text-muted'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
