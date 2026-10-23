import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, MapPin, Loader2, PartyPopper, Plus, Filter, Send, 
  CheckCircle2, Clock, Sparkles, ExternalLink, Users, ShieldAlert 
} from 'lucide-react';
import CreateGigModal from '@/components/CreateGigModal';
import PitchGigModal from '@/components/PitchGigModal';
import HostPitchesSelectorModal from '@/components/HostPitchesSelectorModal';

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

interface HostGigStatusSummary {
  hasAccepted: boolean;
  hasShortlisted: boolean;
  totalPitches: number;
}

export default function GigFeedPage() {
  const { profile } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [userPitches, setUserPitches] = useState<Map<string, UserPitch>>(new Map());
  const [hostGigStatuses, setHostGigStatuses] = useState<Map<string, HostGigStatusSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isHostPitchesModalOpen, setIsHostPitchesModalOpen] = useState(false);

  // Pitch Modal State
  const [selectedGigForPitch, setSelectedGigForPitch] = useState<Gig | null>(null);
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);

  const fetchGigsAndPitches = async () => {
    setLoading(true);
    try {
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

        // Fetch all pitches to compute host gig statuses
        const gigIds = gigData.map((g) => g.id);
        const { data: allPitches } = await supabase
          .from('gig_pitches')
          .select('gig_id, status')
          .in('gig_id', gigIds);

        if (allPitches) {
          const statusMap = new Map<string, HostGigStatusSummary>();
          gigIds.forEach((id) => {
            const pitchesForThisGig = allPitches.filter((p) => p.gig_id === id);
            statusMap.set(id, {
              hasAccepted: pitchesForThisGig.some((p) => p.status === 'accepted'),
              hasShortlisted: pitchesForThisGig.some((p) => p.status === 'shortlisted'),
              totalPitches: pitchesForThisGig.length,
            });
          });
          setHostGigStatuses(statusMap);
        }
      } else {
        setGigs([]);
      }

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

  const handleOpenPitchModal = (gig: Gig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

    if (pitch.status === 'declined') {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-800 border border-red-200 rounded-xs inline-flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-red-600" /> Declined
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-900 border border-purple-200 rounded-xs inline-flex items-center gap-1">
        <Clock className="w-3.5 h-3.5 text-purple-700 animate-pulse" /> Pitch Submitted
      </span>
    );
  };

  const renderHostGigStatusBadge = (gigId: string) => {
    const summary = hostGigStatuses.get(gigId);
    if (!summary || summary.totalPitches === 0) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-paper-100 text-ink-500 border border-line rounded-xs">
          No Pitches Yet
        </span>
      );
    }

    if (summary.hasAccepted) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xs inline-flex items-center gap-1 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Talent Booked
        </span>
      );
    }

    if (summary.hasShortlisted) {
      return (
        <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300 rounded-xs inline-flex items-center gap-1 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-700" /> Talent Shortlisted
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 rounded-xs inline-flex items-center gap-1 shadow-xs">
        <Users className="w-3.5 h-3.5 text-purple-700" /> {summary.totalPitches} {summary.totalPitches === 1 ? 'Pitch' : 'Pitches'} Pending
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

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!profile) {
                  alert('Please log in to review pitches for your gigs.');
                  return;
                }
                setIsHostPitchesModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-900 text-white text-xs uppercase font-semibold tracking-wide-sm hover:bg-purple-950 transition-colors shadow-xs cursor-pointer"
            >
              <Users className="w-4 h-4 text-purple-300" /> Review Pitches
            </button>

            <button
              onClick={() => {
                if (!profile) {
                  alert('Please log in to post a gig.');
                  return;
                }
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-ink text-paper text-xs uppercase font-semibold tracking-wide-sm hover:bg-ink-800 transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Post a Gig
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-line">
          <Filter className="w-4 h-4 text-ink-400 shrink-0 ml-1 mr-2" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xs border transition-colors capitalize shrink-0 cursor-pointer ${
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
              const isHostOfThisGig = profile?.id === gig.host_id;

              return (
                <div key={gig.id} className="border border-line bg-paper-100 p-6 space-y-4 shadow-xs flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 rounded-xs">
                          {gig.category}
                        </span>
                        {!isHostOfThisGig && renderPitchStatusBadge(gig)}
                        {isHostOfThisGig && renderHostGigStatusBadge(gig.id)}
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

                    <div className="grid grid-cols-2 gap-2 text-xs text-ink-600 pt-2 border-t border-line">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <span>{new Date(gig.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <span>Start: {gig.start_time || 'Flexible'}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <span className="truncate">{gig.location}</span>
                      </div>

                      {gig.duration_hours && (
                        <div className="flex items-center gap-1.5 font-medium text-purple-900">
                          <Sparkles className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                          <span>Duration: {gig.duration_hours} hrs</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-line flex items-center justify-between">
                    <Link
                      to={`/hosts/${gig.host_id}`}
                      className="flex items-center gap-2 group"
                    >
                      {gig.host?.avatar_url ? (
                        <img src={gig.host.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-line group-hover:opacity-80 transition-opacity" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-[10px] group-hover:bg-ink-800 transition-colors">
                          {gig.host?.full_name?.[0]?.toUpperCase() || 'H'}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-ink group-hover:underline flex items-center gap-1">
                        {gig.host?.full_name || 'Host'}
                        <ExternalLink className="w-3 h-3 text-ink-400 group-hover:text-ink" />
                      </span>
                    </Link>

                    {isHostOfThisGig ? (
                      <button
                        type="button"
                        onClick={() => setIsHostPitchesModalOpen(true)}
                        className="px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide-sm inline-flex items-center gap-1.5 bg-purple-900 text-white hover:bg-purple-950 transition-colors cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" /> Manage Pitches
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleOpenPitchModal(gig, e)}
                        className={`px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          existingPitch
                            ? 'bg-purple-900 text-white hover:bg-purple-950'
                            : 'bg-ink text-paper hover:bg-ink-800'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        {existingPitch ? 'Edit Submitted Pitch' : 'Pitch for Gig'}
                      </button>
                    )}
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

        {isHostPitchesModalOpen && (
          <HostPitchesSelectorModal
            isOpen={isHostPitchesModalOpen}
            onClose={() => setIsHostPitchesModalOpen(false)}
            onSuccess={fetchGigsAndPitches}
          />
        )}

        {isPitchModalOpen && selectedGigForPitch && (
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
