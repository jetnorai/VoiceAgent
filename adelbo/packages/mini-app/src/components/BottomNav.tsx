'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, Map, Users, User } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { href: '/', label: 'Explore', icon: Globe },
  { href: '/trips', label: 'Trips', icon: Map },
  { href: '/pool', label: 'Pool', icon: Users },
  { href: '/account', label: 'Account', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-bg-base border-t border-bg-border safe-area-bottom">
      <div className="flex max-w-[480px] mx-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex-1 flex flex-col items-center gap-1 py-2 pt-3 transition-colors',
                isActive ? 'text-amber' : 'text-text-muted'
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
