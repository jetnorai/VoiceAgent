'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, MapPin, Calendar, Users, Loader2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { useSearchStore } from '@/lib/store';

export function ExploreScreen() {
  const router = useRouter();
  const { search, setSearch } = useSearchStore();
  const [mode, setMode] = useState<'intent' | 'standard'>('intent');

  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (mode === 'intent' && search.query) {
      router.push(`/search?q=${encodeURIComponent(search.query)}&checkin=${search.checkin || tomorrow}&checkout=${search.checkout || nextWeek}&adults=${search.adults || 2}&intent=1`);
    } else if (mode === 'standard' && search.destination) {
      router.push(`/search?destination=${encodeURIComponent(search.destination)}&checkin=${search.checkin || tomorrow}&checkout=${search.checkout || nextWeek}&adults=${search.adults || 2}`);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-20">
      {/* Header */}
      <div className="px-4 pt-8 pb-6 bg-gradient-to-b from-bg-base to-transparent">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-amber flex items-center justify-center">
            <span className="font-bold text-bg-base text-sm">A</span>
          </div>
          <span className="font-bold text-lg text-text-primary">adelbo</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-text-primary mt-4 leading-tight">
          Smarter stays<br />start here.
        </h1>
        <p className="text-text-muted text-sm mt-1">AI-assisted booking · Travel Credit · Community Pool</p>
      </div>

      {/* Search form */}
      <div className="px-4">
        {/* Mode toggle */}
        <div className="flex p-1 rounded-xl bg-bg-surface border border-bg-border mb-3">
          <button
            type="button"
            onClick={() => setMode('intent')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'intent' ? 'bg-amber text-bg-base' : 'text-text-muted'
            }`}
          >
            <Sparkles size={13} /> Smart search
          </button>
          <button
            type="button"
            onClick={() => setMode('standard')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'standard' ? 'bg-amber text-bg-base' : 'text-text-muted'
            }`}
          >
            <Search size={13} /> Standard
          </button>
        </div>

        <form onSubmit={handleSearch} className="bg-bg-surface border border-bg-border rounded-2xl p-4 space-y-3">
          {mode === 'intent' ? (
            <textarea
              className="input w-full text-sm resize-none h-16"
              placeholder="Quiet hotel in Bali, flexible cancellation, under $100…"
              value={search.query}
              onChange={(e) => setSearch({ query: e.target.value })}
            />
          ) : (
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                className="input w-full pl-8 text-sm"
                placeholder="Destination"
                value={search.destination}
                onChange={(e) => setSearch({ destination: e.target.value })}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="date"
                className="input w-full pl-8 text-sm"
                value={search.checkin || tomorrow}
                onChange={(e) => setSearch({ checkin: e.target.value })}
                min={today}
              />
            </div>
            <div className="relative">
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="date"
                className="input w-full pl-8 text-sm"
                value={search.checkout || nextWeek}
                onChange={(e) => setSearch({ checkout: e.target.value })}
                min={search.checkin || tomorrow}
              />
            </div>
          </div>

          <div className="relative">
            <Users size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <select
              className="input w-full pl-8 text-sm"
              value={search.adults || 2}
              onChange={(e) => setSearch({ adults: parseInt(e.target.value) })}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            {mode === 'intent' ? <Sparkles size={15} /> : <Search size={15} />}
            Find hotels
          </button>
        </form>
      </div>

      {/* Popular destinations */}
      <div className="px-4 mt-6">
        <p className="section-label mb-3">Popular destinations</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: 'Bali', emoji: '🌴' },
            { name: 'Paris', emoji: '🗼' },
            { name: 'Tokyo', emoji: '🏯' },
            { name: 'Barcelona', emoji: '🌊' },
          ].map(({ name, emoji }) => (
            <button
              key={name}
              onClick={() => {
                setSearch({ destination: name });
                setMode('standard');
              }}
              className="flex items-center gap-2 p-3 rounded-xl bg-bg-surface border border-bg-border hover:border-amber/30 transition-colors text-left"
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-sm font-medium text-text-primary">{name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
