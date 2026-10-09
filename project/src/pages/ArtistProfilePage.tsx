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
  Calendar
} from 'lucide-react';

interface ServiceItem {
  id: string;
  service_name: string;
  price: number;
  duration_minutes?: number;
}

interface BookingModalProps {
  artistId: string;
  artistName: string;
  services: ServiceItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/* -------------------------------------------------------------------------- */
/*                                BOOKING MODAL                               */
/* -------------------------------------------------------------------------- */
const BookingModal: React.FC<BookingModalProps> = ({
  artistId,
  artistName,
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

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const calculatedTotal = selectedService ? selectedService.price * duration : 0;

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
          artist_id: artistId,
          service_id: selectedServiceId || null,
          event_date: eventDate,
          start_time: startTime,
          duration_hours: duration,
          total_price: calculatedTotal,
          location,
          notes,
          status: 'pending',
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
              <label className="block text-[10px] uppercase tracking-wide-sm font-semibold mb-1 text-ink">Duration (Hours)</label>
              <input
                type="number"
                min="0.5"
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

/* -------------------------------------------------------------------------- */
/*                             MAIN PAGE COMPONENT                             */
/* -------------------------------------------------------------------------- */
export default function ArtistProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<any>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for Booking Modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // State for image lightbox modal
  const [activeImage, setActiveImage] = useState<string | null>(null);

  // Emergency Contact State
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [savingEmergency, setSavingEmergency] = useState(false);
  const [emergencyMessage, setEmergencyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      fetchEmergencyContact(user.id);
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

  const fetchEmergencyContact = async (userId: string) => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('emergency_contact_name, emergency_contact_phone, emergency_contact_relationship')
        .eq('id', userId)
        .single();

      if (fetchErr && fetchErr.code !== 'PGRST116') {
        console.error('Error fetching emergency details:', fetchErr.message);
        return;
      }

      if (data) {
        setEmergencyName(data.emergency_contact_name || '');
        setEmergencyPhone(data.emergency_contact_phone || '');
        setEmergencyRelationship(data.emergency_contact_relationship || '');
      }
    } catch (err: any) {
      console.error('Error in fetchEmergencyContact:', err.message);
    }
  };

  const fetchArtistProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('artist_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      setArtist(data);

      if (data && (data.pricing_type === 'per_service' || data.categories?.includes('Beauty Professional'))) {
        const { data: serviceData } = await supabase
          .from('talent_services')
          .select('*')
          .eq('profile_id', data.user_id || data.id);

        setServices(serviceData || []);
      }
    } catch (err: any) {
      console.error('Error fetching artist:', err.message);
      setError('Could not load artist profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmergencyContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    try {
      setSavingEmergency(true);
      setEmergencyMessage(null);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone,
          emergency_contact_relationship: emergencyRelationship
        })
        .eq('id', currentUserId);

      if (updateError) throw updateError;

      setEmergencyMessage({ type: 'success', text: 'Emergency contact updated successfully.' });
    } catch (err: any) {
      console.error('Error updating emergency contact:', err.message);
      setEmergencyMessage({ type: 'error', text: 'Failed to save emergency contact.' });
    } finally {
      setSavingEmergency(false);
    }
  };

  const handleContactUser = async () => {
    if (!currentUserId || !artist) return;

    const targetUserId = artist.user_id || artist.id;

    const { data: convData } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${currentUserId},participant_2.eq.${targetUserId}),and(participant_1.eq.${targetUserId},participant_2.eq.${currentUserId})`)
      .maybeSingle();

    if (convData?.id) {
      navigate(`/admin/inbox?conversation=${convData.id}`);
    } else {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          participant_1: currentUserId,
          participant_2: targetUserId,
        })
        .select('id')
        .single();

      if (newConv) {
        navigate(`/admin/inbox?conversation=${newConv.id}`);
      } else {
        navigate('/admin/inbox');
      }
    }
  };

  // Dynamic Rate Rendering across Creator Categories
  const renderPricingBadge = () => {
    if (!artist) return 'Rate on Request';

    if (artist.pricing_type === 'per_service' || artist.categories?.includes('Beauty Professional')) {
      if (services.length > 0) return 'See Services Menu';
    }

    const rawRate = artist.hourly_rate ?? artist.base_rate ?? artist.rate;
    const numericRate = parseFloat(rawRate);

    if (isNaN(numericRate) || numericRate <= 0) {
      return 'Rate on Request';
    }

    const unit = (artist.rate_unit || artist.pricing_unit || 'hr').trim();
    return `R${numericRate} / ${unit}`;
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

  const isOwner = currentUserId && (artist.user_id === currentUserId || artist.id === currentUserId);
  const isAdmin = currentUserRole === 'admin';

  const galleryImages: string[] = Array.isArray(artist.gallery_urls) && artist.gallery_urls.length > 0
    ? artist.gallery_urls
    : Array.isArray(artist.gallery) && artist.gallery.length > 0
    ? artist.gallery
    : Array.isArray(artist.portfolio_urls) && artist.portfolio_urls.length > 0
    ? artist.portfolio_urls
    : Array.isArray(artist.media_urls)
    ? artist.media_urls
    : [];

  const instagram = artist.social_links?.instagram || artist.instagram || artist.instagram_url;
  const spotify = artist.social_links?.spotify || artist.spotify || artist.spotify_url;
  const soundcloud = artist.social_links?.soundcloud || artist.soundcloud || artist.soundcloud_url;
  const youtube = artist.social_links?.youtube || artist.youtube || artist.youtube_url;

  return (
    <div className="min-h-screen bg-paper py-12 px-6 lg:px-12">
      <div className="max-w-6xl mx-auto">
        <Link to="/artists" className="inline-flex items-center gap-2 text-xs uppercase tracking-wide-sm text-ink-500 hover:text-ink mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Browse
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content Area */}
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
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h1 className="font-display text-3xl font-bold text-ink">{artist.stage_name || 'Unnamed Artist'}</h1>
                <div className="text-xl font-bold text-ink">
                  {renderPricingBadge()}
                </div>
              </div>

              <p className="text-xs text-ink-500 mt-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {artist.location_city ? `${artist.location_city}, ${artist.location_province || 'ZA'}` : 'Location not specified'}
              </p>

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

            {(artist.pricing_type === 'per_service' || artist.categories?.includes('Beauty Professional')) && services.length > 0 && (
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
              <div className="border-t border-line pt-6">
                <h3 className="font-display text-lg font-bold text-ink mb-4">Gallery & Portfolio</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {galleryImages.map((url: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImage(url)}
                      className="aspect-square bg-paper-200 border border-line overflow-hidden group focus:outline-none focus:ring-2 focus:ring-ink"
                    >
                      <img
                        src={url}
                        alt={`Gallery item ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {artist.demo_url && (
              <div className="border-t border-line pt-6">
                <h3 className="font-display text-lg font-bold text-ink mb-3">Demo Reel / Track</h3>
                <a
                  href={artist.demo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide-sm text-ink underline hover:text-ink-600"
                >
                  <ExternalLink className="w-4 h-4" />
                  Listen / Watch Demo Reel
                </a>
              </div>
            )}

            {(instagram || spotify || soundcloud || youtube) && (
              <div className="space-y-4 pt-6 border-t border-line">
                <h3 className="text-xs uppercase tracking-wide-sm font-semibold text-ink-500">
                  Social & Streaming Media
                </h3>
                <div className="flex flex-wrap gap-4">
                  {spotify && (
                    <a
                      href={spotify.startsWith('http') ? spotify : `https://${spotify}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-line hover:border-ink text-xs uppercase tracking-wide-sm font-medium transition-colors flex items-center gap-2"
                    >
                      Spotify
                    </a>
                  )}
                  {instagram && (
                    <a
                      href={instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-line hover:border-ink text-xs uppercase tracking-wide-sm font-medium transition-colors flex items-center gap-2"
                    >
                      Instagram
                    </a>
                  )}
                  {soundcloud && (
                    <a
                      href={soundcloud.startsWith('http') ? soundcloud : `https://${soundcloud}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-line hover:border-ink text-xs uppercase tracking-wide-sm font-medium transition-colors flex items-center gap-2"
                    >
                      SoundCloud
                    </a>
                  )}
                  {youtube && (
                    <a
                      href={youtube.startsWith('http') ? youtube : `https://${youtube}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-line hover:border-ink text-xs uppercase tracking-wide-sm font-medium transition-colors flex items-center gap-2"
                    >
                      YouTube
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="border border-line bg-paper-100 p-6 space-y-6">
              <h3 className="font-display text-lg font-bold text-ink">
                {isOwner 
                  ? 'Your Artist Profile' 
                  : isAdmin 
                  ? `Contact ${artist.stage_name || 'User'}` 
                  : `Book ${artist.stage_name || 'Artist'}`}
              </h3>
              
              <div className="space-y-3 text-xs text-ink-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-ink-400" />
                  <span>Rate: {renderPricingBadge()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-ink-400" />
                  <span>Verified HostMeUp Creator</span>
                </div>
              </div>

              {isOwner ? (
                <Link
                  to="/artist-profile/edit"
                  className="w-full text-center flex items-center justify-center gap-2 py-3 bg-paper border border-ink text-ink text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink hover:text-paper transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </Link>
              ) : isAdmin ? (
                <button
                  type="button"
                  onClick={handleContactUser}
                  className="w-full text-center flex items-center justify-center gap-2 py-3 bg-ink text-paper text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink-800 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Contact User
                </button>
              ) : (
                <div className="space-y-3">
                  {/* Primary Action: Request Booking */}
                  <button
                    type="button"
                    onClick={() => setIsBookingModalOpen(true)}
                    className="w-full text-center flex items-center justify-center gap-2 py-3 bg-ink text-paper text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink-800 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    Request Booking
                  </button>

                  {/* Direct Messaging Action for Hosts / Users */}
                  <Link
                    to={`/inbox/${artist.user_id || artist.id}`}
                    className="w-full text-center flex items-center justify-center gap-2 py-2.5 border border-ink text-ink text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink hover:text-paper transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Start Conversation
                  </Link>
                </div>
              )}
            </div>

            {isOwner && (
              <div className="border border-line bg-paper p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-line pb-3">
                  <Shield className="w-4 h-4 text-ink" />
                  <h4 className="text-xs uppercase tracking-wide-sm font-bold text-ink">Emergency Contact Details</h4>
                </div>
                
                <form onSubmit={handleSaveEmergencyContact} className="space-y-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide-sm text-ink-500 mb-1 font-semibold">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="e.g. Sibusiso Mbatha"
                      className="w-full bg-paper-100 border border-line px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wide-sm text-ink-500 mb-1 font-semibold">
                      Contact Phone (WhatsApp)
                    </label>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="e.g. +27 82 123 4567"
                      className="w-full bg-paper-100 border border-line px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wide-sm text-ink-500 mb-1 font-semibold">
                      Relationship
                    </label>
                    <input
                      type="text"
                      value={emergencyRelationship}
                      onChange={(e) => setEmergencyRelationship(e.target.value)}
                      placeholder="e.g. Parent / Spouse / Manager"
                      className="w-full bg-paper-100 border border-line px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
                    />
                  </div>

                  {emergencyMessage && (
                    <p className={`text-[11px] font-medium ${emergencyMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {emergencyMessage.text}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={savingEmergency}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-ink text-paper text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink-800 disabled:opacity-50 transition-colors"
                  >
                    {savingEmergency ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {savingEmergency ? 'Saving...' : 'Save Safety Contact'}
                  </button>
                </form>
              </div>
            )}

            {(artist.website_url || artist.instagram_url) && (
              <div className="border border-line bg-paper p-6 space-y-3">
                <h4 className="text-xs uppercase tracking-wide-sm font-bold text-ink mb-2">Links & Socials</h4>
                {artist.website_url && (
                  <a href={artist.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-ink-600 hover:text-ink">
                    <Globe className="w-4 h-4 text-ink-400" /> Website
                  </a>
                )}
                {artist.instagram_url && (
                  <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-ink-600 hover:text-ink">
                    <Instagram className="w-4 h-4 text-ink-400" /> Instagram
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Render Booking Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        artistId={artist.user_id || artist.id}
        artistName={artist.stage_name || 'Artist'}
        services={services}
      />

      {/* Fullscreen Lightbox Modal */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setActiveImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              className="absolute top-3 right-3 bg-ink text-paper p-2 hover:bg-ink-800 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={activeImage}
              alt="Expanded view"
              className="w-full h-full object-contain max-h-[85vh]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
