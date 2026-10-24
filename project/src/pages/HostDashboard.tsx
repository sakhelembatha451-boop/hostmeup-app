import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Loader2, 
  CalendarPlus, 
  ShieldAlert, 
  Trash2,
  CheckSquare,
  Square,
  X,
  KeyRound,
  CheckCircle2,
  ExternalLink,
  Clock3,
  MapPinCheck,
  PartyPopper,
  LogOut,
  Star,
  Plus,
  Radio,
  Sparkles,
  DollarSign,
  FileText,
  Check,
  Eye,
  FileAudio,
  FileVideo,
  Image as ImageIcon
} from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge, EmptyState } from '@/components/UI';
import HostStatusBadge from '@/components/HostStatusBadge';
import ReviewModal from '@/components/ReviewModal';

type BookingWithArtist = Booking & {
  balance_paid?: boolean;
  deposit_paid?: boolean;
  verification_pin?: string;
  verification_token?: string;
  is_arrival_verified?: boolean;
  arrival_verified_at?: string;
  completed_at?: string;
  has_reviewed?: boolean;
  artist?: { id: string; full_name: string; avatar_url: string | null; location: string };
};

interface HostReviewItem {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  reviewer_id?: string;
  reviewer?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface GigPitchWithDetails {
  id: string;
  gig_id: string;
  artist_id: string;
  proposed_rate: number;
  available_time_slot?: string;
  equipment_offered?: string;
  pitch_message?: string;
  media_urls?: string[];
  status: 'pending' | 'shortlisted' | 'accepted' | 'declined';
  created_at: string;
  gig?: {
    id: string;
    title: string;
    budget: number;
    event_date: string;
  };
  artist?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    location: string;
  };
}

function formatCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

