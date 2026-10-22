import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { 
  MapPin, 
  Clock, 
  ArrowLeft, 
  Loader2, 
  Music2, 
  ShieldCheck, 
  Edit3, 
  ExternalLink, 
  Globe, 
  Instagram, 
  X, 
  Shield, 
  Save,
  MessageSquare,
  Star,
  Trash2
} from 'lucide-react';
import ReviewModal from '@/components/ReviewModal';

interface ServiceItem {
  id: string;
  service_name: string;
  price: number;
  duration_minutes?: number;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  booking_id?: string;
  reviewer_id?: string;
  target_artist_id?: string;
  reviewer?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface BookingModalProps {
  artistId: string;
  artistName: string;
  artistRate?: any;
  customRateDisplay?: string;
  services: ServiceItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const BookingModal: React.FC<BookingModalProps> = ({
  artistId,
  artistName,
  artistRate,
  customRateDisplay,
  services,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(1);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (services.length > 0 && !selectedServiceId) {
      setSelectedServiceId(services[0].id);
    }
  }, [services, selectedServiceId]);

  if (!isOpen) return null;

  const extractNumericRate = (): number => {
    const rawRate = parseFloat(String(artistRate));
    if (!isNaN(rawRate) && rawRate > 0) return rawRate;

    if (customRateDisplay) {
      const match = customRateDisplay.match(/\d+/);
      if (match) {
        const parsed = parseFloat(match[0]);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 0;
  };

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const baseRate = selectedService ? selectedService.price : extractNumericRate();
  const calculatedTotal = baseRate > 0 ? baseRate * (selectedService ? 1 : duration) : 0;
  const depositAmount = calculatedTotal > 0 ? calculatedTotal * 0.5 : 0;

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in to send a booking request.');

      const { error: bookingError } = await supabase.from('bookings').insert([
        {
          client_id: user.id,
          host_id: user.id,
          artist_id: artistId,
          service_id: selectedServiceId || null,
          event_date: eventDate,
          start_time: startTime,
          duration_hours: duration,
          total_price: calculatedTotal,
          deposit_amount: depositAmount,
          location,
          notes,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ]);

      if (bookingError) throw bookingError;

      alert('Booking request sent successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send booking request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-paper border border-line rounded-none max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-ink-400 hover:text-ink text-lg font-bold"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="font-display text-2xl font-bold mb-1 text-ink">Book {artistName}</h2>
        <p className="text-ink-500 text-xs mb-6">Select details to send a direct booking request.</p>

        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 text-xs">{error}</div>}

        <form onSubmit={handleSubmitBooking} className="space-y-4">
          {services.length > 0 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wide-sm font-semibold mb-1 text-ink">Select Service</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
                required
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.service_name} — R{service.price}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wide-sm font-semibold mb-1 text-ink">Date</label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide-sm font-semibold mb-1 text-ink">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wide-sm font-semibold mb-1 text-ink">Duration (Hours / Qty)</label>
              <input
                type="number"
                min="1"
                step="0.5"
                required
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value) || 1)}
                className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wide-sm font-semibold mb-1 text-ink">Estimated Total</label>
              <div className="p-2 border border-line bg-paper-200 text-xs font-bold text-ink">
                R{calculatedTotal.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="p-3 border border-line bg-paper-100 flex items-center justify-between text-xs">
            <span className="font-semibold text-ink-600">Required Deposit (50%):</span>
            <span className="font-bold text-ink">R{depositAmount.toFixed(2)}</span>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide-sm font-semibold mb-1 text-ink">Location / Venue</label>
            <input
              type="text"
              placeholder="e.g. Cape Town City Hall"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide-sm font-semibold mb-1 text-ink">Notes / Special Requests</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Share event details or setup requirements..."
              className="w-full bg-paper-100 border border-line p-2 text-xs text-ink focus:outline-none focus:border-ink"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs uppercase tracking-wide-sm font-semibold text-ink-600 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-ink text-paper text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink-800 disabled:opacity-50"
            >
              {loading ? 'Sending Request...' : 'Confirm Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function ArtistProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<any>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  const [userHostBooking, setUserHostBooking] = useState<any | null>(null);
  const [userReview, setUserReview] = useState<ReviewItem | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  useEffect(() => {
    checkCurrentUser();
    if (id) {
      fetchArtistProfile();
    }
  }, [id]);

  const checkCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      fetchUserProfileRole(user.id);
    }
  };

  const fetchUserProfileRole = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
        
      if (data) {
        setCurrentUserRole(data.role);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
    }
  };

  const fetchArtistProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('artist_profiles')
        .select('*')
        .or(`id.eq.${id},user_id.eq.${id}`)
        .single();

      if (fetchError) throw fetchError;

      let mergedArtist = { ...data };
      const profileDbId = data.id;
      const targetUserId = data.user_id || data.id;

      if (targetUserId) {
        const { data: hostData } = await supabase
          .from('host_profiles')
          .select('hourly_rate, rate_unit, custom_rate_display, pricing_type')
          .or(`user_id.eq.${targetUserId},id.eq.${targetUserId}`)
          .maybeSingle();

        if (hostData) {
          mergedArtist = {
            ...mergedArtist,
            hourly_rate: hostData.hourly_rate ?? mergedArtist.hourly_rate,
            rate_unit: hostData.rate_unit || mergedArtist.rate_unit,
            custom_rate_display: hostData.custom_rate_display || mergedArtist.custom_rate_display,
            pricing_type: hostData.pricing_type || mergedArtist.pricing_type,
          };
        }

        const { data: serviceData } = await supabase
          .from('talent_services')
          .select('*')
          .eq('profile_id', targetUserId);

        setServices(serviceData || []);

        // Fetch bookings for this artist to double-check against target_artist_id
        const { data: artistBookings } = await supabase
          .from('bookings')
          .select('id')
          .or(`artist_id.eq.${profileDbId},artist_id.eq.${targetUserId},artist_id.eq.${id}`);

        const bookingIds = (artistBookings || []).map((b) => b.id);

        // QUERY REVIEWS: Fetch reviews where target_artist_id matches OR where booking_id belongs to this artist AND target_host_id IS NULL
        let reviewQuery = supabase
          .from('reviews')
          .select(`
            id,
            rating,
            comment,
            created_at,
            booking_id,
            reviewer_id,
            target_artist_id,
            target_host_id
          `)
          .order('created_at', { ascending: false });

        if (bookingIds.length > 0) {
          reviewQuery = reviewQuery.or(
            `target_artist_id.eq.${targetUserId},target_artist_id.eq.${profileDbId},and(booking_id.in.(${bookingIds.join(',')}),target_host_id.is.null)`
          );
        } else {
          reviewQuery = reviewQuery.or(`target_artist_id.eq.${targetUserId},target_artist_id.eq.${profileDbId}`);
        }

        const { data: rawReviews, error: revErr } = await reviewQuery;

        if (!revErr && rawReviews && rawReviews.length > 0) {
          // Fetch reviewer profiles manually to avoid missing foreign key relation errors
          const reviewerIds = Array.from(new Set(rawReviews.map((r) => r.reviewer_id).filter(Boolean)));
          
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

          const processedReviews = rawReviews.map((r) => ({
            ...r,
            reviewer: reviewerMap.get(r.reviewer_id) || { full_name: 'Event Host', avatar_url: null },
          }));

          setReviews(processedReviews);
        } else {
          setReviews([]);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: hostBooking } = await supabase
            .from('bookings')
            .select('*')
            .or(`artist_id.eq.${profileDbId},artist_id.eq.${targetUserId}`)
            .or(`host_id.eq.${user.id},client_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (hostBooking) {
            setUserHostBooking(hostBooking);
          }
        }
      }

      setArtist(mergedArtist);
    } catch (err: any) {
      console.error('Error fetching artist:', err.message);
      setError('Could not load artist profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to delete your review? You will be able to submit a new one.')) return;

    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    setUserReview(null);

    try {
      const { error: deleteError } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);

      if (deleteError) {
        throw deleteError;
      }

      alert('Review removed successfully.');
      fetchArtistProfile();
    } catch (err: any) {
      console.error('Delete review error:', err);
      alert(err.message || 'Failed to delete review.');
      fetchArtistProfile();
    }
  };

  const renderPricingBadge = () => {
    if (!artist) return 'Rate on Request';
    if (artist.custom_rate_display && artist.custom_rate_display.trim() !== '') {
      return artist.custom_rate_display.trim();
    }

    const rawRate = artist.hourly_rate ?? artist.base_rate ?? artist.rate ?? artist.price;
    const numericRate = parseFloat(String(rawRate));

    if (!isNaN(numericRate) && numericRate > 0) {
      const unit = String(artist.rate_unit || 'hr').trim();
      return `R${numericRate} / ${unit}`;
    }

    if (services.length > 0) return 'See Services Menu';
    return 'Rate on Request';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ink-400" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen bg-paper py-20 px-6 text-center">
        <Music2 className="w-12 h-12 text-ink-300 mx-auto mb-4" />
        <h2 className="font-display text-2xl font-bold text-ink">Artist Not Found</h2>
        <p className="text-sm text-ink-500 mt-2">The profile you are looking for does not exist or has been removed.</p>
        <Link to="/artists" className="inline-block mt-6 px-6 py-2.5 bg-ink text-paper text-xs uppercase tracking-wide-sm font-semibold">
          Back to Directory
        </Link>
      </div>
    );
  }

  const targetAuthId = artist.user_id || artist.id;
  const isOwner = currentUserId && targetAuthId === currentUserId;
  const isVerified = artist.is_verified || artist.verification_status === 'verified';
  const rating = artist.rating || (reviews.length > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 0);
  const reviewCount = artist.review_count || reviews.length;

  const galleryImages: string[] = Array.isArray(artist.gallery_urls) && artist.gallery_urls.length > 0
    ? artist.gallery_urls
    : Array.isArray(artist.gallery) && artist.gallery.length > 0
    ? artist.gallery
    : Array.isArray(artist.portfolio_urls) && artist.portfolio_urls.length > 0
    ? artist.portfolio_urls
    : Array.isArray(artist.media_urls) && artist.media_urls.length > 0
    ? artist.media_urls
    : [];

  return (
    <div className="min-h-screen bg-paper py-12 px-6 lg:px-12">
      <div className="max-w-6xl mx-auto">
        <Link to="/artists" className="inline-flex items-center gap-2 text-xs uppercase tracking-wide-sm text-ink-500 hover:text-ink mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Browse
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <div className="aspect-[16/9] bg-paper-200 border border-line overflow-hidden relative">
              {artist.cover_url || artist.avatar_url ? (
                <img
                  src={artist.cover_url || artist.avatar_url}
                  alt={artist.stage_name || 'Artist Image'}
                  className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => setActiveImage(artist.cover_url || artist.avatar_url)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink-400">
                  <Music2 className="w-12 h-12" />
                </div>
              )}

              {isVerified && (
                <div className="absolute top-4 left-4 bg-emerald-700 text-white text-xs uppercase font-bold px-3 py-1 flex items-center gap-1.5 shadow-md">
                  <ShieldCheck className="w-4 h-4" /> Verified Creator
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="font-display text-3xl font-bold text-ink">{artist.stage_name || 'Unnamed Artist'}</h1>
                  </div>

                  <p className="text-xs text-ink-500 mt-2 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {artist.location_city ? `${artist.location_city}, ${artist.location_province || 'ZA'}` : artist.location || 'Location not specified'}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="text-xl font-bold text-ink">{renderPricingBadge()}</div>
                  {reviewCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-ink bg-paper-100 border border-line px-2.5 py-1">
                      <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                      <span>{Number(rating).toFixed(1)}</span>
                      <span className="text-ink-400 font-normal">({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})</span>
                    </div>
                  )}
                </div>
              </div>

              {artist.categories && artist.categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {artist.categories.map((cat: string) => (
                    <span key={cat} className="text-[10px] uppercase tracking-wide-sm bg-paper-200 border border-line px-2.5 py-1 text-ink-600 font-medium">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-line pt-6">
              <h3 className="font-display text-lg font-bold text-ink mb-3">About</h3>
              <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-line">
                {artist.bio || 'No biography provided yet.'}
              </p>
            </div>

            {services.length > 0 && (
              <div className="border-t border-line pt-6">
                <h3 className="font-display text-lg font-bold text-ink mb-4">Services & Rates Menu</h3>
                <div className="divide-y divide-line border border-line bg-paper-100">
                  {services.map((service) => (
                    <div key={service.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink">{service.service_name}</p>
                        {service.duration_minutes && (
                          <p className="text-xs text-ink-500 mt-0.5">Est. Duration: {service.duration_minutes} mins</p>
                        )}
                      </div>
                      <p className="font-bold text-ink text-base">R{service.price}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {galleryImages.length > 0 && (
              <div className="border-t border-line pt-8">
                <h3 className="font-display text-lg font-bold text-ink mb-4">Portfolio Gallery</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {galleryImages.map((url: string, index: number) => (
                    <div 
                      key={index} 
                      className="aspect-square bg-paper-200 border border-line overflow-hidden rounded-xs cursor-pointer group relative"
                      onClick={() => setActiveImage(url)}
                    >
                      <img 
                        src={url} 
                        alt={`Portfolio item ${index + 1}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-line pt-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-display text-xl font-bold text-ink">Host Reviews & Feedback</h3>
                  <p className="text-xs text-ink-500 mt-0.5">Verified feedback from past event hosts</p>
                </div>

                <div className="flex items-center gap-3">
                  {userHostBooking && !isOwner && (
                    <button
                      type="button"
                      onClick={() => setIsReviewModalOpen(true)}
                      className="px-3.5 py-1.5 bg-ink text-paper text-xs uppercase font-semibold tracking-wide-sm border border-ink hover:bg-ink/90 flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{userReview ? '★ Edit My Review' : '★ Leave Review'}</span>
                    </button>
                  )}

                  {reviewCount > 0 && (
                    <div className="flex items-center gap-1.5 text-sm font-bold text-ink bg-paper-100 border border-line px-3 py-1.5">
                      <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                      <span>{Number(rating).toFixed(1)} / 5.0</span>
                      <span className="text-ink-400 font-normal text-xs">({reviewCount})</span>
                    </div>
                  )}
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className="border border-dashed border-line p-8 text-center bg-paper-100 space-y-3">
                  <Star className="w-8 h-8 text-ink-300 mx-auto" />
                  <div>
                    <p className="text-xs text-ink-500 font-medium">No reviews submitted yet for this artist.</p>
                    <p className="text-[11px] text-ink-400 mt-0.5">Completed gigs allow hosts to submit ratings and feedback.</p>
                  </div>
                  {userHostBooking && !isOwner && (
                    <button
                      type="button"
                      onClick={() => setIsReviewModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-paper text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink/90 mt-2"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Leave First Review
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="border border-line bg-paper-100 p-5 space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {rev.reviewer?.avatar_url ? (
                            <img src={rev.reviewer.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-line" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-xs">
                              {rev.reviewer?.full_name?.[0]?.toUpperCase() || 'H'}
                            </div>
                          )}
                          <div>
                            <h4 className="font-display font-semibold text-ink text-sm flex items-center gap-2">
                              <span>{rev.reviewer?.full_name || 'Event Host'}</span>
                              {rev.reviewer_id === currentUserId && (
                                <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">You</span>
                              )}
                            </h4>
                            <p className="text-[10px] text-ink-400">
                              {new Date(rev.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3.5 h-3.5 ${
                                  star <= rev.rating
                                    ? 'fill-amber-500 text-amber-500'
                                    : 'text-ink-300'
                                }`}
                              />
                            ))}
                          </div>

                          {rev.reviewer_id === currentUserId && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReview(rev.id)}
                              title="Delete Review"
                              className="p-1.5 text-ink-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {rev.comment && (
                        <p className="text-xs text-ink-600 leading-relaxed bg-paper p-3 border border-line">
                          "{rev.comment}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-line bg-paper-100 p-6 space-y-6 sticky top-6">
              <h3 className="font-display text-lg font-bold text-ink">
                {isOwner ? 'Your Artist Profile' : `Book ${artist.stage_name || 'Artist'}`}
              </h3>
              
              <div className="space-y-3 text-xs text-ink-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-ink-400" />
                  <span>Rate: {renderPricingBadge()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Verified HostMeUp Creator</span>
                </div>
                {reviewCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                    <span>{Number(rating).toFixed(1)} Star Rating ({reviewCount} reviews)</span>
                  </div>
                )}
              </div>

              {isOwner ? (
                <Link
                  to="/artist-profile/edit"
                  className="w-full text-center flex items-center justify-center gap-2 py-3 bg-paper border border-ink text-ink text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink hover:text-paper transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </Link>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsBookingModalOpen(true)}
                    className="w-full text-center flex items-center justify-center gap-2 py-3 bg-ink text-paper text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink-800 transition-colors"
                  >
                    Request Booking
                  </button>

                  <Link
                    to={`/inbox/${targetAuthId}`}
                    className="w-full text-center flex items-center justify-center gap-2 py-2.5 border border-ink text-ink text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink hover:text-paper transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Start Conversation
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        artistId={targetAuthId}
        artistName={artist.stage_name || 'Artist'}
        artistRate={artist.hourly_rate}
        customRateDisplay={artist.custom_rate_display}
        services={services}
      />

      {userHostBooking && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          bookingId={userHostBooking.id}
          artistId={targetAuthId}
          artistName={artist.stage_name || 'Artist'}
          onSuccess={() => fetchArtistProfile()}
        />
      )}

      {activeImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setActiveImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setActiveImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={activeImage} 
              alt="Enlarged view" 
              className="max-w-full max-h-[85vh] object-contain border border-line"
            />
          </div>
        </div>
      )}
    </div>
  );
}
