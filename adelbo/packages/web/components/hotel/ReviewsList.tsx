'use client';

import { ShieldCheck, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ReviewsListProps {
  hotelId: string;
  verifiedReviews: any[];
}

export function ReviewsList({ hotelId, verifiedReviews }: ReviewsListProps) {
  if (verifiedReviews.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <ShieldCheck size={32} className="text-text-muted mx-auto mb-3" />
        <p className="font-medium text-text-primary mb-1">No verified reviews yet</p>
        <p className="text-text-muted text-sm">
          Verified reviews come from guests who completed a stay here, confirmed by oracle consensus.
        </p>
      </div>
    );
  }

  const avgRating = verifiedReviews.reduce((sum, r) => sum + r.rating, 0) / verifiedReviews.length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="glass-card p-5 flex items-center gap-4">
        <div className="text-center">
          <p className="font-display text-4xl font-black text-text-primary">{avgRating.toFixed(1)}</p>
          <div className="flex items-center gap-0.5 justify-center mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
                className={i < Math.round(avgRating) ? 'text-amber fill-amber' : 'text-bg-border fill-bg-border'}
              />
            ))}
          </div>
          <p className="text-text-muted text-xs mt-1">{verifiedReviews.length} verified stay{verifiedReviews.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 pl-4 border-l border-bg-border">
          <div className="flex items-center gap-1.5 text-sm text-text-secondary">
            <ShieldCheck size={14} className="text-success" />
            All reviews are tied to completed, oracle-verified stays.
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="space-y-3">
        {verifiedReviews.map((review) => (
          <div key={review.id} className="glass-card p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      className={i < review.rating ? 'text-amber fill-amber' : 'text-bg-border fill-bg-border'}
                    />
                  ))}
                </div>
                {review.onChainVerified && (
                  <span className="chip chip-success text-xs">
                    <ShieldCheck size={9} /> Verified
                  </span>
                )}
              </div>
              <span className="text-text-muted text-xs">
                {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
              </span>
            </div>

            {review.title && (
              <h4 className="font-medium text-text-primary mb-1">{review.title}</h4>
            )}
            <p className="text-text-secondary text-sm leading-relaxed">{review.content}</p>

            {review.tags?.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {review.tags.map((tag: string) => (
                  <span key={tag} className="chip chip-muted">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
