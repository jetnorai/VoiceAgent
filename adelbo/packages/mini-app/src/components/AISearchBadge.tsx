'use client';

import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface AISearchBadgeProps {
  interpretation?: string;
  filters?: Record<string, any>;
}

export function AISearchBadge({ interpretation, filters }: AISearchBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (!interpretation) return null;

  return (
    <div className="glass-card p-3 border-amber/20">
      <button
        className="flex items-center justify-between w-full gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-amber flex-shrink-0" />
          <p className="text-xs text-text-secondary leading-snug text-left">{interpretation}</p>
        </div>
        {expanded ? (
          <ChevronUp size={13} className="text-text-muted flex-shrink-0" />
        ) : (
          <ChevronDown size={13} className="text-text-muted flex-shrink-0" />
        )}
      </button>
      {expanded && filters && Object.keys(filters).length > 0 && (
        <div className="mt-2 pt-2 border-t border-bg-border flex flex-wrap gap-1.5">
          {Object.entries(filters).map(([key, value]) => {
            if (!value) return null;
            return (
              <span key={key} className="chip chip-muted text-xs">
                {key}: {String(value)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
