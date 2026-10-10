import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, Save, ArrowLeft, CheckCircle2, AlertCircle, Upload, X, Plus, Trash2, Image as ImageIcon } from 'lucide-react';

// Primary categories available on HostMeUp
const CATEGORIES = [
  'SINGER',
  'PRODUCER',
  'PERFORMER',
  'MODEL',
  'PHOTOGRAPHER',
  'BEAUTY PROFESSIONAL',
  'TATTOO ARTIST',
  'ASSET HIRE',
];

// Mapped genres and specialties based on selected category
const CATEGORY_SPECIALTIES: Record<string, string[]> = {
  SINGER: ['Amapiano', 'Deep House', 'Afro House', 'Gqom', 'Hip Hop', 'R&B', 'Afrobeats', 'Pop', 'Jazz', 'Gospel', 'Commercial'],
  PRODUCER: ['Amapiano', 'Deep House', 'Afro House', 'Gqom', 'Hip Hop', 'R&B', 'Afrobeats', 'Trap', 'Pop', 'Dancehall'],
  PERFORMER: ['MC / Host', 'Live Band', 'Dancer', 'DJ', 'Comedian', 'Stage Act', 'Fire Dancer', 'Hype Man'],
  MODEL: ['Editorial', 'Fashion', 'Commercial', 'Fitness', 'Runway', 'Glamour', 'Swimwear', 'Promotional'],
  PHOTOGRAPHER: [
    'Drone Operator',
    'Music Video Shooter',
    'Video Editor',
    'Event Photography',
    'Portrait',
    'Editorial',
    'Fashion',
    'Commercial',
    'Studio Session',
    'Bridal / Wedding',
    'Streetwear / Urban'
  ],
  'BEAUTY PROFESSIONAL': ['Makeup Artist', 'Hair Stylist', 'Nail Tech', 'SFX Makeup', 'Lash Tech', 'Barber'],
  'TATTOO ARTIST': ['Realism', 'Traditional', 'Minimalist / Line Work', 'Black & Grey', 'Color', 'Script / Lettering'],
  'ASSET HIRE': ['Sound System', 'Lighting & Rigging', 'DJ Gear', 'Camera Gear', 'Stage Props', 'Generator']
};

interface ServiceItem {
  id?: string;
  service_name: string;
  price: number;
  duration_minutes?: number;
}

