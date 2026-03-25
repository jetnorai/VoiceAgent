'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hotelsApi } from '@/lib/api';
import { Sparkles, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';

interface HotelTruthPanelProps {
  hotelId: string;
  checkin: string;
  checkout: string;
  adults: number;
  userQuery?: string;
}

export function HotelTruthPanel({ hotelId, checkin, checkout, adults, userQuery }: HotelTruthPanelProps) {
  const [feedback, setFeedback] = useState<boolean | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-truth', hotelId, checkin, checkout, adults],
    queryFn: () =>
      hotelsApi.aiTruth(hotelId, { checkin, checkout, adults, userQuery }).then((r) => r.data),
    enabled: !!checkin && !!checkout,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (!checkin || !checkout) return null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-amber" />
        <h3 className="font-semibold text-text-primary">Hotel Truth Layer</h3>
        <span className="chip chip-amber ml-auto text-xs">AI</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-text-muted py-4">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Analysing fit, strengths, and honest weaknesses…</span>
        </div>
      ) : error ? (
        <p className="text-text-muted text-sm">AI assessment unavailable. Check the reviews tab for guest feedback.</p>
      ) : data?.content ? (
        <>
          <div
            className="text-text-secondary text-sm leading-relaxed whitespace-pre-line [&_strong]:text-text-primary [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{
              __html: data.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br />'),
            }}
          />

          {/* Feedback */}
          {feedback === null ? (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-bg-border">
              <span className="text-text-muted text-xs">Was this helpful?</span>
              <button
                onClick={() => setFeedback(true)}
                className="btn-ghost py-1 px-2 flex items-center gap-1 text-xs"
              >
                <ThumbsUp size={13} /> Yes
              </button>
              <button
                onClick={() => setFeedback(false)}
                className="btn-ghost py-1 px-2 flex items-center gap-1 text-xs"
              >
                <ThumbsDown size={13} /> No
              </button>
            </div>
          ) : (
            <p className="text-text-muted text-xs mt-4 pt-4 border-t border-bg-border">
              Thanks for the feedback.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
