import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Camera, Plus, Trash2, ArrowLeft, Loader2, Save } from 'lucide-react';
import type { Category, Genre } from '@/types';

const CATEGORIES: Category[] = ['Singer', 'Producer', 'Performer', 'Model', 'Photographer', 'Beauty Professional'];
const GENRES: Genre[] = [
  'Amapiano', 'Deep House', 'Afro House', 'Gqom', 'Hip Hop', 'R&B',
  'Afrobeats', 'Pop', 'Jazz', 'Gospel', 'Commercial', 'Editorial',
  'Fashion', 'Event', 'Portrait', 'Bridal', 'Glamour'
];

export default function ArtistProfileEditPage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [stageName, setStageName] = useState('');
  const [bio, setBio] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [hourlyRate, setHourlyRate] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationProvince, setLocationProvince] = useState('');
  const [travelRadius, setTravelRadius] = useState('50');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  const [spotify, setSpotify] = useState('');
  const [soundcloud, setSoundcloud] = useState('');
  const [youtube, setYoutube] = useState('');

  useEffect(() => {
    if (!profile) return;
    loadArtistProfile();
  }, [profile]);

  const loadArtistProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('artist_profiles')
        .select('*')
        .eq('user_id', profile?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setStageName(data.stage_name || '');
        setBio(data.bio || '');
        setCategories(data.categories || []);
        setGenres(data.genres || []);
        setHourlyRate(data.hourly_rate ? String(data.hourly_rate) : '');
        setLocationCity(data.location_city || '');
        setLocationProvince(data.location_province || '');
        setTravelRadius(data.travel_radius ? String(data.travel_radius) : '50');
        setAvatarUrl(data.avatar_url || profile?.avatar_url || '');
        setCoverUrl(data.cover_url || '');
        setGalleryUrls(data.gallery_urls || []);
        setInstagram(data.social_links?.instagram || '');
        setSpotify(data.social_links?.spotify || '');
        setSoundcloud(data.social_links?.soundcloud || '');
        setYoutube(data.social_links?.youtube || '');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryToggle = (cat: Category) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleGenreToggle = (g: Genre) => {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((item) => item !== g) : [...prev, g]
    );
  };

  const handleAddGalleryUrl = () => {
    if (!newGalleryUrl.trim()) return;
    setGalleryUrls((prev) => [...prev, newGalleryUrl.trim()]);
    setNewGalleryUrl('');
  };

  const handleRemoveGalleryUrl = (index: number) => {
    setGalleryUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (!profile) throw new Error('Not authenticated');

      const payload = {
        user_id: profile.id,
        stage_name: stageName,
        bio,
        categories,
        genres,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        location_city: locationCity,
        location_province: locationProvince,
        travel_radius: travelRadius ? parseInt(travelRadius) : 50,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        gallery_urls: galleryUrls,
        social_links: {
          instagram,
          spotify,
          soundcloud,
          youtube,
        },
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('artist_profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;

      if (avatarUrl) {
        await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', profile.id);
      }

      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ink-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper py-12 px-6 lg:px-12">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/artist-dashboard')}
          className="flex items-center gap-2 text-xs uppercase tracking-wide-sm text-ink-500 hover:text-ink mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex items-center justify-between mb-8 pb-6 border-b border-line">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">Edit Artist Profile</h1>
            <p className="text-sm text-ink-500 mt-1">Keep your profile updated so event hosts can discover and book you.</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-wide-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            Profile saved successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Identity & Bio */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-wide-sm font-semibold text-ink border-b border-line pb-2">Basic Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label="Stage / Artist Name" full>
                <input
                  type="text"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  className="input-field"
                  placeholder="e.g. DJ Spark"
                  required
                />
              </FormField>

              <FormField label="Hourly Rate (ZAR)" full={false}>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="input-field"
                  placeholder="e.g. 1500"
                />
              </FormField>

              <FormField label="Bio & Portfolio Overview" full>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="input-field"
                  placeholder="Tell event organizers about your background, experience, and performance style..."
                />
              </FormField>
            </div>
          </section>

          {/* Categories */}
          <section className="space-y-4">
            <h2 className="text-sm uppercase tracking-wide-sm font-semibold text-ink border-b border-line pb-2">Categories</h2>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => handleCategoryToggle(cat)}
                  className={`px-4 py-2 text-xs uppercase tracking-wide-sm border transition-colors ${
                    categories.includes(cat)
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-paper text-ink-600 border-line hover:border-ink'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          {/* Genres */}
          <section className="space-y-4">
            <h2 className="text-sm uppercase tracking-wide-sm font-semibold text-ink border-b border-line pb-2">Genres / Specialties</h2>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => handleGenreToggle(g)}
                  className={`px-3 py-1.5 text-xs border transition-colors ${
                    genres.includes(g)
                      ? 'bg-accent text-white border-accent'
                      : 'bg-paper text-ink-600 border-line hover:border-ink'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </section>

          {/* Location */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-wide-sm font-semibold text-ink border-b border-line pb-2">Location & Coverage</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <FormField label="City" full={false}>
                <input
                  type="text"
                  value={locationCity}
                  onChange={(e) => setLocationCity(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Cape Town"
                />
              </FormField>
              <FormField label="Province" full={false}>
                <input
                  type="text"
                  value={locationProvince}
                  onChange={(e) => setLocationProvince(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Western Cape"
                />
              </FormField>
              <FormField label="Travel Radius (km)" full={false}>
                <input
                  type="number"
                  value={travelRadius}
                  onChange={(e) => setTravelRadius(e.target.value)}
                  className="input-field"
                  placeholder="50"
                />
              </FormField>
            </div>
          </section>

          {/* Images */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-wide-sm font-semibold text-ink border-b border-line pb-2">Profile & Banner Media</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label="Avatar Image URL" full={false}>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="input-field"
                  placeholder="https://..."
                />
              </FormField>
              <FormField label="Cover Banner Image URL" full={false}>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="input-field"
                  placeholder="https://..."
                />
              </FormField>
            </div>

            <div className="space-y-3">
              <label className="block text-xs uppercase tracking-wide-sm text-ink-400">Gallery Media URLs</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newGalleryUrl}
                  onChange={(e) => setNewGalleryUrl(e.target.value)}
                  className="input-field flex-1"
                  placeholder="https://..."
                />
                <button
                  type="button"
                  onClick={handleAddGalleryUrl}
                  className="btn-primary px-4 flex items-center gap-1 text-xs uppercase tracking-wide-sm"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {galleryUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  {galleryUrls.map((url, i) => (
                    <div key={i} className="relative group aspect-square bg-paper-200 border border-line overflow-hidden">
                      <img src={url} alt={`Gallery ${i}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveGalleryUrl(i)}
                        className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-none opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Social Links */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-wide-sm font-semibold text-ink border-b border-line pb-2">Social & Streaming Handles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FormField label="Instagram Handle or Link" full={false}>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="input-field"
                  placeholder="@username or link"
                />
              </FormField>
              <FormField label="Spotify Link" full={false}>
                <input
                  type="text"
                  value={spotify}
                  onChange={(e) => setSpotify(e.target.value)}
                  className="input-field"
                  placeholder="https://open.spotify.com/..."
                />
              </FormField>
              <FormField label="SoundCloud Link" full={false}>
                <input
                  type="text"
                  value={soundcloud}
                  onChange={(e) => setSoundcloud(e.target.value)}
                  className="input-field"
                  placeholder="https://soundcloud.com/..."
                />
              </FormField>
              <FormField label="YouTube Link" full={false}>
                <input
                  type="text"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  className="input-field"
                  placeholder="https://youtube.com/..."
                />
              </FormField>
            </div>
          </section>

          <div className="pt-6 border-t border-line flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-8 py-3 text-xs uppercase tracking-wide-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">{label}</label>
      {children}
    </div>
  );
}