function formatTimeOnly(dateString: string | null | undefined) {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

const YOCO_PAYMENT_PAGE_URL = 'https://pay.yoco.com/hostmeup';

export default function HostDashboard() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<BookingWithArtist[]>([]);
  const [gigPitches, setGigPitches] = useState<GigPitchWithDetails[]>([]);
  const [selectedPitchForModal, setSelectedPitchForModal] = useState<GigPitchWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [pitchFilter, setPitchFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<BookingWithArtist | null>(null);

  // Review Modal State (For rating artists)
  const [reviewBookingTarget, setReviewBookingTarget] = useState<BookingWithArtist | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Host Reviews State (Feedback received from artists)
  const [hostReviews, setHostReviews] = useState<HostReviewItem[]>([]);

  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submittingRefId, setSubmittingRefId] = useState<string | null>(null);
  const [refInput, setRefInput] = useState('');

  const [hostVerification, setHostVerification] = useState<{
    is_identity_verified: boolean;
    verification_status: 'pending' | 'approved' | 'rejected' | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      let rawBookings: any[] = [];

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .or(`host_id.eq.${profile.id},client_id.eq.${profile.id}`)
        .order('created_at', { ascending: false });

      if (!error && data) {
        rawBookings = data;
      }

      if (rawBookings.length > 0) {
        const artistIds = Array.from(new Set(rawBookings.map((b) => b?.artist_id || b?.client_id).filter(Boolean)));
        const bookingIds = rawBookings.map((b) => b.id);
        
        let profileMap = new Map();
        if (artistIds.length > 0) {
          const { data: artistProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, location')
            .in('id', artistIds);

          profileMap = new Map((artistProfiles || []).map((p) => [p.id, p]));
        }

        let reviewedBookingIds = new Set<string>();
        if (bookingIds.length > 0) {
          const { data: existingReviews } = await supabase
            .from('reviews')
            .select('booking_id')
            .in('booking_id', bookingIds);

          if (existingReviews) {
            reviewedBookingIds = new Set(existingReviews.map((r) => r.booking_id));
          }
        }

        rawBookings = rawBookings.map((b) => ({
          ...b,
          artist: profileMap.get(b?.artist_id) || profileMap.get(b?.client_id) || null,
          has_reviewed: reviewedBookingIds.has(b.id),
        }));
      }

      setBookings(rawBookings as BookingWithArtist[]);

      if (selectedBooking) {
        const updatedSelected = rawBookings.find((b) => b?.id === selectedBooking.id);
        if (updatedSelected) setSelectedBooking(updatedSelected);
      }

      const { data: hostData } = await supabase
        .from('host_profiles')
        .select('is_identity_verified, verification_status')
        .eq('id', profile.id)
        .maybeSingle();

      if (hostData) {
        setHostVerification(hostData);
      }

      // Fetch reviews targeting this host
      const { data: reviewData, error: reviewErr } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          reviewer_id,
          reviewer:reviewer_id (full_name, avatar_url)
        `)
        .eq('target_host_id', profile.id)
        .order('created_at', { ascending: false });

      if (!reviewErr && reviewData) {
        setHostReviews(reviewData as HostReviewItem[]);
      }

      // Fetch Gigs posted by this host to find incoming pitches
      const { data: hostGigs } = await supabase
        .from('gigs')
        .select('id, title, budget, event_date')
        .eq('host_id', profile.id);

      if (hostGigs && hostGigs.length > 0) {
        const gigIds = hostGigs.map((g) => g.id);
        const gigMap = new Map(hostGigs.map((g) => [g.id, g]));

        const { data: pitchData } = await supabase
          .from('gig_pitches')
          .select('*')
          .in('gig_id', gigIds)
          .order('created_at', { ascending: false });

        if (pitchData && pitchData.length > 0) {
          const artistIds = Array.from(new Set(pitchData.map((p) => p.artist_id)));
          const { data: artistProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, location')
            .in('id', artistIds);

          const artistMap = new Map((artistProfiles || []).map((a) => [a.id, a]));

          const formattedPitches: GigPitchWithDetails[] = pitchData.map((p) => ({
            ...p,
            gig: gigMap.get(p.gig_id),
            artist: artistMap.get(p.artist_id),
          }));

          setGigPitches(formattedPitches);
        } else {
          setGigPitches([]);
        }
      } else {
        setGigPitches([]);
      }
    } catch (err) {
      console.error('Error loading host dashboard data:', err);
      setBookings([]);
      setGigPitches([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, selectedBooking]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpdatePitchStatus = async (pitchId: string, newStatus: 'shortlisted' | 'accepted' | 'declined') => {
    try {
      const { error } = await supabase
        .from('gig_pitches')
        .update({ status: newStatus })
        .eq('id', pitchId);

      if (error) throw error;
      await loadData();
      alert(`Pitch successfully ${newStatus}!`);
    } catch (err: any) {
      console.error('Error updating pitch status:', err);
      alert(`Could not update pitch: ${err?.message || 'Please try again.'}`);
    }
  };

  const handleDeleteBookings = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;

    const confirmMsg = idsToDelete.length === 1 
      ? "Are you sure you want to delete this booking card?"
      : `Are you sure you want to delete ${idsToDelete.length} booking cards?`;

    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        console.error('Error deleting bookings:', error);
      }

      setSelectedBookingIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
      if (selectedBooking && idsToDelete.includes(selectedBooking.id)) {
        setSelectedBooking(null);
      }
      loadData();
    } catch (err) {
      console.error('Error deleting bookings:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderCustomStatusBadge = (booking: BookingWithArtist) => {
    const isCompleted = booking.status === 'completed' || !!booking.completed_at;
    const isCheckedIn = booking.is_arrival_verified || booking.status === 'checked_in';
    const isFullyPaid = booking.balance_paid || booking.status === 'fully_paid';
    const isDepositPaid = booking.deposit_paid || booking.status?.toLowerCase() === 'confirmed';
    const isPendingVerification = booking.status?.toLowerCase() === 'pending_verification';

    if (isCompleted) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 border border-purple-200 rounded-sm inline-flex items-center gap-1">
          <PartyPopper className="w-3.5 h-3.5 text-purple-600" /> Event Completed
        </span>
      );
    }

    if (isCheckedIn) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-sm inline-flex items-center gap-1">
          <MapPinCheck className="w-3.5 h-3.5 text-emerald-600" /> Checked In
        </span>
      );
    }

    if (isFullyPaid) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Balance Paid
        </span>
      );
    }

    if (isDepositPaid) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200 rounded-sm inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" /> Deposit Paid
        </span>
      );
    }

    if (isPendingVerification) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 rounded-sm inline-flex items-center gap-1">
          <Clock3 className="w-3.5 h-3.5 text-amber-600 animate-pulse" /> Pending Verification
        </span>
      );
    }

    return <StatusBadge status={booking.status} />;
  };

  const renderPitchStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-sm inline-flex items-center gap-1"><Check className="w-3.5 h-3.5 text-emerald-600" /> Accepted</span>;
      case 'shortlisted':
        return <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-300 rounded-sm inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-blue-600" /> Shortlisted</span>;
      case 'declined':
        return <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-800 border border-red-200 rounded-sm inline-flex items-center gap-1"><X className="w-3.5 h-3.5 text-red-600" /> Declined</span>;
      default:
        return <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-900 border border-purple-200 rounded-sm inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-purple-700 animate-pulse" /> Pending Review</span>;
    }
  };

  const toggleSelectBooking = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBookingIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filtered.map((b) => b.id);
    if (selectedBookingIds.length === visibleIds.length) {
      setSelectedBookingIds([]);
    } else {
      setSelectedBookingIds(visibleIds);
    }
  };

  const updateBookingStatus = async (id: string, status: string) => {
    await supabase.from('bookings').update({ status }).eq('id', id);
    loadData();
  };

  const handlePaymentRedirect = (booking: BookingWithArtist, type: 'deposit' | 'remaining') => {
    const amountToPay = type === 'deposit' 
      ? (booking.deposit_amount || 0) 
      : ((booking.total_price || 0) - (booking.deposit_amount || 0));

    const successUrl = `${window.location.origin}/success?booking_id=${booking.id}`;
    const yocoCheckoutUrl = `${YOCO_PAYMENT_PAGE_URL}?amount=${amountToPay}&success_url=${encodeURIComponent(successUrl)}`;
    
    window.open(yocoCheckoutUrl, '_blank', 'noopener,noreferrer');
  };

  const submitPaymentReference = async (booking: BookingWithArtist) => {
    if (!refInput.trim()) {
      alert('Please enter your Yoco payment reference or transaction ID.');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-yoco-payment', {
        body: {
          booking_id: booking.id,
          yoco_reference: refInput.trim(),
        },
      });

      if (error) {
        alert(`Verification Failed: ${error.message || 'Could not verify payment with server.'}`);
        return;
      }

      if (data && data.success === true) {
        alert(data.message || 'Reference submitted successfully!');
        setSubmittingRefId(null);
        setRefInput('');
        await loadData();
      } else {
        alert(`Verification Failed: ${data?.error || 'Invalid Yoco payment reference.'}`);
      }
    } catch (err: any) {
      alert(`Verification Error: ${err?.message || 'Could not verify payment'}`);
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b?.status === filter);
  const filteredPitches = pitchFilter === 'all' ? gigPitches : gigPitches.filter((p) => p.status === pitchFilter);
  
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b?.status === 'pending').length,
    pending_verification: bookings.filter((b) => b?.status === 'pending_verification').length,
    confirmed: bookings.filter((b) => b?.status === 'confirmed' || b?.deposit_paid).length,
    accepted: bookings.filter((b) => b?.status === 'accepted').length,
    declined: bookings.filter((b) => b?.status === 'declined').length,
  };

  const pitchCounts = {
    all: gigPitches.length,
    pending: gigPitches.filter((p) => p.status === 'pending').length,
    shortlisted: gigPitches.filter((p) => p.status === 'shortlisted').length,
    accepted: gigPitches.filter((p) => p.status === 'accepted').length,
    declined: gigPitches.filter((p) => p.status === 'declined').length,
  };

  const isHostVerified = hostVerification?.is_identity_verified || hostVerification?.verification_status === 'approved';

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12 space-y-12">
        
        {!isHostVerified && (
          <div className="flex items-start justify-between gap-3 p-4 border border-amber-200 bg-amber-50 text-amber-900 text-xs">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-700 flex-shrink-0" />
              <div>
                <strong className="font-semibold block mb-0.5">Identity Verification Recommended</strong>
                <span>
                  {hostVerification?.verification_status === 'pending'
                    ? 'Your host verification is currently under review.'
                    : 'Get verified to increase trust and booking acceptance rates from top talent.'}
                </span>
              </div>
            </div>
            <Link to="/host-settings" className="font-semibold underline whitespace-nowrap text-amber-900 hover:text-amber-700">
              Verify Identity
            </Link>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Host Dashboard</p>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-4xl font-bold text-ink tracking-tight">Host Management Hub</h1>
              <HostStatusBadge 
                isVerified={hostVerification?.is_identity_verified}
                verificationStatus={hostVerification?.verification_status}
              />
            </div>
            <p className="text-ink-400">Track incoming talent gig pitches, manage direct bookings, and monitor escrow safety.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              to="/gigs" 
              aria-label="Post an open gig call" 
              className="px-4 py-3 bg-purple-900 text-white text-xs uppercase font-semibold tracking-wide-sm hover:bg-purple-950 transition-colors shadow-xs flex items-center gap-1.5 rounded-none"
            >
              <Plus className="w-4 h-4" /> Post a Gig
            </Link>

            <Link 
              to="/artists" 
              aria-label="Browse and book talent" 
              className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm"
            >
              <CalendarPlus className="w-3.5 h-3.5" /> Book Talent
            </Link>
          </div>
        </div>

        {/* Incoming Gig Pitches & Talent Proposals Section */}
        <div className="border border-line bg-purple-50/30 p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
            <div className="flex items-center gap-2.5">
              <Radio className="w-5 h-5 text-purple-800 animate-pulse" />
              <div>
                <h3 className="font-display text-xl font-bold text-ink">Incoming Gig Pitches & Talent Proposals</h3>
                <p className="text-xs text-ink-500">Review rate quotes, gear specs, and showcase media submitted by talent for your posted gigs</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {['all', 'pending', 'shortlisted', 'accepted', 'declined'].map((f) => (
                <button
                  key={f}
                  onClick={() => setPitchFilter(f)}
                  className={`filter-chip capitalize text-[11px] ${pitchFilter === f ? 'filter-chip-active' : 'filter-chip-inactive'}`}
                >
                  {f} {pitchCounts[f as keyof typeof pitchCounts] > 0 && `(${pitchCounts[f as keyof typeof pitchCounts]})`}
                </button>
              ))}
            </div>
          </div>

          {filteredPitches.length === 0 ? (
            <div className="border border-dashed border-line bg-paper p-8 text-center text-xs text-ink-400">
              No gig pitches found under this filter. Post an open gig call to start receiving talent proposals!
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPitches.map((pitch) => (
                <div key={pitch.id} className="border border-line bg-paper p-5 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Link to={`/artists/${pitch.artist_id}`} className="group">
                        {pitch.artist?.avatar_url ? (
                          <img src={pitch.artist.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-line group-hover:opacity-90" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-sm">
                            {pitch.artist?.full_name?.[0]?.toUpperCase() || 'A'}
                          </div>
                        )}
                      </Link>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link to={`/artists/${pitch.artist_id}`} className="font-display font-bold text-ink hover:underline text-sm">
                            {pitch.artist?.full_name || 'Talent'}
                          </Link>
                          {pitch.artist?.location && (
                            <span className="text-[11px] text-ink-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {pitch.artist.location}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-purple-900 font-medium mt-0.5">
                          Gig Call: <strong className="text-ink">{pitch.gig?.title || 'Untitled Gig'}</strong> (Budget: {formatCurrency(pitch.gig?.budget)})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-ink-400 block">Proposed Rate</span>
                        <span className="font-display font-bold text-emerald-800 text-base">{formatCurrency(pitch.proposed_rate)}</span>
                      </div>
                      <div>{renderPitchStatusBadge(pitch.status)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-paper-100 p-3.5 border border-line">
                    <div>
                      <span className="font-bold text-ink uppercase tracking-wider text-[10px] block mb-0.5">Availability / Call-Time</span>
                      <span className="text-ink-600">{pitch.available_time_slot || 'Flexible'}</span>
                    </div>
                    <div>
                      <span className="font-bold text-ink uppercase tracking-wider text-[10px] block mb-0.5">Equipment Offered</span>
                      <span className="text-ink-600">{pitch.equipment_offered || 'None specified'}</span>
                    </div>
                  </div>

                  {pitch.pitch_message && (
                    <div className="bg-white p-3 border border-line text-xs italic text-ink-700">
                      "{pitch.pitch_message}"
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line text-xs">
                    <div className="flex items-center gap-2">
                      {pitch.media_urls && pitch.media_urls.length > 0 && (
                        <button
                          onClick={() => setSelectedPitchForModal(pitch)}
                          className="px-3 py-1.5 bg-purple-100 text-purple-900 border border-purple-200 font-bold uppercase tracking-wider text-[10px] hover:bg-purple-200 transition-colors inline-flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 text-purple-700" /> View Attached Media ({pitch.media_urls.length})
                        </button>
                      )}
                      <span className="text-[11px] text-ink-400">
                        Submitted on {new Date(pitch.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdatePitchStatus(pitch.id, 'declined')}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-xs transition-colors"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleUpdatePitchStatus(pitch.id, 'shortlisted')}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide-sm text-blue-800 border border-blue-300 hover:bg-blue-50 rounded-xs transition-colors"
                      >
                        Shortlist
                      </button>
                      <button
                        onClick={() => handleUpdatePitchStatus(pitch.id, 'accepted')}
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide-sm bg-emerald-700 hover:bg-emerald-800 text-white rounded-xs transition-colors shadow-xs"
                      >
                        Accept Pitch
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal: View Attached Media Files */}
        {selectedPitchForModal && (
          <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedPitchForModal(null)}>
            <div className="bg-paper border border-line p-6 max-w-lg w-full relative shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedPitchForModal(null)} className="absolute top-4 right-4 text-ink-400 hover:text-ink">
                <X className="w-5 h-5" />
              </button>

              <div>
                <h3 className="font-display text-xl font-bold text-ink">Talent Pitch Showcase Media</h3>
                <p className="text-xs text-ink-400">Submitted by {selectedPitchForModal.artist?.full_name || 'Artist'} for {selectedPitchForModal.gig?.title}</p>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {selectedPitchForModal.media_urls?.map((url, idx) => {
                  const lower = url.toLowerCase();
                  const isAudio = lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.m4a');
                  const isVideo = lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm');

                  return (
                    <div key={idx} className="border border-line bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-ink">
                        <span className="truncate flex items-center gap-1.5">
                          {isAudio ? <FileAudio className="w-4 h-4 text-purple-700" /> : isVideo ? <FileVideo className="w-4 h-4 text-blue-700" /> : <ImageIcon className="w-4 h-4 text-emerald-700" />}
                          Media File {idx + 1}
                        </span>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-purple-900 underline flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Open Full
                        </a>
                      </div>

                      {isAudio && <audio controls src={url} className="w-full mt-1" />}
                      {isVideo && <video controls src={url} className="w-full max-h-48 object-cover mt-1" />}
                      {!isAudio && !isVideo && <img src={url} alt="" className="w-full max-h-48 object-cover border border-line mt-1" />}
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-line flex justify-end">
                <button onClick={() => setSelectedPitchForModal(null)} className="btn-primary text-xs px-5 py-2">
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-line py-6">
          {[
            { label: 'Total', value: counts.all },
            { label: 'Pending', value: counts.pending },
            { label: 'In Review', value: counts.pending_verification },
            { label: 'Confirmed', value: counts.confirmed },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="font-display text-4xl font-bold text-ink mb-1">{stat.value}</div>
              <div className="text-xs uppercase tracking-wide-sm text-ink-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Host Reviews & Feedback Section */}
        <div className="border border-line bg-paper-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-ink">Reviews from Booked Talent</h3>
              <p className="text-xs text-ink-500">Ratings and feedback submitted by artists you have booked</p>
            </div>
            {hostReviews.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink bg-paper border border-line px-3 py-1.5">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>
                  {(
                    hostReviews.reduce((acc, r) => acc + r.rating, 0) / hostReviews.length
                  ).toFixed(1)} / 5.0
                </span>
                <span className="text-ink-400 font-normal">({hostReviews.length})</span>
              </div>
            )}
          </div>

          {hostReviews.length === 0 ? (
            <div className="border border-dashed border-line p-6 text-center text-xs text-ink-500">
              No reviews received from artists yet.
            </div>
          ) : (
            <div className="space-y-3">
              {hostReviews.map((rev) => (
                <div key={rev.id} className="border border-line bg-paper p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {rev.reviewer?.avatar_url ? (
                        <img src={rev.reviewer.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-line" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-xs">
                          {rev.reviewer?.full_name?.[0]?.toUpperCase() || 'A'}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-ink">
                          {rev.reviewer?.full_name || 'Talent Provider'}
                        </p>
                        <p className="text-[10px] text-ink-400">
                          {new Date(rev.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= rev.rating ? 'fill-amber-500 text-amber-500' : 'text-ink-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {rev.comment && (
                    <p className="text-xs text-ink-600 bg-paper-100 p-2.5 border border-line">
                      "{rev.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'pending_verification', 'confirmed', 'accepted', 'declined'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`filter-chip capitalize ${filter === f ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
                {f.replace('_', ' ')} {counts[f as keyof typeof counts] > 0 && `(${counts[f as keyof typeof counts]})`}
              </button>
            ))}
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-ink-500 hover:text-ink flex items-center gap-1.5"
              >
                {selectedBookingIds.length === filtered.length && filtered.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-ink" />
                ) : (
                  <Square className="w-4 h-4 text-ink-400" />
                )}
                <span>{selectedBookingIds.length === filtered.length ? 'Deselect All' : 'Select All'}</span>
              </button>

              {selectedBookingIds.length > 0 && (
                <button
                  onClick={() => handleDeleteBookings(selectedBookingIds)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded hover:bg-red-100 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete Selected ({selectedBookingIds.length})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Calendar className="w-8 h-8" />}
            title={bookings.length === 0 ? "No booking requests yet" : "No bookings match this filter"}
            message={bookings.length === 0 ? "Browse talent and send your first booking request to get started." : "Try a different filter."}
            actionLabel={bookings.length === 0 ? "Browse Talent" : undefined}
            actionTo={bookings.length === 0 ? "/artists" : undefined} />
        ) : (
          <div className="space-y-6">
            {filtered.map((booking) => {
              if (!booking) return null;
              const isSelected = selectedBookingIds.includes(booking.id);
              const isDepositPaid = booking.deposit_paid || booking.status?.toLowerCase() === 'confirmed';
              const isPendingVerification = booking.status?.toLowerCase() === 'pending_verification';
              const isBalancePaid = booking.balance_paid || booking.status?.toLowerCase() === 'fully_paid';
              const isCompleted = booking.status?.toLowerCase() === 'completed' || !!booking.completed_at;
              const remainingBalance = (booking.total_price || 0) - (booking.deposit_amount || 0);

              return (
                <div 
                  key={booking.id} 
                  onClick={() => setSelectedBooking(booking)}
                  className={`border p-6 bg-white cursor-pointer animate-fade-in transition-all relative ${
                    isSelected ? 'border-red-400 bg-red-50/10 shadow-sm' : 'border-line hover:border-ink/40 hover:shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                    <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={(e) => toggleSelectBooking(booking.id, e)}
                        className="p-1 text-ink-400 hover:text-ink transition-colors"
                        title="Select for bulk delete"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-red-600" />
                        ) : (
                          <Square className="w-5 h-5 text-ink-300 hover:text-ink-500" />
                        )}
                      </button>

                      <Link to={booking.artist_id ? `/artists/${booking.artist_id}` : '/artists'} aria-label={`View ${booking.artist?.full_name || 'talent'} profile`}>
                        {booking.artist?.avatar_url ? (
                          <img src={booking.artist.avatar_url} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover border border-line" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-ink text-paper flex items-center justify-center font-display text-lg font-bold">{booking.artist?.full_name?.[0]?.toUpperCase() || '?'}</div>
