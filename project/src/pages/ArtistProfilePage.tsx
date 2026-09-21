import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { MapPin, Clock, ArrowLeft, Loader2, Music2, ShieldCheck, Edit3, ExternalLink, Globe, Instagram, Youtube, Twitter } from 'lucide-react';

export default function ArtistProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [artist, setArtist] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } finally {
      setLoading(false);
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
                  alt={artist.stage_name}
                  className="w-full h-full object-cover"
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

            {/* Media & Portfolio Gallery */}
            {(artist.portfolio_urls?.length > 0 || artist.media_urls?.length > 0 || artist.gallery?.length > 0) && (
              <div className="border-t border-line pt-6">
                <h3 className="font-display text-lg font-bold text-ink mb-4">Portfolio & Media</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {(artist.portfolio_urls || artist.media_urls || artist.gallery || []).map((url: string, idx: number) => (
                    <div key={idx} className="aspect-square bg-paper-200 border border-line overflow-hidden group">
                      <img
                        src={url}
                        alt={`Portfolio item ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
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

            {/* Social / External Links */}
            {(artist.social_links || artist.website_url || artist.instagram_url) && (
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
    </div>
  );
}
