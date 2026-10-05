import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2, Save, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

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

export default function ArtistProfileEdit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<string>('PHOTOGRAPHER');
  const [pricingStructure, setPricingStructure] = useState<'per_hour' | 'per_event'>('per_hour');
  const [hourlyRate, setHourlyRate] = useState<string>('350');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [location, setLocation] = useState<string>('');

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
          if (data.category) setSelectedCategory(data.category.toUpperCase());
          if (data.pricing_type) setPricingStructure(data.pricing_type);
          if (data.hourly_rate) setHourlyRate(String(data.hourly_rate));
          if (data.genres && Array.isArray(data.genres)) setSelectedGenres(data.genres);
          if (data.location) setLocation(data.location);
        }
      } catch (err: any) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  // Handle Switching Main Category
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

  // Save changes cleanly using user_id constraint
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        user_id: user.id,
        category: selectedCategory,
        pricing_type: pricingStructure,
        hourly_rate: parseFloat(hourlyRate) || 0,
        genres: selectedGenres,
        location: location,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('host_profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
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

          {/* Pricing & Rates */}
          <div className="space-y-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide-sm text-ink border-b border-line pb-2">
              Pricing & Rates
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide-sm text-ink-400 mb-2">
                  Pricing Structure
                </label>
                <div className="flex items-center gap-6 pt-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                    <input
                      type="radio"
                      name="pricing_structure"
                      value="per_hour"
                      checked={pricingStructure === 'per_hour'}
                      onChange={() => setPricingStructure('per_hour')}
                      className="accent-ink"
                    />
                    PER HOUR
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                    <input
                      type="radio"
                      name="pricing_structure"
                      value="per_event"
                      checked={pricingStructure === 'per_event'}
                      onChange={() => setPricingStructure('per_event')}
                      className="accent-ink"
                    />
                    PER GIG / EVENT
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide-sm text-ink-400 mb-2">
                  Rate (ZAR)
                </label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full bg-paper border border-line px-4 py-2 text-xs font-medium text-ink focus:outline-none focus:border-ink"
                  placeholder="350"
                  required
                />
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
