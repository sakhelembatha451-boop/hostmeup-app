import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Search, MapPin, Loader2, Users, DollarSign, ArrowUpRight } from 'lucide-react';
import type { ArtistWithProfile, TalentCategory } from '@/types';
import { CATEGORY_ICONS, CATEGORY_SHORT_LABELS, CATEGORY_LIST } from '@/lib/categories';
import { Tag } from '@/components/UI';

export default function ArtistBrowsePage() {
  const [artists, setArtists] = useState<ArtistWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TalentCategory | ''>('');
  const [rateMin, setRateMin] = useState('');
  const [rateMax, setRateMax] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const loadArtists = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select(`*, artist_profile:artist_profiles(*)`)
      .eq('role', 'artist');
    if (error) { setArtists([]); }
    else {
      let filtered = (data as ArtistWithProfile[]) || [];
      if (search.trim()) {
        const q = search.toLowerCase();
        filtered = filtered.filter((a) =>
          a.full_name?.toLowerCase().includes(q) ||
          a.artist_profile?.stage_name?.toLowerCase().includes(q) ||
          a.location?.toLowerCase().includes(q)
        );
      }
      if (categoryFilter) filtered = filtered.filter((a) => a.artist_profile?.talent_category === categoryFilter);
      if (locationFilter.trim()) {
        const loc = locationFilter.toLowerCase();
        filtered = filtered.filter((a) => a.location?.toLowerCase().includes(loc));
      }
      if (rateMin) {
        const min = parseFloat(rateMin);
        filtered = filtered.filter((a) => a.artist_profile?.base_rate != null && a.artist_profile.base_rate >= min);
      }
      if (rateMax) {
        const max = parseFloat(rateMax);
        filtered = filtered.filter((a) => a.artist_profile?.base_rate != null && a.artist_profile.base_rate <= max);
      }
      setArtists(filtered);
    }
    setLoading(false);
  }, [search, categoryFilter, locationFilter, rateMin, rateMax]);

  useEffect(() => { loadArtists(); }, [loadArtists]);

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <div className="border-b border-line">
        <div className="max-w-editorial mx-auto px-6 lg:px-12 py-16">
          <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-4">— Directory</p>
          <h1 className="font-display text-5xl lg:text-6xl font-bold text-ink mb-4">Browse Talent</h1>
          <p className="text-lg text-ink-500 max-w-xl">Discover creative professionals for your next event.</p>
        </div>
      </div>

      <div className="max-w-editorial mx-auto px-6 lg:px-12 py-10">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-300" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, stage name, or location..."
            className="input-editorial w-full pl-9 pr-4 py-3.5 text-sm" />
        </div>

        {/* Filters */}
        <div className="border-y border-line py-6 mb-10">
          {/* Categories */}
          <div className="mb-5">
            <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-3">Category</label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCategoryFilter('')} className={`filter-chip ${categoryFilter === '' ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
                All
              </button>
              {CATEGORY_LIST.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.value];
                return (
                  <button key={cat.value} onClick={() => setCategoryFilter(categoryFilter === cat.value ? '' : cat.value)}
                    className={`filter-chip inline-flex items-center gap-1.5 ${categoryFilter === cat.value ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
                    <Icon className="w-3 h-3" />
                    {cat.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location & rate */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Location</label>
              <div className="relative">
                <MapPin className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                <input type="text" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="City or state" className="input-editorial w-full pl-7 pr-3 py-2.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Min Rate ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                <input type="number" min="0" value={rateMin} onChange={(e) => setRateMin(e.target.value)}
                  placeholder="0" className="input-editorial w-full pl-7 pr-3 py-2.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Max Rate ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                <input type="number" min="0" value={rateMax} onChange={(e) => setRateMax(e.target.value)}
                  placeholder="Any" className="input-editorial w-full pl-7 pr-3 py-2.5 text-sm" />
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>
        ) : artists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 border border-line flex items-center justify-center text-ink-300 mb-6"><Users className="w-7 h-7" /></div>
            <h3 className="font-display text-xl text-ink mb-1">No talent found</h3>
            <p className="text-sm text-ink-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-6">{artists.length} {artists.length === 1 ? 'result' : 'results'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
              {artists.map((artist, i) => {
                const ap = artist.artist_profile;
                const CatIcon = ap ? CATEGORY_ICONS[ap.talent_category] : null;
                return (
                  <Link key={artist.id} to={`/artists/${artist.id}`} aria-label={`View ${artist?.full_name || 'talent'} profile`} className="group block animate-fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
                    {/* Image */}
                    <div className="relative overflow-hidden bg-paper-300 mb-4 aspect-[3/4]">
                      {ap?.media_urls?.[0] ? (
                        <img src={ap.media_urls[0]} alt={`Portfolio photo of ${ap?.stage_name || artist.full_name || 'talent'}`} width={600} height={800} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">{CatIcon ? <CatIcon className="w-10 h-10 text-ink-200" /> : null}</div>
                      )}
                      {/* Category label */}
                      {ap && (
                        <div className="absolute top-3 left-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-paper/90 backdrop-blur-sm text-xs font-medium uppercase tracking-wide-sm text-ink">
                            {CatIcon && <CatIcon className="w-3 h-3" />}
                            {CATEGORY_SHORT_LABELS[ap.talent_category]}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-display text-xl font-semibold text-ink group-hover:text-accent transition-colors truncate">
                          {ap?.stage_name || artist.full_name}
                        </h3>
                        {artist.location && <p className="text-sm text-ink-400 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{artist.location}</p>}
                      </div>
                      {ap?.base_rate != null && (
                        <div className="text-right flex-shrink-0">
                          <span className="font-display text-lg font-semibold text-ink">${ap.base_rate}</span>
                          <span className="text-xs text-ink-300">/{ap.rate_unit}</span>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {ap?.performance_roles && ap.performance_roles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {ap.performance_roles.slice(0, 3).map((r) => <Tag key={r} label={r} />)}
                      </div>
                    )}

                    <div className="mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-wide-sm text-ink-300 group-hover:text-accent transition-colors">
                      View Profile <ArrowUpRight className="w-3 h-3" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
