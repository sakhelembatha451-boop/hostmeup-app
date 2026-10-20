import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Star, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  artistId?: string;
  artistName?: string;
  targetHostId?: string;
  hostName?: string;
  onSuccess?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  bookingId,
  artistId,
  artistName,
  targetHostId,
  hostName,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const displayName = artistName || hostName || 'User';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to leave a review.');

      if (targetHostId) {
        // --- 1. HOST REVIEW FLOW ---
        // Automatically resolve or fallback artist_id so it never violates any NOT NULL constraint
        let resolvedArtistId = artistId;
        if (!resolvedArtistId) {
          const { data: artistProfile } = await supabase
            .from('artist_profiles')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          resolvedArtistId = artistProfile?.id || user.id;
        }

        const reviewPayload: any = {
          booking_id: bookingId,
          target_host_id: targetHostId,
          artist_id: resolvedArtistId,
          reviewer_id: user.id,
          reviewer_role: 'artist',
          rating: rating,
          comment: comment.trim(),
        };

        const { error: hostReviewErr } = await supabase.from('reviews').upsert(
          reviewPayload,
          { onConflict: 'booking_id' }
        );

        if (hostReviewErr) throw hostReviewErr;

        // Recalculate metrics on host_profiles if aggregate columns exist
        const { data: hostReviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('target_host_id', targetHostId);

        if (hostReviews && hostReviews.length > 0) {
          const totalCount = hostReviews.length;
          const avgRating = hostReviews.reduce((acc, curr) => acc + curr.rating, 0) / totalCount;

          await supabase
            .from('host_profiles')
            .update({
              rating: Number(avgRating.toFixed(2)),
              review_count: totalCount,
            })
            .or(`id.eq.${targetHostId},user_id.eq.${targetHostId}`);
        }
      } else if (artistId) {
        // --- 2. ARTIST REVIEW FLOW ---
        const { data: targetArtist } = await supabase
          .from('artist_profiles')
          .select('id, user_id')
          .or(`id.eq.${artistId},user_id.eq.${artistId}`)
          .maybeSingle();

        const resolvedArtistId = artistId || targetArtist?.id || targetArtist?.user_id;
        const profileDbId = targetArtist?.id;
        const userAuthId = targetArtist?.user_id;

        const { error: reviewErr } = await supabase.from('reviews').upsert(
          {
            booking_id: bookingId,
            artist_id: resolvedArtistId,
            reviewer_id: user.id,
            reviewer_role: 'host',
            rating: rating,
            comment: comment.trim(),
          },
          { onConflict: 'booking_id' }
        );

        if (reviewErr) throw reviewErr;

        const { data: reviews, error: fetchErr } = await supabase
          .from('reviews')
          .select('rating')
          .or(`artist_id.eq.${resolvedArtistId}${profileDbId ? `,artist_id.eq.${profileDbId}` : ''}${userAuthId ? `,artist_id.eq.${userAuthId}` : ''}`);

        if (!fetchErr && reviews && reviews.length > 0) {
          const totalCount = reviews.length;
          const avgRating = reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalCount;

          await supabase
            .from('artist_profiles')
            .update({
              rating: Number(avgRating.toFixed(2)),
              review_count: totalCount,
            })
            .or(`id.eq.${resolvedArtistId},user_id.eq.${resolvedArtistId}${profileDbId ? `,id.eq.${profileDbId}` : ''}`);
        }
      } else {
        throw new Error('Target profile recipient ID is missing.');
      }

      setSubmitted(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error submitting review:', err);
      setError(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-line p-8 max-w-md w-full relative shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-400 hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-3 animate-fade-in">
            <div className="w-14 h-14 bg-emerald-700 text-paper flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-display text-2xl font-bold text-ink">Review Submitted!</h3>
            <p className="text-xs text-ink-500">Thank you for rating {displayName}.</p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-wide-sm text-ink-400 font-bold mb-1">
                Post-Gig Feedback
              </p>
              <h2 className="font-display text-2xl font-bold text-ink tracking-tight">
                Rate {displayName}
              </h2>
              <p className="text-xs text-ink-500 mt-1">
                Share your feedback to help the HostMeUp community build trust.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-800 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Star Rating Picker */}
              <div className="flex flex-col items-center gap-2 py-2 border-y border-line">
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= (hoverRating || rating)
                            ? 'fill-amber-500 text-amber-500'
                            : 'text-ink-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-bold uppercase tracking-wide-sm text-ink">
                  {rating === 5 && 'Outstanding'}
                  {rating === 4 && 'Very Good'}
                  {rating === 3 && 'Average'}
                  {rating === 2 && 'Below Average'}
                  {rating === 1 && 'Poor'}
                </span>
              </div>

              {/* Text Review Comment */}
              <div>
                <label className="block text-[10px] uppercase tracking-wide-sm text-ink-400 mb-1">
                  Written Feedback (Optional)
                </label>
                <textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was their punctuality, professionalism, and communication?"
                  className="input-field w-full p-3 text-xs bg-paper-100 border border-line focus:border-ink focus:bg-paper focus:outline-none text-ink"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-xs font-semibold uppercase tracking-wide-sm bg-ink text-paper hover:bg-ink/90 border border-ink disabled:opacity-50 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting Review...
                  </>
                ) : (
                  'Submit Review'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
