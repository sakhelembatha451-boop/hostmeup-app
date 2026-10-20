import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Star, MapPin, ArrowLeft, Loader2, Image as ImageIcon, Video, Calendar, PartyPopper } from 'lucide-react';

interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  reviewer?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface EventPost {
  id: string;
  title: string;
  event_date: string;
  media_url?: string | null;
  media_type?: 'image' | 'video';
  description?: string;
}

interface HostProfileData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  location: string;
}

export default function HostProfileView() {
  const { id } = useParams<{ id: string }>();
  const [host, setHost] = useState<HostProfileData | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [pastEvents, setPastEvents] = useState<EventPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reviews' | 'events'>('reviews');

  useEffect(() => {
    async function loadHostData() {
      if (!id) return;
      setLoading(true);

      try {
        // 1. Fetch Host Picture & Basic Info
        const { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, location')
          .eq('id', id)
          .maybeSingle();

        if (profileErr || !profileData) {
          console.error('Error loading host profile:', profileErr);
          setLoading(false);
          return;
        }

        setHost(profileData);

        // 2. Fetch Reviews Left by Booked Talent Providers
        const { data: reviewData } = await supabase
          .from('reviews')
          .select('id, rating, comment, created_at, reviewer_id')
          .eq('target_host_id', id)
          .order('created_at', { ascending: false });

        if (reviewData) {
          const reviewerIds = Array.from(new Set(reviewData.map((r) => r.reviewer_id).filter(Boolean)));
          
          let reviewerMap = new Map();
          if (reviewerIds.length > 0) {
            const { data: reviewers } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .in('id', reviewerIds);

            if (reviewers) {
              reviewerMap = new Map(reviewers.map((rev) => [rev.id, rev]));
            }
          }

          setReviews(reviewData.map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            reviewer: reviewerMap.get(r.reviewer_id) || { full_name: 'Talent Provider', avatar_url: null },
          })));
        }

        // 3. Fetch Past Events Hosted by this Host
        const { data: eventsData } = await supabase
          .from('bookings')
          .select('id, event_name, event_date, notes')
          .or(`host_id.eq.${id},client_id.eq.${id}`)
          .or('status.eq.completed,completed_at.not.is.null')
          .order('event_date', { ascending: false });

        if (eventsData) {
          setPastEvents(eventsData.map((e) => ({
            id: e.id,
            title: e.event_name || 'Past Hosted Event',
            event_date: e.event_date || '',
            description: e.notes || undefined,
          })));
        }

      } catch (err) {
        console.error('Error loading host view:', err);
      } finally {
        setLoading(false);
      }
    }

    loadHostData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <Loader2 className="w-6 h-6 text-ink animate-spin" />
      </div>
    );
  }

  if (!host) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-display text-2xl font-bold text-ink mb-2">Host Not Found</h2>
        <Link to="/browse" className="btn-primary px-5 py-2.5 text-xs uppercase tracking-wide-sm">
          Back to Browse
        </Link>
      </div>
    );
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 'New';

  return (
    <div className="min-h-screen bg-paper py-12 px-6 lg:px-12">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        
        {/* Back Button */}
        <Link to={-1 as any} className="inline-flex items-center gap-2 text-xs font-semibold text-ink-500 hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        {/* Minimalist Host Profile Header */}
        <div className="border border-line bg-white p-8 shadow-sm flex flex-col items-center text-center space-y-4">
          {host.avatar_url ? (
            <img src={host.avatar_url} alt={host.full_name} className="w-28 h-28 rounded-full object-cover border border-line shadow-xs" />
          ) : (
            <div className="w-28 h-28 rounded-full bg-ink-200 text-ink-600 flex items-center justify-center font-display text-4xl font-bold">
              {host.full_name?.[0]?.toUpperCase() || 'H'}
            </div>
          )}

          <div>
            <h1 className="font-display text-3xl font-bold text-ink mb-1">{host.full_name}</h1>
            {host.location && (
              <p className="text-xs text-ink-500 flex items-center justify-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-ink-400" /> {host.location}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 font-semibold text-ink text-xs pt-2">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>{avgRating}</span>
            <span className="text-ink-400 font-normal">({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
          </div>
        </div>

        {/* Tab Switcher: Reviews vs Past Hosted Events */}
        <div className="flex border-b border-line">
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 px-6 text-xs font-bold uppercase tracking-wide-sm transition-colors relative ${
              activeTab === 'reviews' ? 'text-ink border-b-2 border-ink' : 'text-ink-400 hover:text-ink'
            }`}
          >
            Talent Reviews ({reviews.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`pb-3 px-6 text-xs font-bold uppercase tracking-wide-sm transition-colors relative ${
              activeTab === 'events' ? 'text-ink border-b-2 border-ink' : 'text-ink-400 hover:text-ink'
            }`}
          >
            Past Hosted Events ({pastEvents.length})
          </button>
        </div>

        {/* TAB 1: Talent Provider Reviews */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="border border-line bg-white p-8 text-center space-y-1">
                <p className="text-xs text-ink-500">No reviews left by talent providers yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border border-line bg-white p-6 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {review.reviewer?.avatar_url ? (
                          <img src={review.reviewer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-line" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-ink-200 text-ink-600 flex items-center justify-center font-display font-bold text-sm">
                            {review.reviewer?.full_name?.[0]?.toUpperCase() || 'A'}
                          </div>
                        )}
                        <div>
                          <h4 className="font-display font-semibold text-ink text-sm">{review.reviewer?.full_name || 'Talent Provider'}</h4>
                          <span className="text-[10px] text-ink-400">
                            {new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${
                              star <= review.rating ? 'fill-amber-500 text-amber-500' : 'text-ink-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {review.comment && (
                      <p className="text-xs text-ink-600 italic bg-paper-100 p-3 border border-line">
                        "{review.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Past Events Gallery & Posts */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            {pastEvents.length === 0 ? (
              <div className="border border-line bg-white p-8 text-center space-y-1">
                <p className="text-xs text-ink-500">No past event records found for this host.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pastEvents.map((evt) => (
                  <div key={evt.id} className="border border-line bg-white p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 border border-purple-200 rounded-sm inline-flex items-center gap-1">
                        <PartyPopper className="w-3 h-3 text-purple-600" /> Hosted Gig
                      </span>
                      {evt.event_date && (
                        <span className="text-[10px] text-ink-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(evt.event_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>

                    <h3 className="font-display font-semibold text-ink text-base">{evt.title}</h3>

                    {/* Media Post Preview (if image or video is attached) */}
                    {evt.media_url ? (
                      evt.media_type === 'video' ? (
                        <video src={evt.media_url} controls className="w-full h-48 object-cover border border-line" />
                      ) : (
                        <img src={evt.media_url} alt={evt.title} className="w-full h-48 object-cover border border-line" />
                      )
                    ) : (
                      <div className="w-full h-32 bg-paper-100 border border-line flex items-center justify-center text-ink-400 text-xs gap-1.5">
                        <ImageIcon className="w-4 h-4" /> Event Completed
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
