import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { X, Loader2, Sparkles, Calendar, MapPin, Users, ArrowRight } from 'lucide-react';
import HostPitchReviewModal from '@/components/HostPitchReviewModal';

interface HostGig {
  id: string;
  title: string;
  category: string;
  location: string;
  event_date: string;
  budget: number;
  pitch_count: number;
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

  // Selected Gig for Pitch Review
  const [selectedGig, setSelectedGig] = useState<HostGig | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const fetchHostGigs = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      // 1. Fetch gigs posted by this host
      const { data: gigs, error } = await supabase
        .from('gigs')
        .select('*')
        .eq('host_id', profile.id)
        .order('event_date', { ascending: true });

      if (error) throw error;

      if (gigs && gigs.length > 0) {
        const gigIds = gigs.map((g) => g.id);

        // 2. Fetch pitch count for each gig
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

  useEffect(() => {
    if (isOpen) {
      fetchHostGigs();
    }
  }, [isOpen, profile?.id]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-paper border border-line p-6 max-w-2xl w-full relative shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 text-ink-400 hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2 text-purple-900 bg-purple-100 border border-purple-200 px-2.5 py-1 w-fit text-[10px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3 text-purple-700" /> Host Dashboard — Incoming Pitches
            </div>
            <h2 className="font-display text-2xl font-bold text-ink">Review Posted Gig Opportunities</h2>
            <p className="text-xs text-ink-500 mt-0.5">
              Select one of your open gigs below to evaluate incoming talent pitch sheets, rate quotes, and media showcases.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-purple-800 animate-spin" />
            </div>
          ) : hostGigs.length === 0 ? (
            <div className="border border-dashed border-line bg-paper-100 p-10 text-center space-y-2">
              <p className="font-display font-bold text-ink text-base">You haven't posted any gigs yet</p>
              <p className="text-xs text-ink-500">Post an event opening using the "+ Post a Gig" button to start receiving talent pitch sheets!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hostGigs.map((gig) => (
                <div
                  key={gig.id}
                  onClick={() => {
                    setSelectedGig(gig);
                    setIsReviewOpen(true);
                  }}
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

      {/* Embedded Review Dossier Modal */}
      {selectedGig && (
        <HostPitchReviewModal
          isOpen={isReviewOpen}
          onClose={() => {
            setIsReviewOpen(false);
            setSelectedGig(null);
            fetchHostGigs();
          }}
          gigId={selectedGig.id}
          gigTitle={selectedGig.title}
          onSuccess={() => {
            fetchHostGigs();
            if (onSuccess) onSuccess();
          }}
        />
      )}
    </>
  );
}
