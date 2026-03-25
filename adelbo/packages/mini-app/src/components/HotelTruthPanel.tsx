'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { hotelsApi } from '@/src/lib/api';
import { Sparkles, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';

interface HotelTruthPanelProps {
  hotelId: string;
  query?: string;
  checkin?: string;
  checkout?: string;
  adults?: number;
}

export function HotelTruthPanel({ hotelId, query, checkin, checkout, adults }: HotelTruthPanelProps) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [truth, setTruth] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      hotelsApi.aiTruth(hotelId, { query, checkin, checkout, adults }).then((r) => r.data),
    onSuccess: (d) => setTruth(d.content),
  });

  if (!truth && !mutation.isPending) {
    return (
      <button
        onClick={() => mutation.mutate()}
        className="flex items-center gap-2 text-amber text-sm font-medium"
      >
        <Sparkles size={14} />
        Get AI truth layer
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-amber flex-shrink-0" />
        <p className="text-sm font-medium text-text-primary">AI Truth Layer</p>
      </div>

      {mutation.isPending ? (
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Loader2 size={14} className="animate-spin" />
          Analyzing…
        </div>
      ) : truth ? (
        <>
          <div
            className="text-text-secondary text-xs leading-relaxed [&_strong]:text-text-primary [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{
              __html: truth
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br />'),
            }}
          />
          {!feedback && (
            <div className="flex items-center gap-2">
              <p className="text-text-muted text-xs">Helpful?</p>
              <button
                onClick={() => setFeedback('up')}
                className="p-1 rounded-lg hover:bg-bg-elevated transition-colors"
              >
                <ThumbsUp size={13} className="text-text-muted" />
              </button>
              <button
                onClick={() => setFeedback('down')}
                className="p-1 rounded-lg hover:bg-bg-elevated transition-colors"
              >
                <ThumbsDown size={13} className="text-text-muted" />
              </button>
            </div>
          )}
          {feedback && (
            <p className="text-xs text-text-muted">Thanks for your feedback!</p>
          )}
        </>
      ) : null}
    </div>
  );
}
