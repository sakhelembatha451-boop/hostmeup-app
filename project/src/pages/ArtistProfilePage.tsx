import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { MapPin, Music, DollarSign, ExternalLink, Loader2, ArrowLeft, Calendar, Disc, Instagram, Youtube, ImageIcon, PlayCircle, Headphones } from 'lucide-react';
import type { ArtistWithProfile, MediaItem, MediaType } from '@/types';
import { CATEGORY_ICONS, CATEGORY_LABELS, MEDIA_TYPE_LABELS } from '@/lib/categories';
import { Tag } from '@/components/UI';

export default function ArtistProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { profile, session } = useAuth();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<ArtistWithProfile | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MediaType>('photo');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`*, artist_profile:artist_profiles(*)`)
        .eq('id', id)
        .maybeSingle();
      if (error || !data) { setArtist(null); }
      else {
        const a = data as ArtistWithProfile;
        setArtist(a);
        if (a.artist_profile) {
          const { data: media } = await supabase
            .from('media_items')
            .select('*')
            .eq('artist_profile_id', a.artist_profile.id)
            .order('display_order', { ascending: true });
          if (media) {
            setMediaItems(media as MediaItem[]);
            const types = (media as MediaItem[]).map((m) => m.media_type);
            if (types.includes('photo')) setActiveTab('photo');
            else if (types.includes('video')) setActiveTab('video');
            else if (types.includes('audio')) setActiveTab('audio');
          }
        }
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  if (!artist || !artist.artist_profile) {
    return <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h2 className="font-display text-2xl text-ink mb-2">Talent not found</h2>
      <Link to="/artists" aria-label="Back to talent directory" className="text-sm font-medium text-accent hover:text-accent-600">Back to directory</Link>
    </div>;
  }

  const ap = artist.artist_profile;
  const isOwnProfile = profile?.id === artist.id;
  const canBook = session && profile?.role === 'host';
  const CatIcon = CATEGORY_ICONS[ap.talent_category];

  const socialLinks = [
    { url: ap.spotify_url, label: 'Spotify', icon: <Music className="w-4 h-4" /> },
    { url: ap.instagram_url, label: 'Instagram', icon: <Instagram className="w-4 h-4" /> },
    { url: ap.soundcloud_url, label: 'SoundCloud', icon: <Disc className="w-4 h-4" /> },
    { url: ap.youtube_url, label: 'YouTube', icon: <Youtube className="w-4 h-4" /> },
    { url: ap.website_url, label: 'Website', icon: <ExternalLink className="w-4 h-4" /> },
  ].filter((s) => s.url);

  const mediaByType: Record<MediaType, MediaItem[]> = {
    photo: mediaItems.filter((m) => m.media_type === 'photo'),
    audio: mediaItems.filter((m) => m.media_type === 'audio'),
    video: mediaItems.filter((m) => m.media_type === 'video'),
  };
  const availableTabs = (['photo', 'audio', 'video'] as MediaType[]).filter((t) => mediaByType[t].length > 0);

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-editorial mx-auto px-6 lg:px-12 py-8">
        <Link to="/artists" aria-label="Back to talent directory" className="inline-flex items-center gap-2 text-xs font-medium text-ink-400 hover:text-ink uppercase tracking-wide-sm mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Directory
        </Link>

        {/* Hero — full-bleed cover */}
        <div className="relative overflow-hidden bg-paper-300 mb-0 h-72 sm:h-96 lg:h-[480px]">
          {ap.media_urls?.[0] ? (
            <img src={ap.media_urls[0]} alt={`Cover photo of ${ap?.stage_name || artist?.full_name || 'talent'}`} width={1200} height={480} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">{CatIcon ? <CatIcon className="w-16 h-16 text-ink-200" /> : null}</div>
          )}
        </div>

        {/* Profile header — below cover */}
        <div className="border-b border-line py-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex items-end gap-6">
              {artist.avatar_url ? (
                <img src={artist.avatar_url} alt={`Profile photo of ${artist?.full_name || 'talent'}`} width={96} height={96} className="w-24 h-24 rounded-full object-cover border border-line flex-shrink-0" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-ink text-paper flex items-center justify-center font-display text-3xl font-bold flex-shrink-0">
                  {artist.full_name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div>
                {ap && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-line text-xs font-medium uppercase tracking-wide-sm text-ink-500 mb-3">
                    {CatIcon && <CatIcon className="w-3 h-3" />}
                    {CATEGORY_LABELS[ap.talent_category]}
                  </div>
                )}
                <h1 className="font-display text-4xl lg:text-5xl font-bold text-ink leading-tight">
                  {ap.stage_name || artist.full_name}
                </h1>
                {ap.stage_name && artist.full_name && <p className="text-sm text-ink-400 mt-1">{artist.full_name}</p>}
                {artist.location && <p className="text-sm text-ink-500 mt-2 flex items-center gap-1"><MapPin className="w-4 h-4" />{artist.location}</p>}
              </div>
            </div>

            <div className="flex-shrink-0">
              {isOwnProfile ? (
                <Link to="/artist-profile/edit" aria-label="Edit your profile" className="btn-outline px-6 py-3 text-xs uppercase tracking-wide-sm">Edit Profile</Link>
              ) : canBook ? (
                <button onClick={() => navigate(`/book/${artist.id}`)} className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-xs uppercase tracking-wide-sm">
                  <Calendar className="w-4 h-4" /> Book This Talent
                </button>
              ) : !session ? (
                <Link to="/signup" aria-label="Sign up to book this talent" className="btn-primary inline-flex items-center gap-2 px-6 py-3.5 text-xs uppercase tracking-wide-sm">Sign up to book</Link>
              ) : null}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mt-10 pt-8 border-t border-line">
            {ap.base_rate != null && (
              <div>
                <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Base Rate</p>
                <p className="font-display text-2xl font-semibold text-ink">${ap.base_rate}<span className="text-base text-ink-300 font-normal">/{ap.rate_unit}</span></p>
              </div>
            )}
            {ap.performance_roles && ap.performance_roles.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Specialties</p>
                <p className="text-sm font-medium text-ink">{ap.performance_roles.join(', ')}</p>
              </div>
            )}
            {ap.genres && ap.genres.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Styles</p>
                <p className="text-sm font-medium text-ink">{ap.genres.join(', ')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {artist.bio && (
          <div className="border-b border-line py-10">
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-4">— About</p>
            <p className="text-lg text-ink-600 leading-relaxed max-w-2xl">{artist.bio}</p>
          </div>
        )}

        {/* Tags */}
        {(ap.performance_roles?.length || ap.genres?.length) ? (
          <div className="border-b border-line py-6 flex flex-wrap gap-2">
            {[...ap.performance_roles, ...ap.genres].map((tag) => <Tag key={tag} label={tag} />)}
          </div>
        ) : null}

        {/* Social links */}
        {socialLinks.length > 0 && (
          <div className="border-b border-line py-6 flex flex-wrap gap-3">
            {socialLinks.map((s) => (
              <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${s.label} profile (opens in a new tab)`}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-line text-sm font-medium text-ink-600 hover:border-ink hover:bg-ink hover:text-paper transition-all rounded-none">
                {s.icon} {s.label} <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            ))}
          </div>
        )}

        {/* Portfolio with tabs */}
        {availableTabs.length > 0 && (
          <div className="py-10">
            <div className="flex items-center justify-between mb-8">
              <p className="text-xs uppercase tracking-wide-sm text-ink-400">— Portfolio</p>
              <div className="flex gap-0 border border-line">
                {availableTabs.map((tab) => {
                  const Icon = tab === 'photo' ? ImageIcon : tab === 'audio' ? Headphones : PlayCircle;
                  return (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium uppercase tracking-wide-sm transition-all ${
                        activeTab === tab ? 'bg-ink text-paper' : 'text-ink-500 hover:bg-paper-200'
                      } ${availableTabs.indexOf(tab) > 0 ? 'border-l border-line' : ''}`}>
                      <Icon className="w-3.5 h-3.5" /> {MEDIA_TYPE_LABELS[tab]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Photo grid */}
            {activeTab === 'photo' && mediaByType.photo.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {mediaByType.photo.map((item) => (
                  <div key={item.id} className="group relative overflow-hidden bg-paper-300 aspect-square border border-line">
                    <img src={item.url} alt={item.title || `Portfolio photo by ${ap?.stage_name || artist?.full_name || 'artist'}`} width={400} height={400} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    {item.title && <div className="absolute bottom-0 left-0 right-0 bg-paper/90 backdrop-blur-sm text-ink text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">{item.title}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Audio */}
            {activeTab === 'audio' && mediaByType.audio.length > 0 && (
              <div className="space-y-3">
                {mediaByType.audio.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 border border-line">
                    <Headphones className="w-5 h-5 text-accent flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{item.title || 'Untitled Track'}</div>
                      <audio controls className="w-full mt-2 h-8" src={item.url} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Video */}
            {activeTab === 'video' && mediaByType.video.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mediaByType.video.map((item) => (
                  <div key={item.id} className="overflow-hidden border border-line">
                    <video controls className="w-full aspect-video bg-black" src={item.url} />
                    {item.title && <div className="px-3 py-2 text-sm font-medium text-ink border-t border-line">{item.title}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legacy fallback */}
        {availableTabs.length === 0 && ap.media_urls && ap.media_urls.length > 1 && (
          <div className="py-10">
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-6">— Portfolio</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {ap.media_urls.map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden border border-line">
                  <img src={url} alt={`Portfolio photo ${i + 1} of ${ap?.stage_name || artist?.full_name || 'artist'}`} width={400} height={400} loading="lazy" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
