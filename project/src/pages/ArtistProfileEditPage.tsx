import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { VerificationForm } from '@/components/VerificationForm';
import { Plus, Trash2, ArrowLeft, Loader2, Save, Upload, Image as ImageIcon, Music } from 'lucide-react';
import type { Category, Genre } from '@/types';

const CATEGORIES: Category[] = [
  'Singer', 
  'Producer', 
  'Performer', 
  'Model', 
  'Photographer', 
  'Beauty Professional',
  'Tattoo Artist',
  'Asset Hire'
];

const GENRES: Genre[] = [
  'Amapiano', 'Deep House', 'Afro House', 'Gqom', 'Hip Hop', 'R&B',
  'Afrobeats', 'Pop', 'Jazz', 'Gospel', 'Commercial', 'Editorial',
  'Fashion', 'Event', 'Portrait', 'Bridal', 'Glamour'
];

interface ServiceItem {
  id?: string;
  service_name: string;
  price: string;
  duration_minutes: number;
}

interface AssetItem {
  id?: string;
  asset_name: string;
  asset_category: string;
  daily_rate: string;
  hourly_rate?: string;
  description?: string;
  image_url?: string;
}

const DRAFT_KEY = 'artist_profile_edit_draft';

export default function ArtistProfileEditPage() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Basic Form States
  const [stageName, setStageName] = useState('');
  const [bio, setBio] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  
  // Dynamic Pricing & Rate States
  const [pricingType, setPricingType] = useState<'per_hour' | 'per_gig' | 'per_beat' | 'per_service' | 'per_tattoo' | 'per_asset'>('per_hour');
  const [baseRate, setBaseRate] = useState('');
  
  // Services & Assets
  const [services, setServices] = useState<ServiceItem[]>([
    { service_name: '', price: '', duration_minutes: 60 }
  ]);

  const [assets, setAssets] = useState<AssetItem[]>([
    { asset_name: '', asset_category: 'Vehicle', daily_rate: '' }
  ]);

  // Location & Media States
  const [locationCity, setLocationCity] = useState('');
  const [locationProvince, setLocationProvince] = useState('');
  const [travelRadius, setTravelRadius] = useState('50');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [instagram, setInstagram] = useState('');
  const [spotify, setSpotify] = useState('');
  const [soundcloud, setSoundcloud] = useState('');
  const [youtube, setYoutube] = useState('');

  // 1. Initial Data Fetching
  useEffect(() => {
    if (!profile) return;
    loadArtistProfile();
  }, [profile]);

  // 2. Draft Autosave to localStorage
  useEffect(() => {
    if (loading) return;
    const draft = {
      stageName, bio, categories, genres, pricingType, baseRate,
      services, assets, locationCity, locationProvince, travelRadius,
      avatarUrl, coverUrl, galleryUrls, instagram, spotify, soundcloud, youtube
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    stageName, bio, categories, genres, pricingType, baseRate,
    services, assets, locationCity, locationProvince, travelRadius,
    avatarUrl, coverUrl, galleryUrls, instagram, spotify, soundcloud, youtube, loading
  ]);

  const loadArtistProfile = async () => {
    try {
      setLoading(true);

      // Check if user has an unsaved local draft first
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      
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
        setPricingType(data.pricing_type || 'per_hour');
        setBaseRate(
          data.base_rate !== null && data.base_rate !== undefined
            ? String(data.base_rate)
            : data.hourly_rate
            ? String(data.hourly_rate)
            : ''
        );
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

        // Fetch Services
        if (
          data.pricing_type === 'per_service' || 
          data.pricing_type === 'per_tattoo' ||
          data.categories?.includes('Beauty Professional') || 
          data.categories?.includes('Tattoo Artist')
        ) {
          const { data: serviceData } = await supabase
            .from('talent_services')
            .select('*')
            .eq('profile_id', profile?.id);

          if (serviceData && serviceData.length > 0) {
            setServices(
              serviceData.map((s) => ({
                id: s.id,
                service_name: s.service_name || '',
                price: s.price !== null && s.price !== undefined ? String(s.price) : '',
                duration_minutes: s.duration_minutes || 60,
              }))
            );
          }
        }

        // Fetch Assets
        if (data.pricing_type === 'per_asset' || data.categories?.includes('Asset Hire')) {
          const { data: assetData } = await supabase
            .from('talent_assets')
            .select('*')
            .eq('profile_id', profile?.id);

          if (assetData && assetData.length > 0) {
            setAssets(
              assetData.map((a) => ({
                id: a.id,
                asset_name: a.asset_name || '',
                asset_category: a.asset_category || 'Vehicle',
                daily_rate: a.daily_rate !== null && a.daily_rate !== undefined ? String(a.daily_rate) : '',
                description: a.description || '',
                image_url: a.image_url || ''
              }))
            );
          }
        }
      }

      // Restore unsaved draft overrides if they exist
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.stageName) setStageName(parsed.stageName);
        if (parsed.bio) setBio(parsed.bio);
        if (parsed.categories?.length) setCategories(parsed.categories);
        if (parsed.genres?.length) setGenres(parsed.genres);
        if (parsed.locationCity) setLocationCity(parsed.locationCity);
        if (parsed.locationProvince) setLocationProvince(parsed.locationProvince);
        if (parsed.baseRate) setBaseRate(parsed.baseRate);
        if (parsed.instagram) setInstagram(parsed.instagram);
        if (parsed.spotify) setSpotify(parsed.spotify);
        if (parsed.soundcloud) setSoundcloud(parsed.soundcloud);
        if (parsed.youtube) setYoutube(parsed.youtube);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper for Uploading Files
  const uploadFileToSupabase = async (file: File, folder: string) => {
    if (!profile) throw new Error('User not authenticated');
    const fileExt = file.name.split('.').pop();
    const filePath = `${profile.id}/${folder}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('media').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Avatar Upload Handler
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAvatar(true);
      setError(null);
      const url = await uploadFileToSupabase(file, 'avatar');
      setAvatarUrl(url);
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Cover Upload Handler
  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingCover(true);
      setError(null);
      const url = await uploadFileToSupabase(file, 'cover');
      setCoverUrl(url);
    } catch (err: any) {
      setError(err.message || 'Failed to upload cover banner');
    } finally {
      setUploadingCover(false);
    }
  };

  // Gallery Upload Handler
  const handleGalleryFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      setUploadingGallery(true);
      setError(null);
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const url = await uploadFileToSupabase(file, 'gallery');
        uploadedUrls.push(url);
      }
      setGalleryUrls((prev) => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload gallery media');
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleRemoveGalleryUrl = (index: number) => {
    setGalleryUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCategoryToggle = (cat: Category) => {
    setCategories((prev) => {
      const nextCategories = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat];
      if (nextCategories.includes('Producer')) setPricingType('per_beat');
      else if (nextCategories.includes('Beauty Professional')) setPricingType('per_service');
      else if (nextCategories.includes('Tattoo Artist')) setPricingType('per_tattoo');
      else if (nextCategories.includes('Asset Hire')) setPricingType('per_asset');
      else if (['per_beat', 'per_service', 'per_tattoo', 'per_asset'].includes(pricingType)) {
        setPricingType('per_hour');
      }
      return nextCategories;
    });
  };

  const handleGenreToggle = (g: Genre) => {
    setGenres((prev) => (prev.includes(g) ? prev.filter((item) => item !== g) : [...prev, g]));
  };

  // Save All Changes Submit Handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (!profile) throw new Error('Not authenticated');

      const parsedBaseRate = baseRate ? parseFloat(baseRate) : null;

      const payload = {
        user_id: profile.id,
        stage_name: stageName,
        bio,
        categories,
        genres,
        pricing_type: pricingType,
        base_rate: parsedBaseRate,
        hourly_rate: pricingType === 'per_hour' ? parsedBaseRate : null,
        location_city: locationCity,
        location_province: locationProvince,
        travel_radius: travelRadius ? parseInt(travelRadius) : 50,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        gallery_urls: galleryUrls,
        social_links: { instagram, spotify, soundcloud, youtube },
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('artist_profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;

      // Handle Beauty Professional & Tattoo Artist Services
      if (
        pricingType === 'per_service' || 
        pricingType === 'per_tattoo' ||
        categories.includes('Beauty Professional') ||
        categories.includes('Tattoo Artist')
      ) {
        await supabase.from('talent_services').delete().eq('profile_id', profile.id);

        const validServices = services
          .filter((s) => s.service_name.trim() !== '' && s.price.trim() !== '')
          .map((s) => ({
            profile_id: profile.id,
            service_name: s.service_name.trim(),
            price: parseFloat(s.price),
            duration_minutes: s.duration_minutes || 60,
          }));

        if (validServices.length > 0) {
          const { error: serviceErr } = await supabase.from('talent_services').insert(validServices);
          if (serviceErr) throw serviceErr;
        }
      }

      // Handle Asset Hire Inventory
      if (pricingType === 'per_asset' || categories.includes('Asset Hire')) {
        await supabase.from('talent_assets').delete().eq('profile_id', profile.id);

        const validAssets = assets
          .filter((a) => a.asset_name.trim() !== '' && a.daily_rate.trim() !== '')
          .map((a) => ({
            profile_id: profile.id,
            asset_name: a.asset_name.trim(),
            asset_category: a.asset_category || 'Vehicle',
            daily_rate: parseFloat(a.daily_rate),
            description: a.description || null,
            image_url: a.image_url || null,
          }));

        if (validAssets.length > 0) {
          const { error: assetErr } = await supabase.from('talent_assets').insert(validAssets);
          if (assetErr) throw assetErr;
        }
      }

      if (avatarUrl) {
        await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profile.id);
      }

      // Clear draft on success
      localStorage.removeItem(DRAFT_KEY);

      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getMediaType = (url: string) => {
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.match(/\.(mp3|wav|ogg|m4a|aac)$/)) return 'audio';
    if (cleanUrl.match(/\.(mp4|webm|mov|m4v)$/)) return 'video';
    return 'image';
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
          type="button"
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
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-wide-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>

        {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
        {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">Profile saved successfully!</div>}

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Identity & Bio */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-wide-sm font-semibold text-ink border-b border-line pb-2">Basic Info</h2>
            <div className="grid grid-cols-1 gap-6">
              <FormField label="Stage / Artist / Brand Name" full>
                <input
                  type="text"
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  className="input-field"
                  placeholder="e.g. Ink & Motion Studio or DJ Spark"
                  required
                />
              </FormField>

              <FormField label="Bio & Portfolio Overview" full>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="input-field"
                  placeholder="Tell event organizers and clients about your background, tattoo styles, or available rental assets..."
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

          {/* Pricing & Rates Section */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-wide-sm font-semibold text-ink border-b border-line pb-2">Pricing & Rates</h2>

            {categories.includes('Producer') && (
              <FormField label="Rate Per Beat (ZAR)" full={false}>
                <input
                  type="number"
                  value={baseRate}
                  onChange={(e) => setBaseRate(e.target.value)}
                  className="input-field"
                  placeholder="e.g. 500"
                  required
                />
              </FormField>
            )}

            {categories.includes('Beauty Professional') && (
              <div className="space-y-4">
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400">Services & Pricing Menu</label>
                {services.map((service, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Service Name (e.g. Knotless Braids)"
                      value={service.service_name}
                      onChange={(e) => {
                        const updated = [...services];
                        updated[idx].service_name = e.target.value;
                        setServices(updated);
                      }}
                      className="input-field flex-1"
                    />
                    <input
                      type="number"
                      placeholder="Price (ZAR)"
                      value={service.price}
                      onChange={(e) => {
                        const updated = [...services];
                        updated[idx].price = e.target.value;
                        setServices(updated);
                      }}
                      className="input-field w-32"
                    />
                    <button
                      type="button"
                      onClick={() => setServices(services.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setServices([...services, { service_name: '', price: '', duration_minutes: 60 }])}
                  className="flex items-center gap-2 text-xs uppercase tracking-wide-sm text-ink hover:underline pt-2"
                >
                  <Plus className="w-4 h-4" /> Add Service
                </button>
              </div>
            )}

            {categories.includes('Tattoo Artist') && (
              <div className="space-y-4">
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400">Tattoo Size & Style Rates</label>
                {services.map((service, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Tattoo Type (e.g. Fine Line Flash, Half Sleeve)"
                      value={service.service_name}
                      onChange={(e) => {
                        const updated = [...services];
                        updated[idx].service_name = e.target.value;
                        setServices(updated);
                      }}
                      className="input-field flex-1"
                    />
                    <input
                      type="number"
                      placeholder="Price (ZAR)"
                      value={service.price}
                      onChange={(e) => {
                        const updated = [...services];
                        updated[idx].price = e.target.value;
                        setServices(updated);
                      }}
                      className="input-field w-32"
                    />
                    <button
                      type="button"
                      onClick={() => setServices(services.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setServices([...services, { service_name: '', price: '', duration_minutes: 60 }])}
                  className="flex items-center gap-2 text-xs uppercase tracking-wide-sm text-ink hover:underline pt-2"
                >
                  <Plus className="w-4 h-4" /> Add Tattoo Rate Tier
                </button>
              </div>
            )}

            {categories.includes('Asset Hire') && (
              <div className="space-y-4">
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400">Assets Available for Music Video & Shoot Hire</label>
                {assets.map((asset, idx) => (
                  <div key={idx} className="p-4 border border-line bg-paper-100 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Asset Name (e.g. 1969 Ford Mustang)"
                        value={asset.asset_name}
                        onChange={(e) => {
                          const updated = [...assets];
                          updated[idx].asset_name = e.target.value;
                          setAssets(updated);
                        }}
                        className="input-field"
                      />
                      <select
                        value={asset.asset_category}
                        onChange={(e) => {
                          const updated = [...assets];
                          updated[idx].asset_category = e.target.value;
                          setAssets(updated);
                        }}
                        className="input-field"
                      >
                        <option value="Vehicle">Luxury / Vintage Vehicle</option>
                        <option value="Location">Mansion / Loft / Location</option>
                        <option value="Helicopter">Helicopter / Aircraft</option>
                        <option value="Prop">Luxury Prop / Accessory</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Daily Hire Rate (ZAR)"
                        value={asset.daily_rate}
                        onChange={(e) => {
                          const updated = [...assets];
                          updated[idx].daily_rate = e.target.value;
                          setAssets(updated);
                        }}
                        className="input-field"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <input
                        type="text"
                        placeholder="Image URL for asset (optional)"
                        value={asset.image_url || ''}
                        onChange={(e) => {
                          const updated = [...assets];
                          updated[idx].image_url = e.target.value;
                          setAssets(updated);
                        }}
                        className="input-field flex-1 mr-3"
                      />
                      <button
                        type="button"
                        onClick={() => setAssets(assets.filter((_, i) => i !== idx))}
                        className="p-2 text-red-600 hover:text-red-800 flex items-center gap-1 text-xs uppercase tracking-wide-sm font-semibold"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setAssets([...assets, { asset_name: '', asset_category: 'Vehicle', daily_rate: '' }])}
                  className="flex items-center gap-2 text-xs uppercase tracking-wide-sm text-ink hover:underline pt-2"
                >
                  <Plus className="w-4 h-4" /> Add Asset For Hire
                </button>
              </div>
            )}

            {!categories.includes('Producer') && 
             !categories.includes('Beauty Professional') && 
             !categories.includes('Tattoo Artist') && 
             !categories.includes('Asset Hire') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Pricing Structure</label>
                  <div className="flex gap-4 pt-2">
                    <label className="flex items-center gap-2 text-xs uppercase text-ink cursor-pointer">
                      <input
                        type="radio"
                        name="pricingType"
                        checked={pricingType === 'per_hour'}
                        onChange={() => setPricingType('per_hour')}
                      />
                      Per Hour
                    </label>
                    <label className="flex items-center gap-2 text-xs uppercase text-ink cursor-pointer">
                      <input
                        type="radio"
                        name="pricingType"
                        checked={pricingType === 'per_gig'}
                        onChange={() => setPricingType('per_gig')}
                      />
                      Per Gig / Event
                    </label>
                  </div>
                </div>

                <FormField label={pricingType === 'per_hour' ? "Hourly Rate (ZAR)" : "Flat Rate Per Gig (ZAR)"} full={false}>
                  <input
                    type="number"
                    value={baseRate}
                    onChange={(e) => setBaseRate(e.target.value)}
                    className="input-field"
                    placeholder="e.g. 1500"
                  />
                </FormField>
              </div>
            )}
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

          {/* Media Uploads */}
          <section className="space-y-6">
            <h2 className="text-sm uppercase tracking-wide-sm font-semibold text-ink border-b border-line pb-2">Profile & Banner Media</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Avatar Upload */}
              <div>
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Avatar Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-paper-200 border border-line flex items-center justify-center flex-shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-ink-400" />
                    )}
                  </div>
                  <label className="cursor-pointer btn-primary px-4 py-2 text-xs uppercase tracking-wide-sm flex items-center gap-2">
                    {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Browse Avatar
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                  </label>
                </div>
              </div>

              {/* Cover Banner Upload */}
              <div>
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Cover Banner Image</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-16 overflow-hidden bg-paper-200 border border-line flex items-center justify-center flex-shrink-0">
                    {coverUrl ? (
                      <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-ink-400" />
                    )}
                  </div>
                  <label className="cursor-pointer btn-primary px-4 py-2 text-xs uppercase tracking-wide-sm flex items-center gap-2">
                    {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Browse Banner
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} disabled={uploadingCover} />
                  </label>
                </div>
              </div>
            </div>

            {/* Gallery Media Upload */}
            <div className="space-y-3 pt-4">
              <label className="block text-xs uppercase tracking-wide-sm text-ink-400">Portfolio Media (Photos, Audio & Video)</label>
              <label className="cursor-pointer border-2 border-dashed border-line hover:border-ink p-6 text-center block transition-colors bg-paper-100">
                {uploadingGallery ? (
                  <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wide-sm text-ink-600">
                    <Loader2 className="w-5 h-5 animate-spin" /> Uploading portfolio media...
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-6 h-6 text-ink-500" />
                    <span className="text-xs uppercase tracking-wide-sm font-semibold text-ink">Click to browse & upload media</span>
                    <span className="text-xs text-ink-400">Supports Images, MP3/Audio, and MP4/Video files</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*,audio/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleGalleryFilesChange}
                  disabled={uploadingGallery}
                />
              </label>

              {galleryUrls.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                  {galleryUrls.map((url, i) => {
                    const mediaType = getMediaType(url);
                    return (
                      <div key={i} className="relative group aspect-square bg-paper-200 border border-line overflow-hidden flex flex-col items-center justify-center">
                        {mediaType === 'image' && (
                          <img src={url} alt={`Portfolio Media ${i}`} className="w-full h-full object-cover" />
                        )}

                        {mediaType === 'video' && (
                          <video src={url} controls className="w-full h-full object-cover" />
                        )}

                        {mediaType === 'audio' && (
                          <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-paper-300 text-center">
                            <Music className="w-8 h-8 text-ink-600 mb-2" />
                            <audio src={url} controls className="w-full h-8 max-w-[90%]" />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryUrl(i)}
                          className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-none opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Identity & Safety Verification */}
          <section className="space-y-6">
            <VerificationForm />
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
