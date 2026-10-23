import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { X, Loader2, Sparkles, Calendar, MapPin, Users, ArrowRight, CheckCircle2, FileAudio, ExternalLink, ShieldAlert, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HostGig {
  id: string;
  title: string;
  category: string;
  location: string;
  event_date: string;
  budget: number;
  pitch_count: number;
}

interface PitchItem {
  id: string;
  gig_id: string;
  artist_id: string;
  proposed_rate: number;
  available_time_slot: string;
  equipment_offered?: string;
  pitch_message: string;
  media_urls?: string[];
  status: 'pending' | 'shortlisted' | 'accepted' | 'declined';
  created_at: string;
  artist?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    location: string;
    artist_profile?: {
      category?: string;
      bio?: string;
      starting_price?: number;
    } | null;
  };
}

interface HostPitchesSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function HostPitchesSelectorModal({
  isOpen,
  onClose,
  onSuccess,
}: HostPitchesSelectorModalProps) {
  const { profile } = useAuth();
  const [hostGigs, setHostGigs] = useState<HostGig[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGig, setSelectedGig] = useState<HostGig | null>(null);
  const [pitches, setPitches] = useState<PitchItem[]>([]);
  const [loadingPitches, setLoadingPitches] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchHostGigs = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      const { data: gigs, error } = await supabase
        .from('gigs')
        .select('*')
        .eq('host_id', profile.id)
        .order('event_date', { ascending: true });

      if (error) throw error;

      if (gigs && gigs.length > 0) {
        const gigIds = gigs.map((g) => g.id);

        const { data: pitchCounts } = await supabase
          .from('gig_pitches')
          .select('gig_id');

        const pitchMap = new Map<string, number>();
        (pitchCounts || []).forEach((p) => {
          if (gigIds.includes(p.gig_id)) {
            pitchMap.set(p.gig_id, (pitchMap.get(p.gig_id) || 0) + 1);
          }
        });

        setHostGigs(
          gigs.map((g) => ({
            ...g,
            pitch_count: pitchMap.get(g.id) || 0,
          }))
        );
      } else {
        setHostGigs([]);
      }
    } catch (err) {
      console.error('Error fetching host gigs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPitchesForGig = async (gig: HostGig) => {
    setSelectedGig(gig);
    setLoadingPitches(true);

    try {
      const { data, error } = await supabase
        .from('gig_pitches')
        .select('*')
        .eq('gig_id', gig.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const artistIds = Array.from(new Set(data.map((p) => p.artist_id)));
        
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, location')
          .in('id', artistIds);

        const profileMap = new Map((profilesData || []).map((ap) => [ap.id, ap]));

        const { data: artistProfilesData } = await supabase
          .from('artist_profiles')
          .select('user_id, category, bio, starting_price')
          .in('user_id', artistIds);

        const artistProfileMap = new Map((artistProfilesData || []).map((ap) => [ap.user_id, ap]));

        const formattedPitches: PitchItem[] = data.map((p) => ({
          ...p,
          artist: {
            ...(profileMap.get(p.artist_id) || { full_name: 'Artist Talent', avatar_url: null, location: '' }),
            artist_profile: artistProfileMap.get(p.artist_id) || null,
          },
        }));

        setPitches(formattedPitches);
      } else {
        setPitches([]);
      }
    } catch (err) {
      console.error('Error fetching pitches:', err);
    } finally {
      setLoadingPitches(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHostGigs();
      setSelectedGig(null);
    }
  }, [isOpen, profile?.id]);

  if (!isOpen) return null;

  const updatePitchStatus = async (pitchId: string, newStatus: 'shortlisted' | 'accepted' | 'declined') => {
    setUpdatingId(pitchId);
    try {
      const { error } = await supabase
        .from('gig_pitches')
        .update({ status: newStatus })
        .eq('id', pitchId);

      if (error) throw error;

      if (newStatus === 'accepted') {
        const acceptedPitch = pitches.find((p) => p.id === pitchId);
        if (acceptedPitch && selectedGig) {
          await supabase.from('bookings').insert({
            client_id: profile?.id,
            host_id: profile?.id,
            artist_id: acceptedPitch.artist_id,
            event_name: selectedGig.title,
            event_date: selectedGig.event_date,
            location: selectedGig.location,
            total_price: acceptedPitch.proposed_rate,
            status: 'pending',
            notes: `Accepted via Gig Pitch Dossier: ${acceptedPitch.pitch_message}`,
          });
        }
        alert('Pitch accepted successfully! Official booking created.');
      }

      setPitches((prev) =>
        prev.map((p) => (p.id === pitchId ? { ...p, status: newStatus } : p))
      );

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert(`Could not update pitch status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-paper border border-line p-6 max-w-3xl w-full relative shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-ink-400 hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {!selectedGig ? (
          <>
            <div>
              <div className="flex items-center gap-2 text-purple-900 bg-purple-100 border border-purple-200 px-2.5 py-1 w-fit text-[10px] font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3 h-3 text-purple-700" /> Host Dashboard — Incoming Pitches
              </div>
              <h2 className="font-display text-2xl font-bold text-ink">Review Posted Gig Opportunities</h2>
              <p className="text-xs text-ink-500 mt-0.5">
                Select one of your open gigs below to evaluate incoming talent pitch sheets and statuses.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-purple-800 animate-spin" />
              </div>
            ) : hostGigs.length === 0 ? (
              <div className="border border-dashed border-line bg-paper-100 p-10 text-center space-y-2">
                <p className="font-display font-bold text-ink text-base">You haven't posted any gigs yet</p>
                <p className="text-xs text-ink-500">Post an event opening using "+ Post a Gig" to receive talent pitches!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {hostGigs.map((gig) => (
                  <div
                    key={gig.id}
                    onClick={() => fetchPitchesForGig(gig)}
                    className="border border-line bg-paper p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-ink transition-all cursor-pointer group shadow-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
                          {gig.category}
                        </span>
                        <span className="font-bold text-emerald-800 text-xs">
                          Budget: R{gig.budget.toLocaleString()}
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-ink text-base group-hover:underline">{gig.title}</h3>

                      <div className="flex items-center gap-4 text-xs text-ink-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-purple-700" />
                          {new Date(gig.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-purple-700" />
                          {gig.location}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-line">
                      <div className="flex items-center gap-1.5 bg-purple-50 text-purple-900 border border-purple-200 px-3 py-1.5 rounded-xs font-bold text-xs">
                        <Users className="w-3.5 h-3.5 text-purple-700" />
                        <span>{gig.pitch_count} {gig.pitch_count === 1 ? 'Pitch' : 'Pitches'} Received</span>
                      </div>

                      <button
                        type="button"
                        className="px-3.5 py-1.5 bg-ink text-paper text-xs font-semibold uppercase tracking-wide-sm group-hover:bg-ink-800 transition-colors inline-flex items-center gap-1"
                      >
                        Review <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedGig(null)}
                  className="text-xs font-bold uppercase tracking-wide-sm text-purple-900 hover:underline mb-1 inline-flex items-center gap-1"
                >
                  ← Back to My Gigs
                </button>
                <h2 className="font-display text-2xl font-bold text-ink">{selectedGig.title}</h2>
                <p className="text-xs text-ink-500">Reviewing incoming artist submissions & statuses.</p>
              </div>
            </div>

            {loadingPitches ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-purple-800 animate-spin" />
              </div>
            ) : pitches.length === 0 ? (
              <div className="border border-dashed border-line bg-paper-100 p-12 text-center space-y-2">
                <p className="font-display font-bold text-ink text-base">No pitches submitted yet for this gig</p>
                <p className="text-xs text-ink-500">Talent proposals will appear here as soon as artists submit pitch sheets.</p>
              </div>
            ) : (
              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
                {pitches.map((pitch) => (
                  <div key={pitch.id} className="border border-line bg-paper p-5 space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                      <div className="flex items-center gap-3">
                        <Link to={`/artists/${pitch.artist_id}`} className="group">
                          {pitch.artist?.avatar_url ? (
                            <img src={pitch.artist.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-line" />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-xs">
                              {pitch.artist?.full_name?.[0]?.toUpperCase() || 'A'}
                            </div>
                          )}
                        </Link>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link to={`/artists/${pitch.artist_id}`} className="font-display font-bold text-ink hover:underline">
                              {pitch.artist?.full_name || 'Artist Talent'}
                            </Link>
                            <span className="text-[10px] font-bold uppercase bg-purple-100 text-purple-900 px-2 py-0.5 border border-purple-200">
                              {pitch.artist?.artist_profile?.category || 'Talent'}
                            </span>
                          </div>
                          <p className="text-xs text-ink-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {pitch.artist?.location || 'Location not specified'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-ink-400 block">Proposed Rate</span>
                          <span className="font-display font-bold text-emerald-800 text-lg">
                            R{pitch.proposed_rate.toLocaleString()}
                          </span>
                        </div>

                        {/* CLEAR STATUS BADGE FOR HOST */}
                        {pitch.status === 'accepted' && (
                          <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xs inline-flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Accepted & Booked
                          </span>
                        )}
                        {pitch.status === 'shortlisted' && (
                          <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300 rounded-xs inline-flex items-center gap-1 shadow-xs">
                            <Sparkles className="w-4 h-4 text-blue-700" /> Shortlisted
                          </span>
                        )}
                        {pitch.status === 'declined' && (
                          <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-900 border border-red-300 rounded-xs inline-flex items-center gap-1 shadow-xs">
                            <ShieldAlert className="w-4 h-4 text-red-700" /> Declined
                          </span>
                        )}
                        {pitch.status === 'pending' && (
                          <span className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 rounded-xs inline-flex items-center gap-1 shadow-xs">
                            <Clock className="w-4 h-4 text-purple-700 animate-pulse" /> Pending Review
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-paper-100 p-3 border border-line">
                      <div>
                        <span className="text-ink-400 uppercase font-bold tracking-wide-sm block mb-0.5">Availability Slot</span>
                        <span className="font-semibold text-ink">{pitch.available_time_slot}</span>
                      </div>
                      <div>
                        <span className="text-ink-400 uppercase font-bold tracking-wide-sm block mb-0.5">Equipment Offered</span>
                        <span className="font-semibold text-ink">{pitch.equipment_offered || 'None specified'}</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <span className="text-ink-400 uppercase font-bold tracking-wide-sm block">Pitch Message & Set Hook</span>
                      <p className="text-ink-700 bg-paper-100 p-3 border border-line italic leading-relaxed">
                        "{pitch.pitch_message}"
                      </p>
                    </div>

                    {pitch.media_urls && pitch.media_urls.length > 0 && (
                      <div className="space-y-2 text-xs">
                        <span className="text-ink-400 uppercase font-bold tracking-wide-sm block">Attached Showcase Media</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {pitch.media_urls.map((url, idx) => {
                            const fileName = decodeURIComponent(url.split('/').pop() || `Media ${idx + 1}`);
                            return (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-2.5 bg-paper-100 border border-line hover:border-ink transition-colors group"
                              >
                                <div className="flex items-center gap-2 truncate pr-2">
                                  <FileAudio className="w-4 h-4 text-purple-700 shrink-0" />
                                  <span className="truncate font-medium text-ink group-hover:underline">{fileName}</span>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-line flex items-center justify-between flex-wrap gap-2">
                      <Link
                        to={`/artists/${pitch.artist_id}`}
                        className="text-xs font-semibold text-ink hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Artist Full Profile
                      </Link>

                      <div className="flex items-center gap-2">
                        {pitch.status !== 'declined' && (
                          <button
                            type="button"
                            onClick={() => updatePitchStatus(pitch.id, 'declined')}
                            disabled={updatingId === pitch.id}
                            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide-sm text-red-600 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            Decline
                          </button>
                        )}

                        {pitch.status !== 'shortlisted' && pitch.status !== 'accepted' && (
                          <button
                            type="button"
                            onClick={() => updatePitchStatus(pitch.id, 'shortlisted')}
                            disabled={updatingId === pitch.id}
                            className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide-sm bg-blue-100 text-blue-900 border border-blue-200 hover:bg-blue-200 transition-colors cursor-pointer"
                          >
                            Shortlist
                          </button>
                        )}

                        {pitch.status !== 'accepted' && (
                          <button
                            type="button"
                            onClick={() => updatePitchStatus(pitch.id, 'accepted')}
                            disabled={updatingId === pitch.id}
                            className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide-sm bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            {updatingId === pitch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Accept Pitch & Book
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-paper-100 border border-line text-ink text-xs font-semibold uppercase tracking-wide-sm hover:border-ink cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
