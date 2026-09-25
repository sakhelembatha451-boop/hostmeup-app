import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  Save 
} from 'lucide-react';

export default function ArtistProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
    } catch (err: any) {
      console.error('Error fetching artist:', err.message);
      setError('Could not load artist profile.');
    } fontFinally: {
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

  const isOwner = currentUserId && artist.user_id && currentUserId === artist.user_id;

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
            {/* Main Cover / Avatar */}
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
                  R{artist.hourly_rate || 0}<span className="text-xs font-normal text-ink-500">/hr</span>
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

            {/* About / Bio */}
            <div className="border-t border-line pt-6">
              <h3 className="font-display text-lg font-bold text-ink mb-3">About</h3>
              <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-line">
                {artist.bio || 'No biography provided yet.'}
              </p>
            </div>

            {/* Gallery Photos */}
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

            {/* Embedded Audio / Video Link */}
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

            {/* Social & Streaming Links */}
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
                {isOwner ? 'Your Artist Profile' : `Book ${artist.stage_name || 'Artist'}`}
              </h3>
              
              <div className="space-y-3 text-xs text-ink-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-ink-400" />
                  <span>Rate: R{artist.hourly_rate || 0} per hour</span>
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
              ) : (
                <Link
                  to={`/booking/${artist.id}`}
                  className="w-full text-center block py-3 bg-ink text-paper text-xs uppercase tracking-wide-sm font-semibold hover:bg-ink-800 transition-colors"
                >
                  Request Booking
                </Link>
              )}
            </div>

            {/* Emergency Safety Protocols Form (Visible to Owner) */}
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

            {/* Links & Socials Sidebar Panel */}
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
