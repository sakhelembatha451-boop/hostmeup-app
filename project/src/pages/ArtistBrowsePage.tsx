import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { MapPin, Loader2, Music2 } from 'lucide-react';
import type { Category } from '@/types';

const CATEGORIES: { label: string; value: Category | 'ALL' }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'VOCALIST', value: 'Singer' },
  { label: 'PRODUCER', value: 'Producer' },
  { label: 'PERFORMER / DJ', value: 'Performer' },
  { label: 'BEAUTY', value: 'Beauty Professional' },
  { label: 'MODEL', value: 'Model' },
  { label: 'PHOTOGRAPHER', value: 'Photographer' },
];

export default function ArtistsPage() {
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'ALL'>('ALL');
  const [locationSearch, setLocationSearch] = useState('');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');

  useEffect(() => {
    fetchArtists();
  }, [selectedCategory, locationSearch, minRate, maxRate]);

  const fetchArtists = async () => {
    try {
      setLoading(true);
      let query = supabase.from('artist_profiles').select('*');

      if (selectedCategory !== 'ALL') {
        query = query.or(`categories.cs.{${selectedCategory}},categories.cs.{${selectedCategory.toLowerCase()}}`);
      }

      if (locationSearch.trim()) {
        const search = locationSearch.trim();
        query = query.or(`location_city.ilike.%${search}%,location_province.ilike.%${search}%`);
      }

      const minVal = parseFloat(minRate);
      if (!isNaN(minVal) && minVal > 0) {
        query = query.gte('hourly_rate', minVal);
      }

      const maxVal = parseFloat(maxRate);
      if (!isNaN(maxVal) && maxVal > 0) {
        query = query.lte('hourly_rate', maxVal);
      }

      const { data, error } = await query;
      if (error) throw error;

      setArtists(data || []);
    } catch (err: any) {
      console.error('Error fetching artists:', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper py-12 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto">
        {/* Category Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 border-b border-line no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 text-xs uppercase tracking-wide-sm whitespace-nowrap border transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-ink-600 border-line hover:border-ink'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 bg-paper-100 p-4 border border-line">
          <div>
            <label className="block text-[10px] uppercase tracking-wide-sm text-ink-400 mb-1">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input
                type="text"
                placeholder="City or state"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="input-field pl-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide-sm text-ink-400 mb-1">Min Rate (ZAR)</label>
            <input
              type="number"
              placeholder="0"
              value={minRate}
              onChange={(e) => setMinRate(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wide-sm text-ink-400 mb-1">Max Rate (ZAR)</label>
            <input
              type="number"
              placeholder="Any"
              value={maxRate}
              onChange={(e) => setMaxRate(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* Artist Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-ink-400" />
          </div>
        ) : artists.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-line">
            <Music2 className="w-10 h-10 text-ink-300 mx-auto mb-3" />
            <h3 className="font-display text-lg font-bold text-ink">No talent found</h3>
            <p className="text-xs text-ink-500 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {artists.map((artist) => (
              <Link
                key={artist.id}
                to={`/artists/${artist.id}`}
                className="group border border-line bg-paper hover:border-ink transition-colors overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] bg-paper-200 relative overflow-hidden">
                  {artist.cover_url || artist.avatar_url ? (
                    <img
                      src={artist.cover_url || artist.avatar_url}
                      alt={artist.stage_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-paper-200 text-ink-400">
                      <Music2 className="w-8 h-8" />
                    </div>
                  )}
                  {artist.hourly_rate && (
                    <div className="absolute top-3 right-3 bg-ink text-paper text-xs px-2.5 py-1 font-semibold">
                      R{artist.hourly_rate}/hr
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display text-xl font-bold text-ink group-hover:underline">
                      {artist.stage_name || 'Unnamed Artist'}
                    </h3>
                    <p className="text-xs text-ink-500 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {artist.location_city ? `${artist.location_city}, ${artist.location_province || 'ZA'}` : 'Location not specified'}
                    </p>
                    {artist.bio && (
                      <p className="text-xs text-ink-600 mt-3 line-clamp-2 leading-relaxed">
                        {artist.bio}
                      </p>
                    )}
                  </div>

                  {artist.categories && artist.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-line">
                      {artist.categories.map((cat: string) => (
                        <span key={cat} className="text-[10px] uppercase tracking-wide-sm bg-paper-200 px-2 py-0.5 text-ink-600">
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
