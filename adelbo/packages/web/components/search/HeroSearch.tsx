'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, MapPin, Calendar, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { useSearchStore } from '@/lib/store';
import { format, addDays } from 'date-fns';

type SearchMode = 'standard' | 'intent';

export function HeroSearch() {
  const router = useRouter();
  const { search, setSearch } = useSearchStore();
  const [mode, setMode] = useState<SearchMode>('intent');
  const [loading, setLoading] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'intent' && search.query) {
      router.push(`/search?q=${encodeURIComponent(search.query)}&checkin=${search.checkin || tomorrow}&checkout=${search.checkout || nextWeek}&adults=${search.adults || 2}&intent=1`);
    } else if (mode === 'standard' && search.destination) {
      router.push(`/search?destination=${encodeURIComponent(search.destination)}&checkin=${search.checkin || tomorrow}&checkout=${search.checkout || nextWeek}&adults=${search.adults || 2}`);
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Mode toggle */}
      <div className="flex justify-center mb-4">
        <div className="flex p-1 rounded-xl bg-bg-surface border border-bg-border">
          <button
            type="button"
            onClick={() => setMode('intent')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              mode === 'intent'
                ? 'bg-amber text-bg-base'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Sparkles size={14} />
            Smart search
          </button>
          <button
            type="button"
            onClick={() => setMode('standard')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              mode === 'standard'
                ? 'bg-amber text-bg-base'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            <Search size={14} />
            Standard
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card-lg p-4 sm:p-6 glow-amber">
        {mode === 'intent' ? (
          <>
            <div className="mb-4">
              <textarea
                className="input w-full resize-none text-base h-20"
                placeholder="Quiet beach hotel in Bali, flexible cancellation, under $150 — or anything else…"
                value={search.query}
                onChange={(e) => setSearch({ query: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="date"
                  className="input w-full pl-9 text-sm"
                  value={search.checkin || tomorrow}
                  onChange={(e) => setSearch({ checkin: e.target.value })}
                  min={today}
                />
              </div>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="date"
                  className="input w-full pl-9 text-sm"
                  value={search.checkout || nextWeek}
                  onChange={(e) => setSearch({ checkout: e.target.value })}
                  min={search.checkin || tomorrow}
                />
              </div>
              <div className="relative">
                <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <select
                  className="input w-full pl-9 text-sm appearance-none"
                  value={search.adults || 2}
                  onChange={(e) => setSearch({ adults: parseInt(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative sm:col-span-1">
              <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                className="input w-full pl-9"
                placeholder="Destination"
                value={search.destination}
                onChange={(e) => setSearch({ destination: e.target.value })}
                required
              />
            </div>
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="date"
                className="input w-full pl-9"
                value={search.checkin || tomorrow}
                onChange={(e) => setSearch({ checkin: e.target.value })}
                min={today}
              />
            </div>
            <div className="relative">
              <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="date"
                className="input w-full pl-9"
                value={search.checkout || nextWeek}
                onChange={(e) => setSearch({ checkout: e.target.value })}
                min={search.checkin || tomorrow}
              />
            </div>
            <div className="relative">
              <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <select
                className="input w-full pl-9 appearance-none"
                value={search.adults || 2}
                onChange={(e) => setSearch({ adults: parseInt(e.target.value) })}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-4">
          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base">
            {mode === 'intent' ? <Sparkles size={18} /> : <Search size={18} />}
            {mode === 'intent' ? 'Find my hotel' : 'Search hotels'}
          </button>
        </div>

        {mode === 'intent' && (
          <p className="text-center text-text-muted text-xs mt-3">
            AI interprets your request and finds categorized options
          </p>
        )}
      </form>
    </div>
  );
}
