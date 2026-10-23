import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Calendar, MapPin, Loader2, PartyPopper, Plus, Filter, Send, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import CreateGigModal from '@/components/CreateGigModal';
import PitchGigModal from '@/components/PitchGigModal';

interface Gig {
  id: string;
  title: string;
  category: string;
  location: string;
  event_date: string;
  start_time?: string;
  duration_hours?: number;
  budget: number;
  description?: string;
  status: string;
  host_id: string;
  host?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface UserPitch {
  gig_id: string;
  status: 'pending' | 'shortlisted' | 'accepted' | 'declined';
  proposed_rate: number;
}

export default function GigFeedPage() {
  const { profile } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [userPitches, setUserPitches] = useState<Map<string, UserPitch>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Pitch Modal State
  const [selectedGigForPitch, setSelectedGigForPitch] = useState<Gig | null>(null);
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);

  const fetchGigsAndPitches = async () => {
    setLoading(true);
    try {
      // 1. Fetch open gigs
      const { data: gigData, error: gigErr } = await supabase
        .from('gigs')
        .select('*')
        .eq('status', 'open')
        .order('event_date', { ascending: true });

      if (gigErr) throw gigErr;

      if (gigData && gigData.length > 0) {
        const hostIds = Array.from(new Set(gigData.map((g) => g.host_id)));
        const { data: hostProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', hostIds);

        const hostMap = new Map((hostProfiles || []).map((hp) => [hp.id, hp]));

        setGigs(
          gigData.map((g) => ({
            ...g,
            host: hostMap.get(g.host_id) || { full_name: 'Event Host', avatar_url: null },
          }))
        );
      } else {
        setGigs([]);
      }

      // 2. Fetch logged-in user's pitches to map status onto cards
      if (profile?.id) {
        const { data: pitchData } = await supabase
          .from('gig_pitches')
          .select('gig_id, status, proposed_rate')
          .eq('artist_id', profile.id);

        if (pitchData) {
          const pitchMap = new Map<string, UserPitch>();
          pitchData.forEach((p) => {
            pitchMap.set(p.gig_id, p as UserPitch);
          });
          setUserPitches(pitchMap);
        }
      }
    } catch (err) {
      console.error('Error fetching gigs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGigsAndPitches();
  }, [profile?.id]);

  const categories = ['all', 'DJ', 'Live Band', 'MC', 'Photographer', 'Videographer', 'Dancer'];

  const filteredGigs = selectedCategory === 'all'
    ? gigs
    : gigs.filter((g) => g.category.toLowerCase() === selectedCategory.toLowerCase());

  const handleOpenPitchModal = (gig: Gig) => {
    if (!profile) {
      alert('Please log in to pitch for this gig.');
      return;
    }
    setSelectedGigForPitch(gig);
    setIsPitchModalOpen(true);
  };

  const renderPitchStatusBadge = (gig: Gig) => {
    const pitch = userPitches.get(gig.id);
    if (!pitch) return null;

    if (pitch.status === 'accepted') {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xs inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Pitch Accepted
        </span>
      );
    }

    if (pitch.status === 'shortlisted') {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-300 rounded-xs inline-flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Shortlisted
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-900 border border-purple-200 rounded-xs inline-flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-purple-700 animate-pulse" /> Pitch Submitted
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-paper py-12 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400 mb-1">— Community Opportunity Feed</p>
            <h1 className="font-display text-3xl font-bold text-ink">Gig Board & Event Opportunities</h1>
            <p className="text-xs text-ink-500 mt-1">Browse open gig calls posted by hosts or publish your own event opening.</p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-paper text-xs uppercase font-semibold tracking-wide-sm hover:bg-ink-800 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> Post a Gig
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-line">
          <Filter className="w-4 h-4 text-ink-400 shrink-0 ml-1 mr-2" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xs border transition-colors capitalize shrink-0 ${
                selectedCategory === cat 
                  ? 'bg-ink text-paper border-ink' 
                  : 'bg-paper-100 text-ink-600 border-line hover:border-ink'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Gig List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-ink animate-spin" />
          </div>
        ) : filteredGigs.length === 0 ? (
          <div className="border border-dashed border-line bg-paper-100 p-12 text-center space-y-3">
            <PartyPopper className="w-10 h-10 text-ink-300 mx-auto" />
            <h3 className="font-display font-bold text-ink text-lg">No open gigs found</h3>
            <p className="text-xs text-ink-500">Check back soon or post a new gig to invite talent applications.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredGigs.map((gig) => {
              const existingPitch = userPitches.get(gig.id);

              return (
                <div key={gig.id} className="border border-line bg-paper-100 p-6 space-y-4 shadow-xs flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 rounded-xs">
                          {gig.category}
                        </span>
                        {renderPitchStatusBadge(gig)}
                      </div>
                      <span className="font-display font-bold text-emerald-800 text-base">
                        R{gig.budget.toLocaleString()}
                      </span>
                    </div>

                    <h3 className="font-display text-xl font-bold text-ink">{gig.title}</h3>

                    {gig.description && (
                      <p className="text-xs text-ink-600 line-clamp-2 leading-relaxed bg-paper p-2.5 border border-line">
                        "{gig.description}"
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs text-ink-500 pt-2 border-t border-line">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-ink-400" />
                        <span>{new Date(gig.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-ink-400" />
                        <span className="truncate">{gig.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-line flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {gig.host?.avatar_url ? (
                        <img src={gig.host.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-line" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-[10px]">
                          {gig.host?.full_name?.[0]?.toUpperCase() || 'H'}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-ink">{gig.host?.full_name || 'Host'}</span>
                    </div>

                    <button
                      onClick={() => handleOpenPitchModal(gig)}
                      className={`px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                        existingPitch
                          ? 'bg-purple-900 text-white hover:bg-purple-950'
                          : 'bg-ink text-paper hover:bg-ink-800'
                      }`}
                    >
                      <Send className="w-3 h-3" />
                      {existingPitch ? 'Edit Submitted Pitch' : 'Pitch for Gig'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <CreateGigModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={fetchGigsAndPitches}
        />

        {selectedGigForPitch && (
          <PitchGigModal
            isOpen={isPitchModalOpen}
            onClose={() => {
              setIsPitchModalOpen(false);
              setSelectedGigForPitch(null);
            }}
            gigId={selectedGigForPitch.id}
            gigTitle={selectedGigForPitch.title}
            eventDate={selectedGigForPitch.event_date}
            startTime={selectedGigForPitch.start_time}
            durationHours={selectedGigForPitch.duration_hours}
            location={selectedGigForPitch.location}
            hostId={selectedGigForPitch.host_id}
            hostName={selectedGigForPitch.host?.full_name}
            hostAvatar={selectedGigForPitch.host?.avatar_url}
            suggestedBudget={selectedGigForPitch.budget}
            onSuccess={fetchGigsAndPitches}
          />
        )}

      </div>
    </div>
  );
}
