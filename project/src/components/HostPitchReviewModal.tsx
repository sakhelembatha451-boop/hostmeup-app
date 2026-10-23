import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { 
  X, Loader2, CheckCircle2, Clock, Sparkles, MapPin, 
  FileAudio, FileVideo, Image as ImageIcon, ExternalLink 
} from 'lucide-react';

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

interface HostPitchReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigId: string;
  gigTitle: string;
  onSuccess?: () => void;
}

export default function HostPitchReviewModal({
  isOpen,
  onClose,
  gigId,
  gigTitle,
  onSuccess,
}: HostPitchReviewModalProps) {
  const [pitches, setPitches] = useState<PitchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchPitches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gig_pitches')
        .select('*')
        .eq('gig_id', gigId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const artistIds = Array.from(new Set(data.map((p) => p.artist_id)));
        
        // Fetch profile details
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, location')
          .in('id', artistIds);

        const profileMap = new Map((profilesData || []).map((ap) => [ap.id, ap]));

        // Fetch artist profile details
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
      console.error('Error fetching pitches for gig:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && gigId) {
      fetchPitches();
    }
  }, [isOpen, gigId]);

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
        if (acceptedPitch) {
          const { data: gigData } = await supabase
            .from('gigs')
            .select('*')
            .eq('id', gigId)
            .single();

          if (gigData) {
            await supabase.from('bookings').insert({
              client_id: gigData.host_id,
              host_id: gigData.host_id,
              artist_id: acceptedPitch.artist_id,
              event_name: gigData.title,
              event_date: gigData.event_date,
              start_time: gigData.start_time,
              duration_hours: gigData.duration_hours,
              location: gigData.location,
              total_price: acceptedPitch.proposed_rate,
              status: 'pending',
              notes: `Accepted via Gig Pitch Dossier: ${acceptedPitch.pitch_message}`,
            });
          }
        }
        alert('Pitch accepted successfully! An official booking request has been created for this artist.');
      }

      await fetchPitches();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error updating pitch status:', err);
      alert(`Could not update pitch status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const renderFileIcon = (url: string) => {
    const lower = url.toLowerCase();
    if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a')) {
      return <FileAudio className="w-4 h-4 text-purple-700 shrink-0" />;
    }
    if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) {
      return <FileVideo className="w-4 h-4 text-blue-700 shrink-0" />;
    }
    return <ImageIcon className="w-4 h-4 text-emerald-700 shrink-0" />;
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

        <div>
          <div className="flex items-center gap-2 text-purple-950 bg-purple-100 border border-purple-200 px-2.5 py-1 w-fit text-[10px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-purple-700" /> Host Pitch Review Dossier
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">{gigTitle}</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Compare incoming artist pitch sheets, rates, gear specifications, and listen/view attached showcase media.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-purple-800 animate-spin" />
          </div>
        ) : pitches.length === 0 ? (
          <div className="border border-dashed border-line bg-paper-100 p-12 text-center space-y-3">
            <Clock className="w-8 h-8 text-ink-300 mx-auto" />
            <h3 className="font-display font-bold text-ink text-base">No pitches submitted yet</h3>
            <p className="text-xs text-ink-500">Talent providers will appear here as soon as they submit a pitch for this gig.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pitches.map((pitch) => (
              <div key={pitch.id} className="border border-line bg-paper-100 p-5 space-y-4 shadow-xs">
                
                {/* Artist Header & Rate */}
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

                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-xs ${
                      pitch.status === 'accepted'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : pitch.status === 'shortlisted'
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : pitch.status === 'declined'
                        ? 'bg-red-50 text-red-800 border-red-200'
                        : 'bg-purple-50 text-purple-900 border-purple-200'
                    }`}>
                      {pitch.status}
                    </span>
                  </div>
                </div>

                {/* Availability & Gear Specs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-paper p-3 border border-line">
                  <div>
                    <span className="text-ink-400 uppercase font-bold tracking-wide-sm block mb-0.5">Availability Slot</span>
                    <span className="font-semibold text-ink">{pitch.available_time_slot}</span>
                  </div>
                  <div>
                    <span className="text-ink-400 uppercase font-bold tracking-wide-sm block mb-0.5">Equipment Offered</span>
                    <span className="font-semibold text-ink">{pitch.equipment_offered || 'None specified'}</span>
                  </div>
                </div>

                {/* Pitch Message */}
                <div className="space-y-1 text-xs">
                  <span className="text-ink-400 uppercase font-bold tracking-wide-sm block">Pitch Message & Set Hook</span>
                  <p className="text-ink-700 bg-paper p-3 border border-line italic leading-relaxed">
                    "{pitch.pitch_message}"
                  </p>
                </div>

                {/* Uploaded Media Files */}
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
                            className="flex items-center justify-between p-2.5 bg-paper border border-line hover:border-ink transition-colors group"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              {renderFileIcon(url)}
                              <span className="truncate font-medium text-ink group-hover:underline">{fileName}</span>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons for Host */}
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
                        onClick={() => updatePitchStatus(pitch.id, 'declined')}
                        disabled={updatingId === pitch.id}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide-sm text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                      >
                        Decline
                      </button>
                    )}

                    {pitch.status !== 'shortlisted' && pitch.status !== 'accepted' && (
                      <button
                        onClick={() => updatePitchStatus(pitch.id, 'shortlisted')}
                        disabled={updatingId === pitch.id}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide-sm bg-blue-100 text-blue-900 border border-blue-200 hover:bg-blue-200 transition-colors"
                      >
                        Shortlist
                      </button>
                    )}

                    {pitch.status !== 'accepted' && (
                      <button
                        onClick={() => updatePitchStatus(pitch.id, 'accepted')}
                        disabled={updatingId === pitch.id}
                        className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide-sm bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors inline-flex items-center gap-1.5"
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

        <div className="flex justify-end pt-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-ink text-paper text-xs uppercase font-semibold tracking-wide-sm hover:bg-ink-800"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
