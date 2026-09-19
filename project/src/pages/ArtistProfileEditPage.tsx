import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Save, X, Plus, AlertCircle, CheckCircle2, Headphones, PlayCircle, ImageIcon, Trash2 } from 'lucide-react';
import type { ArtistProfile, MediaItem, MediaType, TalentCategory } from '@/types';
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_LIST, CATEGORY_MEDIA_HINTS, CATEGORY_ROLES, CATEGORY_STYLES, MEDIA_TYPE_LABELS } from '@/lib/categories';

export default function ArtistProfileEditPage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [talentCategory, setTalentCategory] = useState<TalentCategory>('performer_dj');
  const [stageName, setStageName] = useState('');
  const [performanceRoles, setPerformanceRoles] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [baseRate, setBaseRate] = useState('');
  const [rateUnit, setRateUnit] = useState('hour');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [soundcloudUrl, setSoundcloudUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [newMediaUrlTyped, setNewMediaUrlTyped] = useState('');
  const [newMediaTitle, setNewMediaTitle] = useState('');
  const [newMediaType, setNewMediaType] = useState<MediaType>('photo');
  const [artistProfileId, setArtistProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || ''); setBio(profile.bio || ''); setLocation(profile.location || ''); setAvatarUrl(profile.avatar_url || '');
    (async () => {
      const { data } = await supabase.from('artist_profiles').select('*').eq('user_id', profile.id).maybeSingle();
      if (data) {
        const ap = data as ArtistProfile;
        setArtistProfileId(ap.id); setTalentCategory(ap.talent_category || 'performer_dj'); setStageName(ap.stage_name || '');
        setPerformanceRoles(ap.performance_roles || []); setGenres(ap.genres || []); setBaseRate(ap.base_rate?.toString() || '');
        setRateUnit(ap.rate_unit || 'hour'); setSpotifyUrl(ap.spotify_url || ''); setInstagramUrl(ap.instagram_url || '');
        setSoundcloudUrl(ap.soundcloud_url || ''); setYoutubeUrl(ap.youtube_url || ''); setWebsiteUrl(ap.website_url || '');
        setMediaUrls(ap.media_urls || []);
        const { data: mediaData } = await supabase.from('media_items').select('*').eq('artist_profile_id', ap.id).order('display_order', { ascending: true });
        if (mediaData) setMediaItems(mediaData as MediaItem[]);
      }
      setLoading(false);
    })();
  }, [profile]);

  const toggleArrayValue = (arr: string[], val: string, setter: (v: string[]) => void) => setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  const addMediaUrl = () => { if (newMediaUrl.trim()) { setMediaUrls([...mediaUrls, newMediaUrl.trim()]); setNewMediaUrl(''); } };
  const removeMediaUrl = (idx: number) => setMediaUrls(mediaUrls.filter((_, i) => i !== idx));

  const addMediaItem = async () => {
    if (!newMediaUrlTyped.trim() || !artistProfileId) return;
    const { data, error } = await supabase.from('media_items').insert({ artist_profile_id: artistProfileId, media_type: newMediaType, url: newMediaUrlTyped.trim(), title: newMediaTitle.trim(), display_order: mediaItems.length }).select('*').single();
    if (!error && data) { setMediaItems([...mediaItems, data as MediaItem]); setNewMediaUrlTyped(''); setNewMediaTitle(''); }
  };
  const deleteMediaItem = async (id: string) => { await supabase.from('media_items').delete().eq('id', id); setMediaItems(mediaItems.filter((m) => m.id !== id)); };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true); setError(''); setSuccess(false);
    const { error: pErr } = await supabase.from('profiles').update({ full_name: fullName, bio, location, avatar_url: avatarUrl || null, updated_at: new Date().toISOString() }).eq('id', profile.id);
    if (pErr) { setError(pErr.message); setSaving(false); return; }
    const { error: aErr } = await supabase.from('artist_profiles').upsert({ user_id: profile.id, talent_category: talentCategory, stage_name: stageName, performance_roles: performanceRoles, genres, base_rate: baseRate ? parseFloat(baseRate) : null, rate_unit: rateUnit, spotify_url: spotifyUrl || null, instagram_url: instagramUrl || null, soundcloud_url: soundcloudUrl || null, youtube_url: youtubeUrl || null, website_url: websiteUrl || null, media_urls: mediaUrls, updated_at: new Date().toISOString() });
    if (aErr) { setError(aErr.message); setSaving(false); return; }
    await refreshProfile(); setSaving(false); setSuccess(true); setTimeout(() => setSuccess(false), 3000);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  const mediaHint = CATEGORY_MEDIA_HINTS[talentCategory];
  const roleOptions = CATEGORY_ROLES[talentCategory];
  const styleOptions = CATEGORY_STYLES[talentCategory];
  const mediaByType: Record<MediaType, MediaItem[]> = {
    photo: mediaItems.filter((m) => m.media_type === 'photo'),
    audio: mediaItems.filter((m) => m.media_type === 'audio'),
    video: mediaItems.filter((m) => m.media_type === 'video'),
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-6 lg:px-12 py-12">
        <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Profile Setup</p>
        <h1 className="font-display text-4xl font-bold text-ink mb-2">Edit Talent Profile</h1>
        <p className="text-ink-400 mb-10">Update your portfolio, rates, and social links.</p>

        {error && <div className="flex items-start gap-2 p-3 mb-6 border border-red-200 bg-red-50 text-red-700 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span></div>}
        {success && <div className="flex items-start gap-2 p-3 mb-6 border border-accent-200 bg-accent-50 text-accent-600 text-sm"><CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>Profile saved successfully.</span></div>}

        <form onSubmit={handleSave} className="space-y-10">
          {/* Basic Info */}
          <Section title="Basic Information">
            <Field label="Full Name"><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" /></Field>
            <Field label="Stage Name"><input type="text" value={stageName} onChange={(e) => setStageName(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="Professional name" /></Field>
            <Field label="Location"><input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="City, State" /></Field>
            <Field label="Avatar URL"><input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="https://..." /></Field>
            <Field label="Bio" full><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="Tell hosts about yourself..." /></Field>
          </Section>

          {/* Category */}
          <Section title="Talent Category">
            <div className="sm:col-span-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORY_LIST.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.value];
                  return <button key={cat.value} type="button" onClick={() => { setTalentCategory(cat.value); setPerformanceRoles([]); setGenres([]); }}
                    className={`flex items-center gap-2 p-3 border text-left transition-all rounded-none ${talentCategory === cat.value ? 'border-accent bg-accent-50 text-accent' : 'border-line text-ink-500 hover:border-ink/30'}`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" /><span className="text-xs font-medium leading-tight">{cat.shortLabel}</span>
                  </button>;
                })}
              </div>
              <p className="text-xs text-ink-300 mt-2">{CATEGORY_LABELS[talentCategory]}</p>
            </div>
          </Section>

          {/* Specialties & Styles */}
          <Section title="Specialties & Styles">
            <Field label="Specialties" full>
              <div className="flex flex-wrap gap-2">
                {roleOptions.map((role) => <button key={role} type="button" onClick={() => toggleArrayValue(performanceRoles, role, setPerformanceRoles)}
                  className={`filter-chip ${performanceRoles.includes(role) ? 'filter-chip-active' : 'filter-chip-inactive'}`}>{role}</button>)}
              </div>
            </Field>
            <Field label="Styles" full>
              <div className="flex flex-wrap gap-2">
                {styleOptions.map((style) => <button key={style} type="button" onClick={() => toggleArrayValue(genres, style, setGenres)}
                  className={`filter-chip ${genres.includes(style) ? 'filter-chip-active' : 'filter-chip-inactive'}`}>{style}</button>)}
              </div>
            </Field>
            <Field label="Base Rate ($)"><input type="number" min="0" step="any" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="150" /></Field>
            <Field label="Rate Unit"><select value={rateUnit} onChange={(e) => setRateUnit(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm"><option value="hour">Per Hour</option><option value="event">Per Event</option><option value="day">Per Day</option></select></Field>
          </Section>

          {/* Social */}
          <Section title="Social Links">
            <Field label="Spotify"><input type="url" value={spotifyUrl} onChange={(e) => setSpotifyUrl(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="https://open.spotify.com/..." /></Field>
            <Field label="Instagram"><input type="url" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="https://instagram.com/..." /></Field>
            <Field label="SoundCloud"><input type="url" value={soundcloudUrl} onChange={(e) => setSoundcloudUrl(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="https://soundcloud.com/..." /></Field>
            <Field label="YouTube"><input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="https://youtube.com/..." /></Field>
            <Field label="Website" full><input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="https://..." /></Field>
          </Section>

          {/* Typed Media */}
          <Section title="Portfolio Media">
            <div className="sm:col-span-2">
              <p className="text-sm text-ink-400 mb-4 flex items-start gap-2"><ImageIcon className="w-4 h-4 mt-0.5 flex-shrink-0" /> {mediaHint.hint}</p>
              {/* Add new */}
              <div className="border border-line p-4 mb-6">
                <div className="flex flex-wrap gap-2 mb-3">
                  {(['photo', 'audio', 'video'] as MediaType[]).map((type) => {
                    const Icon = type === 'photo' ? ImageIcon : type === 'audio' ? Headphones : PlayCircle;
                    const enabled = type === 'photo' ? mediaHint.photos : type === 'audio' ? mediaHint.audio : mediaHint.video;
                    if (!enabled) return null;
                    return <button key={type} type="button" onClick={() => setNewMediaType(type)}
                      className={`filter-chip inline-flex items-center gap-1.5 ${newMediaType === type ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
                      <Icon className="w-3 h-3" /> {MEDIA_TYPE_LABELS[type]}
                    </button>;
                  })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input type="text" value={newMediaTitle} onChange={(e) => setNewMediaTitle(e.target.value)} className="input-editorial sm:col-span-4 px-3 py-2.5 text-sm" placeholder="Title (optional)" />
                  

  <input type="file" accept="image/*,video/*"
  className="input-editorial sm:col-span-6 px-3 py-2.5 text-sm"
  onChange={async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${artistProfileId || 'public'}/${Math.random()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('portfolio-media')
      .upload(filePath, file);

    if (!error) {
      const { data } = supabase.storage
        .from('portfolio-media')
        .getPublicUrl(filePath);

      setNewMediaUrlTyped(data.publicUrl);
    } catch (err) {
      console.error(err);
  }}
/>
<button type="button" onClick={addMediaItem} disabled={!newMediaUrlTyped.trim()}
                    className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-4 py-2.5 text-sm font-medium text-paper bg-ink hover:bg-ink-700 disabled:opacity-50 transition-colors rounded-none whitespace-nowrap">
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>

              {/* Existing items */}
              {(['photo', 'audio', 'video'] as MediaType[]).map((type) => {
                const items = mediaByType[type];
                if (items.length === 0) return null;
                const Icon = type === 'photo' ? ImageIcon : type === 'audio' ? Headphones : PlayCircle;
                return (
                  <div key={type} className="mb-6">
                    <div className="flex items-center gap-2 mb-3"><Icon className="w-4 h-4 text-accent" /><span className="text-xs uppercase tracking-wide-sm text-ink-500">{MEDIA_TYPE_LABELS[type]}s</span><span className="text-xs text-ink-300">({items.length})</span></div>
                    {type === 'photo' && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {items.map((item) => (
                          <div key={item.id} className="relative group aspect-square overflow-hidden border border-line">
                            <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                            {item.title && <div className="absolute bottom-0 left-0 right-0 bg-paper/90 text-ink text-xs px-1.5 py-0.5 truncate">{item.title}</div>}
                            <button type="button" onClick={() => deleteMediaItem(item.id)} className="absolute top-1.5 right-1.5 w-6 h-6 bg-paper/90 text-ink-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {type === 'audio' && (
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 p-3 border border-line">
                            <Headphones className="w-5 h-5 text-accent flex-shrink-0" />
                            <div className="flex-1 min-w-0"><div className="text-sm font-medium text-ink truncate">{item.title || 'Untitled Track'}</div><audio controls className="w-full mt-1 h-8" src={item.url} /></div>
                            <button type="button" onClick={() => deleteMediaItem(item.id)} className="text-ink-300 hover:text-red-500 transition-colors flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {type === 'video' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {items.map((item) => (
                          <div key={item.id} className="relative group overflow-hidden border border-line">
                            <video controls className="w-full aspect-video bg-black" src={item.url} />
                            {item.title && <div className="px-3 py-1.5 text-sm font-medium text-ink border-t border-line">{item.title}</div>}
                            <button type="button" onClick={() => deleteMediaItem(item.id)} className="absolute top-1.5 right-1.5 w-6 h-6 bg-paper/90 text-ink-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {mediaItems.length === 0 && <p className="text-sm text-ink-300 text-center py-8">No media items yet. Add your first one above.</p>}
            </div>
          </Section>

          {/* Cover images */}
          <Section title="Cover Images">
            <Field label="Cover Image URLs" full>
              <p className="text-xs text-ink-300 mb-2">Displayed as the card image in the directory.</p>
              <div className="flex gap-2 mb-3">
                <input type="url" value={newMediaUrl} onChange={(e) => setNewMediaUrl(e.target.value)} className="input-editorial flex-1 px-4 py-2.5 text-sm" placeholder="https://image-url.com/photo.jpg" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMediaUrl(); } }} />
                <button type="button" onClick={addMediaUrl} className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-paper bg-ink hover:bg-ink-700 transition-colors rounded-none whitespace-nowrap"><Plus className="w-4 h-4" /> Add</button>
              </div>
              {mediaUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {mediaUrls.map((url, i) => (
                    <div key={i} className="relative group aspect-square overflow-hidden border border-line">
                      <img src={url} alt={`Cover image ${i + 1}`} width={300} height={300} loading="lazy" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeMediaUrl(i)} className="absolute top-1.5 right-1.5 w-6 h-6 bg-paper/90 text-ink-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </Field>
          </Section>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-xs uppercase tracking-wide-sm disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Profile
            </button>
            <button type="button" onClick={() => navigate(profile ? `/artists/${profile.id}` : '/artists')} className="btn-outline px-8 py-3.5 text-xs uppercase tracking-wide-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border border-line p-6 lg:p-8"><h2 className="font-display text-xl font-semibold text-ink mb-6">{title}</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-5">{children}</div></div>;
}
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={full ? 'sm:col-span-2' : ''}><label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">{label}</label>{children}</div>;
}
