import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { X, Loader2, Sparkles, Calendar, MapPin, DollarSign, CheckCircle2, User, ExternalLink } from 'lucide-react';

interface Pitch {
  id: string;
  gig_id: string;
  artist_id: string;
  cover_message: string;
  proposed_rate: number;
  status: string;
  created_at: string;
  artist?: {
    id: string;
    full_name: string;
    avatar_url: string;
    category: string;
    bio: string;
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
  const { profile } = useAuth();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchPitches = async () => {
    if (!gigId) return;
    setLoading(true);

    try {
      const { data: pitchData, error: pitchError } = await supabase
        .from('gig_pitches')
        .select('*')
        .eq('gig_id', gigId)
        .order('created_at', { ascending: false });

      if (pitchError) throw pitchError;

      if (pitchData && pitchData.length > 0) {
        const artistIds = pitchData.map((p) => p.artist_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, category, bio')
          .in('id', artistIds);

        const profileMap = new Map();
        (profilesData || []).forEach((prof) => {
          profileMap.set(prof.id, prof);
        });

        const formattedPitches: Pitch[] = pitchData.map((p) => ({
          ...p,
          artist: profileMap.get(p.artist_id) || null,
        }));

        setPitches(formattedPitches);
      } else {
        setPitches([]);
      }
    } catch (err) {
      console.error('Error fetching pitches:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Accepts the talent pitch, creates the formal booking record, and performs a hard redirect to checkout.
   */
  const handleAcceptPitch = async (pitch: Pitch) => {
    if (!profile?.id) return;
    setActionLoadingId(pitch.id);

    try {
      // 1. Fetch gig details
      const { data: gigData, error: gigError } = await supabase
        .from('gigs')
        .select('*')
        .eq('id', gigId)
        .single();

      if (gigError) throw gigError;

      const finalPrice = pitch.proposed_rate || gigData.budget || 0;

      // 2. Insert into the bookings table
      const bookingPayload = {
        host_id: profile.id,
        artist_id: pitch.artist_id,
        gig_id: gigId,
        event_date: gigData.event_date,
        start_time: gigData.start_time || '18:00',
        gig_duration: gigData.duration ? `${gigData.duration} hrs` : '2 hrs',
        location: gigData.location,
        total_price: finalPrice,
        total_amount: finalPrice,
        deposit_amount: finalPrice * 0.5,
        status: 'pending_deposit',
      };

      console.log('Inserting booking record:', bookingPayload);

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([bookingPayload])
        .select()
        .single();

      if (bookingError) {
        console.error('Supabase Booking Insert Error:', bookingError);
        throw bookingError;
      }

      // 3. Update pitch status to 'accepted'
      const { error: updateError } = await supabase
        .from('gig_pitches')
        .update({ status: 'accepted' })
        .eq('id', pitch.id);

      if (updateError) throw updateError;

      // 4. Trigger success callbacks if needed
      if (onSuccess) onSuccess();

      // 5. Hard browser redirect straight to the checkout page
      if (bookingData?.id) {
        window.location.href = `/book/${bookingData.id}`;
      } else {
        throw new Error('Booking created but ID was missing.');
      }
    } catch (err: any) {
      console.error('Error accepting pitch and creating booking:', err);
      alert(`Failed to convert pitch into booking: ${err?.message || 'Please check console.'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    if (isOpen && gigId) {
      fetchPitches();
    }
  }, [isOpen, gigId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-paper border border-line p-6 max-w-3xl w-full relative shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 text-ink-400 hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2 text-purple-900 bg-purple-100 border border-purple-200 px-2.5 py-1 w-fit text-[10px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3 h-3 text-purple-700" /> Pitch Dossier Review
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">{gigTitle}</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Review incoming artist pitch sheets and rate proposals. Accepting a pitch instantly generates your secure escrow booking request.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-purple-800 animate-spin" />
          </div>
        ) : pitches.length === 0 ? (
          <div className="border border-dashed border-line bg-paper-100 p-10 text-center space-y-2">
            <p className="font-display font-bold text-ink text-base">No pitches received yet</p>
            <p className="text-xs text-ink-500">Talent providers will appear here once they submit pitch sheets to your gig call.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pitches.map((pitch) => (
              <div
                key={pitch.id}
                className="border border-line bg-paper p-5 space-y-4 shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
                  <div className="flex items-center gap-3">
                    {pitch.artist?.avatar_url ? (
                      <img
                        src={pitch.artist.avatar_url}
                        alt={pitch.artist.full_name}
                        className="w-12 h-12 rounded-full object-cover border border-line"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-paper-200 flex items-center justify-center text-ink-600 font-bold">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-display font-bold text-ink text-base">
                        {pitch.artist?.full_name || 'Independent Talent'}
                      </h3>
                      <p className="text-xs text-purple-800 font-medium uppercase tracking-wide">
                        {pitch.artist?.category || 'Artist'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-ink-500 uppercase tracking-wider block">Proposed Quote</span>
                      <span className="font-display font-bold text-emerald-800 text-lg">
                        R{pitch.proposed_rate?.toLocaleString()}
                      </span>
                    </div>

                    {pitch.status === 'accepted' ? (
                      <span className="px-3 py-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs uppercase tracking-wider inline-flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" /> Accepted
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoadingId === pitch.id}
                        onClick={() => handleAcceptPitch(pitch)}
                        className="px-4 py-2 bg-ink text-paper hover:bg-ink-800 transition-colors font-semibold text-xs uppercase tracking-wide-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {actionLoadingId === pitch.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>Accept & Book <Sparkles className="w-3.5 h-3.5 text-purple-300" /></>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-ink-500 uppercase tracking-wider">Artist Pitch & Cover Message</span>
                  <p className="text-xs text-ink-700 bg-paper-100 p-3 border border-line whitespace-pre-wrap">
                    "{pitch.cover_message}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-paper-100 border border-line text-ink text-xs font-semibold uppercase tracking-wide-sm hover:border-ink"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