export default function ArtistProfileEdit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [stageName, setStageName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('PHOTOGRAPHER');
  const [customRateDisplay, setCustomRateDisplay] = useState<string>('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [location, setLocation] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [portfolioUrls, setPortfolioUrls] = useState<string[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);

  // New Service Item Input State
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login');
          return;
        }

        const { data, error } = await supabase
          .from('host_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          if (data.stage_name) setStageName(data.stage_name);
          if (data.avatar_url) setAvatarUrl(data.avatar_url);
          if (data.cover_url) setCoverUrl(data.cover_url);
          if (data.category) setSelectedCategory(data.category.toUpperCase());
          if (data.custom_rate_display) setCustomRateDisplay(data.custom_rate_display);
          if (data.genres && Array.isArray(data.genres)) setSelectedGenres(data.genres);
          if (data.location) setLocation(data.location);
          if (data.bio) setBio(data.bio);
          if (data.portfolio_urls && Array.isArray(data.portfolio_urls)) {
            setPortfolioUrls(data.portfolio_urls);
          }
        }

        // Fetch existing service menu items
        const { data: serviceData } = await supabase
          .from('talent_services')
          .select('*')
          .eq('profile_id', user.id);

        if (serviceData) {
          setServices(serviceData);
        }
      } catch (err: any) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  // Handle Category Select
  const handleCategorySelect = (category: string) => {
    if (category !== selectedCategory) {
      setSelectedCategory(category);
      setSelectedGenres([]);
    }
  };

  // Toggle Genre / Specialty Pills
  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter((item) => item !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  // Upload Avatar Image
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(filePath);
      if (publicUrlData?.publicUrl) {
        setAvatarUrl(publicUrlData.publicUrl);
      }
    } catch (err: any) {
      alert('Failed to upload avatar: ' + err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Upload Cover Image
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/cover_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(filePath);
      if (publicUrlData?.publicUrl) {
        setCoverUrl(publicUrlData.publicUrl);
      }
    } catch (err: any) {
      alert('Failed to upload cover photo: ' + err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  // Add Item to Services Menu State
  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !newServicePrice) return;

    const newItem: ServiceItem = {
      service_name: newServiceName.trim(),
      price: parseFloat(newServicePrice) || 0,
      duration_minutes: newServiceDuration ? parseInt(newServiceDuration) : undefined,
    };

    setServices([...services, newItem]);
    setNewServiceName('');
    setNewServicePrice('');
    setNewServiceDuration('');
  };

  // Remove Item from Services Menu State
  const handleRemoveService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  // Handle Portfolio Image Upload using public 'media' bucket
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImage(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const uploadedList: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/portfolio_${Date.now()}_${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('media')
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          uploadedList.push(publicUrlData.publicUrl);
        }
      }

      setPortfolioUrls((prev) => [...prev, ...uploadedList]);
      setMessage({ type: 'success', text: 'Portfolio photos uploaded successfully!' });
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to upload portfolio image.' });
    } finally {
      setUploadingImage(false);
    }
  };

  // Remove Portfolio Image
  const handleRemoveImage = (urlToRemove: string) => {
    setPortfolioUrls(portfolioUrls.filter((url) => url !== urlToRemove));
  };

  // Save changes to Supabase updating host_profiles, artist_profiles, and talent_services
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        id: user.id,
        user_id: user.id,
        stage_name: stageName,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        category: selectedCategory,
        custom_rate_display: customRateDisplay,
        genres: selectedGenres,
        location: location,
        bio: bio,
        portfolio_urls: portfolioUrls,
        updated_at: new Date().toISOString(),
      };

      // 1. Update host_profiles
      const { error: hostError } = await supabase
        .from('host_profiles')
        .upsert(payload, { onConflict: 'id' });

      if (hostError) throw hostError;

      // 2. Sync directly into artist_profiles
      const { error: artistError } = await supabase
        .from('artist_profiles')
        .update({
          stage_name: stageName,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          custom_rate_display: customRateDisplay,
          bio: bio,
          location: location,
          categories: [selectedCategory],
          portfolio_urls: portfolioUrls,
        })
        .or(`id.eq.${user.id},user_id.eq.${user.id}`);

      if (artistError && artistError.code !== 'PGRST116') {
        console.warn('Could not update artist_profiles directly:', artistError.message);
      }

      // 3. Save Services & Rates Menu (Delete old, insert current)
      await supabase.from('talent_services').delete().eq('profile_id', user.id);

      if (services.length > 0) {
        const servicesPayload = services.map((s) => ({
          profile_id: user.id,
          service_name: s.service_name,
          price: s.price,
          duration_minutes: s.duration_minutes || null,
        }));

        const { error: serviceInsertError } = await supabase
          .from('talent_services')
          .insert(servicesPayload);

        if (serviceInsertError) throw serviceInsertError;
      }

      setMessage({ type: 'success', text: 'Profile and services menu updated successfully!' });
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save changes.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ink" />
      </div>
    );
  }

  const currentSpecialties = CATEGORY_SPECIALTIES[selectedCategory] || CATEGORY_SPECIALTIES['PHOTOGRAPHER'];

  return (
    <div className="min-h-screen bg-paper py-12 px-6 lg:px-12">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-line pb-6">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-ink-400 hover:text-ink uppercase tracking-wide-sm mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <h1 className="font-display text-3xl font-bold text-ink">Edit Artist Profile</h1>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-xs uppercase tracking-wide-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
          </button>
        </div>

        {/* Feedback Alert */}
        {message && (
          <div
            className={`p-4 border flex items-center gap-3 text-xs font-medium ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* Identity & Images Section */}
          <div className="space-y-6">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide-sm text-ink border-b border-line pb-2">
              Profile Identity & Photos
            </h2>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide-sm text-ink-400 mb-2">
                Stage / Display Name
              </label>
              <input
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                className="w-full bg-paper border border-line px-4 py-2.5 text-xs font-medium text-ink focus:outline-none focus:border-ink"
                placeholder="e.g. Zayn Toryish"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Avatar Upload */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide-sm text-ink-400 mb-2">
                  Profile Avatar
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-paper-200 border border-line overflow-hidden flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-ink-400" />
                    )}
                  </div>
                  <label className="btn-secondary px-4 py-2 text-xs uppercase tracking-wide-sm cursor-pointer border border-line bg-paper hover:border-ink">
                    {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Cover Photo Upload */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide-sm text-ink-400 mb-2">
                  Cover Photo
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-16 bg-paper-200 border border-line overflow-hidden flex items-center justify-center">
                    {coverUrl ? (
                      <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-ink-400" />
                    )}
                  </div>
                  <label className="btn-secondary px-4 py-2 text-xs uppercase tracking-wide-sm cursor-pointer border border-line bg-paper hover:border-ink">
                    {uploadingCover ? 'Uploading...' : 'Upload Cover'}
                    <input type="file" accept="image/*" onChange={handleCoverUpload} disabled={uploadingCover} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Categories Section */}
          <div className="space-y-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide-sm text-ink border-b border-line pb-2">
              Categories
            </h2>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategorySelect(cat)}
                    className={`px-4 py-2 text-xs font-semibold tracking-wider transition-all border ${
                      isSelected
                        ? 'bg-ink text-paper border-ink shadow-sm'
                        : 'bg-paper text-ink-500 border-line hover:border-ink-400'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* About / Bio Section */}
          <div className="space-y-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide-sm text-ink border-b border-line pb-2">
              About & Bio
            </h2>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide-sm text-ink-400 mb-2">
                Artist Bio / Tagline
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-paper border border-line p-3 text-xs font-medium text-ink focus:outline-none focus:border-ink resize-none"
                placeholder="Visual poetry for people who feel too much."
              />
            </div>
          </div>

          {/* Portfolio & Gallery Section */}
          <div className="space-y-4">
            <div className="border-b border-line pb-2 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide-sm text-ink">
                Gallery & Portfolio
              </h2>
              <span className="text-[10px] text-ink-400 uppercase tracking-wide-sm">
                {portfolioUrls.length} Photo(s)
              </span>
            </div>

            {portfolioUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                {portfolioUrls.map((url, idx) => (
                  <div key={idx} className="relative group aspect-square border border-line bg-paper overflow-hidden">
                    <img src={url} alt={`Portfolio ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(url)}
                      className="absolute top-2 right-2 p-1 bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="border-2 border-dashed border-line hover:border-ink/40 transition-all p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-paper">
              {uploadingImage ? (
                <Loader2 className="w-6 h-6 animate-spin text-ink" />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-ink-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide-sm text-ink">
                    Upload Portfolio Photos
                  </span>
                  <span className="text-[10px] text-ink-400">
                    PNG, JPG, or WEBP up to 10MB
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="hidden"
              />
            </label>
          </div>

          {/* Pricing & Rate Description */}
          <div className="space-y-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide-sm text-ink border-b border-line pb-2">
              Pricing & Rate Description
            </h2>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide-sm text-ink-400 mb-2">
                Custom General Rate Display (Tagline)
              </label>
              <input
                type="text"
                value={customRateDisplay}
                onChange={(e) => setCustomRateDisplay(e.target.value)}
                className="w-full bg-paper border border-line px-4 py-2.5 text-xs font-medium text-ink focus:outline-none focus:border-ink"
                placeholder="e.g. Starting from R150, Rates Vary by Item"
              />
            </div>
          </div>

          {/* Structured Services & Rates Menu Creator */}
          <div className="space-y-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide-sm text-ink border-b border-line pb-2">
              Services & Rates Menu (Add Item by Item)
            </h2>
            <p className="text-[11px] text-ink-500">
              Add individual services or assets with their specific prices (e.g., Braids — R400, BMW X5 — R100/day, Small Tattoo — R200).
            </p>

            {services.length > 0 && (
              <div className="divide-y divide-line border border-line bg-paper-100 mb-4">
                {services.map((service, index) => (
                  <div key={index} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-ink">{service.service_name}</span>
                      {service.duration_minutes && (
                        <span className="text-ink-400 ml-2">({service.duration_minutes} mins)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-ink">R{service.price}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 border border-line bg-paper-200">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  placeholder="Service / Asset Name (e.g. Braids / BMW X5)"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full bg-paper border border-line px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
                />
              </div>
              <div className="sm:col-span-3">
                <input
                  type="number"
                  placeholder="Price (ZAR)"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  className="w-full bg-paper border border-line px-3 py-2 text-xs text-ink focus:outline-none focus:border-ink"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={handleAddService}
                  className="w-full py-2 bg-ink text-paper text-xs font-semibold uppercase tracking-wide-sm hover:bg-ink-800 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
            </div>
          </div>

          {/* Dynamic Genres & Specialties Section */}
          <div className="space-y-4">
            <div className="border-b border-line pb-2 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold uppercase tracking-wide-sm text-ink">
                Genres / Specialties
              </h2>
              <span className="text-[10px] text-ink-400 uppercase tracking-wide-sm">
                Showing options for <strong className="text-ink">{selectedCategory}</strong>
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {currentSpecialties.map((item) => {
                const isSelected = selectedGenres.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleGenre(item)}
                    className={`px-3 py-1.5 text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-paper text-ink-500 border-line hover:border-ink-400'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location & Coverage */}
          <div className="space-y-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide-sm text-ink border-b border-line pb-2">
              Location & Coverage
            </h2>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide-sm text-ink-400 mb-2">
                City / Region
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-paper border border-line px-4 py-2 text-xs font-medium text-ink focus:outline-none focus:border-ink"
                placeholder="e.g. Cape Town, Western Cape"
              />
            </div>
          </div>

          {/* Footer Save Button */}
          <div className="pt-6 border-t border-line flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-xs uppercase tracking-wide-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Profile
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
