import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, MapPin, Clock, Loader2, Package, Check, X, 
  ExternalLink, ShieldCheck, Eye, MessageSquare, AlertTriangle, 
  MapPinCheck, LogOut, PhoneCall, ShieldAlert, CheckCircle2, KeyRound,
  Trash2, CheckSquare, Square, User, Mail, DollarSign, FileText, Clock3,
  PartyPopper, Star, Radio, Send, Music2, Sparkles, Wallet
} from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge, EmptyState, Tag } from '@/components/UI';
import HostStatusBadge from '@/components/HostStatusBadge';
import TalentVerificationModal from '@/components/TalentVerificationModal';
import TalentCheckoutModal from '@/components/TalentCheckoutModal';
import ReviewModal from '@/components/ReviewModal';
import PitchGigModal from '@/components/PitchGigModal';
import { TalentEarningsTab } from '../components/TalentEarningsTab';
import { maskContactInfo } from '@/utils/masking';
import { createNotification } from '@/lib/messaging';

type BookingWithHost = Booking & {
  conversation_id?: string | null;
  checked_in_at?: string | null;
  completed_at?: string | null;
  deposit_paid?: boolean;
  balance_paid?: boolean;
  is_arrival_verified?: boolean;
  is_deleted?: boolean;
  notes?: string | null;
  special_requests?: string | null;
  verification_pin?: string | null;
  has_reviewed?: boolean;
  host?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    location: string;
    email?: string;
    phone?: string;
    is_verified?: boolean;
    verified?: boolean;
    host_profile?: {
      company_name?: string | null;
      is_identity_verified?: boolean;
      verification_status?: 'pending' | 'approved' | 'rejected' | null;
    } | null;
  };
};

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

function formatCurrency(n: number | null) {
  if (n == null) return 'R0';
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function ArtistDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingWithHost[]>([]);
  const [openGigs, setOpenGigs] = useState<Gig[]>([]);
  const [userPitches, setUserPitches] = useState>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Selection & Bulk Deletion State
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Modals State
  const [selectedBooking, setSelectedBooking] = useState<BookingWithHost | null>(null);
  const [activeVerifyBooking, setActiveVerifyBooking] = useState<{ id: string; eventName: string } | null>(null);
  const [activeCheckoutBooking, setActiveCheckoutBooking] = useState<{ id: string; eventName: string } | null>(null);

  // Review Modal State (For rating hosts)
  const [reviewBookingTarget, setReviewBookingTarget] = useState<BookingWithHost | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Pitch Modal State
  const [selectedGigForPitch, setSelectedGigForPitch] = useState<Gig | null>(null);
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);

  const loadDashboardData = useCallback(async (isInitialLoad = false) => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    if (isInitialLoad) {
      setLoading(true);
    }

    try {
      const authUserId = profile.id;

      const { data: artistProfile } = await supabase
        .from('artist_profiles')
        .select('id')
        .eq('user_id', authUserId)
        .maybeSingle();

      const targetArtistIds = Array.from(
        new Set([authUserId, artistProfile?.id].filter(Boolean))
      );

      const { data: rawBookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('*')
        .or(`artist_id.in.(${targetArtistIds.join(',')}),client_id.eq.${authUserId}`)
        .order('created_at', { ascending: false });

      if (bookingsErr) {
        console.error('Error fetching bookings:', bookingsErr);
        setBookings([]);
      } else if (rawBookings) {
        const activeBookings = rawBookings.filter((b) => !b.is_deleted);
        let processedBookings = activeBookings;
        const hostIds = Array.from(
          new Set(activeBookings.map((b) => b.host_id || b.client_id).filter(Boolean))
        );
        const bookingIds = activeBookings.map((b) => b.id);

        let reviewedBookingIds = new Set<string>();
        if (bookingIds.length > 0) {
          const { data: existingReviews } = await supabase
            .from('reviews')
            .select('booking_id')
            .in('booking_id', bookingIds)
            .eq('reviewer_id', authUserId);

          if (existingReviews) {
            reviewedBookingIds = new Set(existingReviews.map((r) => r.booking_id));
          }
        }

        if (hostIds.length > 0) {
          const { data: profileRecords } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, location')
            .in('id', hostIds);

          const profileMap = new Map((profileRecords || []).map((p) => [p.id, p]));

          processedBookings = activeBookings.map((b) => {
            const p = profileMap.get(b.host_id) || profileMap.get(b.client_id) || b.host || null;

            return {
              ...b,
              has_reviewed: reviewedBookingIds.has(b.id),
              host: {
                id: p?.id || b.host_id || b.client_id,
                full_name: p?.full_name || 'Host',
                avatar_url: p?.avatar_url || null,
                location: p?.location || '',
                email: p?.email || '',
                is_verified: true,
                verified: true,
                host_profile: null,
              },
            };
          });
        }

        setBookings(processedBookings as BookingWithHost[]);
      }

      // Fetch Open Gigs for Talent Dashboard Feed
      const { data: gigData } = await supabase
        .from('gigs')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(6);

      if (gigData && gigData.length > 0) {
        const gigHostIds = Array.from(new Set(gigData.map((g) => g.host_id)));
        const { data: gigHosts } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', gigHostIds);

        const gigHostMap = new Map((gigHosts || []).map((h) => [h.id, h]));

        setOpenGigs(
          gigData.map((g) => ({
            ...g,
            host: gigHostMap.get(g.host_id) || { full_name: 'Event Host', avatar_url: null },
          }))
        );
      } else {
        setOpenGigs([]);
      }

      // Fetch logged-in artist's pitches to track status on cards
      const { data: pitchData } = await supabase
        .from('gig_pitches')
        .select('gig_id, status, proposed_rate')
        .eq('artist_id', authUserId);

      if (pitchData) {
        const pitchMap = new Map<string, UserPitch>();
        pitchData.forEach((p) => {
          pitchMap.set(p.gig_id, p as UserPitch);
        });
        setUserPitches(pitchMap);
      }

    } catch (err) {
      console.error('Error loading artist dashboard data:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { 
    loadDashboardData(true); 
  }, [loadDashboardData]);

  const toggleSelectBooking = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedBookingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  const toggleSelectAll = () => {
    const allFilteredIds = filtered.map((b) => b.id);
    const areAllSelected = allFilteredIds.every((id) => selectedBookingIds.includes(id));

    if (areAllSelected) {
      setSelectedBookingIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedBookingIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleDeleteBookings = async (idsToDelete: string[], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (idsToDelete.length === 0) return;

    const confirmMessage = idsToDelete.length === 1
      ? 'Are you sure you want to delete this booking card?'
      : `Are you sure you want to delete ${idsToDelete.length} selected booking cards?`;

    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    try {
      setBookings((prev) => prev.filter((b) => !idsToDelete.includes(b.id)));
      setSelectedBookingIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));

      if (selectedBooking && idsToDelete.includes(selectedBooking.id)) {
        setSelectedBooking(null);
      }

      const { error } = await supabase
        .from('bookings')
        .update({ is_deleted: true })
        .in('id', idsToDelete);

      if (error) {
        const hardDelete = await supabase
          .from('bookings')
          .delete()
          .in('id', idsToDelete);

        if (hardDelete.error) throw hardDelete.error;
      }
    } catch (err: any) {
      console.error('Error deleting booking(s):', err);
      alert(`Could not delete booking: ${err?.message || 'Database permission denied'}`);
      loadDashboardData(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderPitchStatusBadge = (gig: Gig) => {
    const pitch = userPitches.get(gig.id);
    if (!pitch) return null;

    if (pitch.status === 'accepted') {
      return (
        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xs inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Accepted
        </span>
      );
    }

    if (pitch.status === 'shortlisted') {
      return (
        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-300 rounded-xs inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-blue-600" /> Shortlisted
        </span>
      );
    }

    if (pitch.status === 'declined') {
      return (
        <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-50 text-red-800 border border-red-200 rounded-xs inline-flex items-center gap-1">
          <ShieldAlert className="w-3 h-3 text-red-600" /> Declined
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 rounded-xs inline-flex items-center gap-1">
        <Clock className="w-3 h-3 text-purple-700 animate-pulse" /> Pitched
      </span>
    );
  };

  const renderCustomStatusBadge = (booking: BookingWithHost) => {
    const isPendingCheckoutApproval = booking.status === 'pending_checkout_approval' || booking.notes?.includes('Awaiting Host Approval');
    const isCompleted = booking.status === 'completed' || !!booking.completed_at;
    const isCheckedIn = booking.is_arrival_verified || booking.status === 'checked_in';
    const isFullyPaid = booking.balance_paid || booking.status === 'fully_paid';
    const isDepositPaid = booking.deposit_paid || booking.status === 'confirmed';
    const isPendingVerification = booking.status === 'pending_verification';

    if (isPendingCheckoutApproval) {
      return (
        <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-900 border border-purple-300 rounded-sm inline-flex items-center gap-1 animate-pulse">
          <LogOut className="w-3.5 h-3.5 text-purple-700" /> Checkout Pending Approval
        </span>
      );
    }

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

  const updateBookingStatus = async (id: string, newStatus: string, extraFields: Record<string, any> = {}) => {
    setUpdatingId(id);
    try {
      const payload = { 
        status: newStatus, 
        ...extraFields 
      };

      const { error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
      await loadDashboardData(false);
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert(`Could not update status: ${err?.message || 'Please try again.'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const artistConfirmBooking = async (bookingId: string) => {
    const targetBooking = bookings.find((b) => b.id === bookingId);
    
    const isRemainingBalancePayment = 
      targetBooking?.deposit_paid || 
      targetBooking?.status === 'completed' || 
      !!targetBooking?.completed_at || 
      targetBooking?.status === 'checked_in';

    const confirmPromptText = isRemainingBalancePayment
      ? "CONFIRMATION NOTICE:\n\nYou confirm that you have checked your email or Yoco notification and received the REMAINING BALANCE payment.\n\nBy clicking OK, you agree that you have verified the funds and acknowledge full payment for this event."
      : "CONFIRMATION NOTICE:\n\nYou confirm that you have checked your email or Yoco notification and received the DEPOSIT payment.\n\nBy clicking OK, you agree that you have verified the funds and unlocked the event pass for the host.";

    if (!window.confirm(confirmPromptText)) return;

    setUpdatingId(bookingId);
    try {
      const generatedPin = targetBooking?.verification_pin || Math.floor(1000 + Math.random() * 9000).toString();
      const isAlreadyCompleted = targetBooking?.status === 'completed' || !!targetBooking?.completed_at;

      const updatePayload = isRemainingBalancePayment ? {
        status: isAlreadyCompleted ? 'completed' : 'fully_paid',
        balance_paid: true,
        notes: `${targetBooking?.notes || ''} [Full Payment Verified & Confirmed by Talent]`
      } : {
        status: 'confirmed',
        deposit_paid: true,
        verification_pin: generatedPin,
        notes: `${targetBooking?.notes || ''} [Deposit Verified & Confirmed by Talent]`
      };

      const { error } = await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('id', bookingId);

      if (error) throw error;

      // Real-time notification dispatch to host
      const hostTargetId = targetBooking?.host_id || targetBooking?.client_id;
      if (hostTargetId) {
        await createNotification(
          hostTargetId,
          isRemainingBalancePayment ? 'balance_verified' : 'deposit_verified',
          isRemainingBalancePayment ? 'Final Balance Confirmed! 🎉' : 'Deposit Verified! 🎉',
          isRemainingBalancePayment
            ? `The artist verified your remaining balance payment for "${targetBooking?.event_name}".`
            : `The artist verified your deposit reference for "${targetBooking?.event_name}". Your booking is confirmed!`,
          '/host-dashboard',
          bookingId
        );
      }

      alert(isRemainingBalancePayment 
        ? 'Remaining balance payment verified & confirmed! Booking is now fully paid.' 
        : 'Payment confirmed successfully! Host event pass unlocked.'
      );
      await loadDashboardData(false);
    } catch (err: any) {
      console.error('Error confirming payment:', err);
      alert(`Could not confirm payment: ${err?.message || 'Please try again.'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenPitchModal = (gig: Gig) => {
    setSelectedGigForPitch(gig);
    setIsPitchModalOpen(true);
  };

  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    pending_verification: bookings.filter((b) => b.status === 'pending_verification').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed' || b.deposit_paid).length,
    accepted: bookings.filter((b) => b.status === 'accepted').length,
    declined: bookings.filter((b) => b.status === 'declined').length,
    completed: bookings.filter((b) => b.status === 'completed' || b.completed_at).length,
  };

  const totalEarnings = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'accepted' || b.status === 'completed' || b.status === 'fully_paid')
    .reduce((sum, b) => sum + (b.total_price || b.total_amount || 0), 0);
  
  const depositedAmount = bookings
    .filter((b) => b.deposit_paid)
    .reduce((sum, b) => sum + (b.deposit_amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  const allFilteredSelected = filtered.length > 0 && filtered.every((b) => selectedBookingIds.includes(b.id));

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12 space-y-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Talent Dashboard</p>
            <h1 className="font-display text-4xl font-bold text-ink mb-1 tracking-tight">Incoming Requests & Gigs</h1>
            <p className="text-ink-400">View bookings, pitch for live open gigs, and monitor escrow safety.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/gigs" className="px-4 py-2.5 bg-purple-900 text-white text-xs uppercase font-semibold tracking-wide-sm hover:bg-purple-950 transition-colors flex items-center gap-1.5 shadow-xs">
              <Radio className="w-3.5 h-3.5 text-purple-300 animate-pulse" /> Browse Gig Board
            </Link>
            <Link to={`/artists/${profile?.id}`} aria-label="View public profile" className="btn-outline inline-flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wide-sm">
              <ExternalLink className="w-3.5 h-3.5" /> View Profile
            </Link>
          </div>
        </div>

        {/* Live Open Gig Calls Section for Talent */}
        <div className="border border-line bg-purple-50/40 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-purple-700 animate-pulse" />
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Open Gig Calls & Set Proposals</h3>
                <p className="text-xs text-ink-500">Pitch directly with your rate quote, gear specs, and sample media links</p>
              </div>
            </div>

            <Link to="/gigs" className="text-xs font-bold uppercase tracking-wide-sm text-purple-900 hover:underline">
              Explore All Gigs →
            </Link>
          </div>

          {openGigs.length === 0 ? (
            <div className="border border-dashed border-line bg-paper p-6 text-center text-xs text-ink-400">
              No open gig calls posted at the moment. Check back soon!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {openGigs.map((gig) => {
                const existingPitch = userPitches.get(gig.id);

                return (
                  <div key={gig.id} className="border border-line bg-paper p-4 space-y-3 flex flex-col justify-between shadow-xs">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 px-2 py-0.5 border border-purple-200">
                            {gig.category}
                          </span>
                          {renderPitchStatusBadge(gig)}
                        </div>
                        <span className="font-bold text-emerald-800 text-xs">
                          R{gig.budget.toLocaleString()}
                        </span>
                      </div>

                      <h4 className="font-display font-bold text-ink text-sm leading-snug line-clamp-1">{gig.title}</h4>

                      <div className="space-y-1 text-[11px] text-ink-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-ink-400" />
                          <span>{new Date(gig.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-ink-400" />
                          <span className="truncate">{gig.location}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenPitchModal(gig)}
                      className={`w-full text-center py-2 text-[10px] font-bold uppercase tracking-wide-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
                        existingPitch
                          ? 'bg-purple-900 text-white hover:bg-purple-950'
                          : 'bg-ink text-paper hover:bg-ink-800'
                      }`}
                    >
                      <Send className="w-3 h-3" /> {existingPitch ? 'Edit Submitted Pitch' : 'Pitch for Gig'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Earnings & Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-line py-6">
          <div>
            <div className="font-display text-4xl font-bold text-ink mb-1">{counts.all}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400">Total Requests</div>
          </div>
          <div>
            <div className="font-display text-4xl font-bold text-ink mb-1">{counts.pending_verification}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400">Pending Review</div>
          </div>
          <div>
            <div className="font-display text-3xl font-bold text-accent mb-1">{formatCurrency(depositedAmount)}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400">Deposits Received</div>
          </div>
          <div>
            <div className="font-display text-3xl font-bold text-ink-500 mb-1">{formatCurrency(totalEarnings)}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400">Total Booked Value</div>
          </div>
        </div>

        {/* Filters and Selection Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'pending_verification', 'confirmed', 'accepted', 'completed', 'declined'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`filter-chip capitalize ${filter === f ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
                {f.replace('_', ' ')} {counts[f as keyof typeof counts] > 0 && `(${counts[f as keyof typeof counts]})`}
              </button>
            ))}

            {/* Earnings & Payouts Navigation Tab */}
            <button
              onClick={() => setFilter('earnings')}
              className={`filter-chip inline-flex items-center gap-1 capitalize ${
                filter === 'earnings' ? 'filter-chip-active' : 'filter-chip-inactive'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" /> Earnings & Payouts
            </button>
          </div>

          {filter !== 'earnings' && filtered.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-ink-500 hover:text-ink flex items-center gap-1.5 transition-colors">
                {allFilteredSelected ? (
                  <CheckSquare className="w-4 h-4 text-ink" />
                ) : (
                  <Square className="w-4 h-4 text-ink-300" />
                )}
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </button>

              {selectedBookingIds.length > 0 && (
                <button
                  onClick={(e) => handleDeleteBookings(selectedBookingIds, e)}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded inline-flex items-center gap-1.5 transition-colors shadow-xs">
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete Selected ({selectedBookingIds.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Render Earnings Component when Earnings tab is active */}
        {filter === 'earnings' ? (
          <TalentEarningsTab />
        ) : (
          /* Booking Card List */
          filtered.length === 0 ? (
            <EmptyState icon={<Calendar className="w-8 h-8" />}
              title={bookings.length === 0 ? "No booking requests yet" : "No requests match this filter"}
              message={bookings.length === 0 ? "When hosts send you booking requests, they'll appear here." : "Try a different filter."}
              actionLabel={bookings.length === 0 ? "Edit Your Profile" : undefined}
              actionTo={bookings.length === 0 ? "/artist-profile/edit" : undefined} />
          ) : (
            <div className="space-y-6">
              {filtered.map((booking) => {
                const isSelected = selectedBookingIds.includes(booking.id);
                const isPendingVerification = booking.status === 'pending_verification';
                const isCompleted = booking.status === 'completed' || !!booking.completed_at;

                const isPaid = booking.deposit_paid === true;
                const rawNote = booking.notes || booking.special_requests || '';
                const displayNote = isPaid ? rawNote : maskContactInfo(rawNote);
                const rawHostEmail = booking.host?.email || '';
                const displayHostEmail = isPaid ? rawHostEmail : (rawHostEmail ? maskContactInfo(rawHostEmail) : '');
                const hostId = booking.host?.id || booking.host_id || booking.client_id;

                return (
                  <div 
                    key={booking.id} 
                    onClick={() => setSelectedBooking(booking)}
                    className={`border p-6 bg-white cursor-pointer animate-fade-in transition-all relative ${
                      isSelected ? 'border-ink bg-paper-200/20 shadow-sm' : 'border-line hover:border-ink/40 hover:shadow-sm'
                    }`}
                  >
                    <div className="absolute top-4 right-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDeleteBookings([booking.id], e)}
                        title="Delete booking card"
                        className="p-1.5 text-ink-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => toggleSelectBooking(booking.id, e)}
                        className="p-1 text-ink-400 hover:text-ink transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-ink" />
                        ) : (
                          <Square className="w-5 h-5 text-ink-300" />
                        )}
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start gap-6 pr-16">
                      <div className="flex items-center gap-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/hosts/${hostId}`} className="group">
                          {booking.host?.avatar_url ? (
                            <img src={booking.host.avatar_url} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover border border-line group-hover:opacity-90 transition-opacity" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-ink-200 text-ink-500 flex items-center justify-center font-display text-lg font-bold group-hover:bg-ink-300 transition-colors">{booking.host?.full_name?.[0]?.toUpperCase() || '?'}</div>
                          )}
                        </Link>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link to={`/hosts/${hostId}`} className="font-display font-semibold text-ink hover:underline">
                              {booking.host?.full_name || 'Host'}
                            </Link>
                            <HostStatusBadge isVerified={true} verificationStatus="approved" />
                          </div>
                          {displayHostEmail && (
                            <div className="text-xs text-ink-400 font-mono mt-0.5">{displayHostEmail}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <h3 className="font-display text-xl font-semibold text-ink">{booking.event_name || 'Untitled Event'}</h3>
                          <div className="flex items-center gap-2">
                            {renderCustomStatusBadge(booking)}

                            {isCompleted && (
                              <div onClick={(e) => e.stopPropagation()}>
                                {booking.has_reviewed ? (
                                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold uppercase tracking-wider rounded-sm inline-flex items-center gap-1">
                                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Host Reviewed
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReviewBookingTarget(booking);
                                      setIsReviewModalOpen(true);
                                    }}
                                    className="px-3 py-1 bg-ink text-paper border border-ink text-[11px] font-bold uppercase tracking-wider rounded-sm hover:bg-ink/90 inline-flex items-center gap-1 shadow-xs transition-colors"
                                  >
                                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Rate Host
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                          <div className="flex items-center gap-1.5 text-ink-500">
                            <Calendar className="w-3.5 h-3.5 text-ink-300" />
                            <span>{booking.event_date ? new Date(booking.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                          </div>
                          {booking.start_time && <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span>{booking.start_time}</span></div>}
                          <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.gig_duration || booking.duration_hours ? `${booking.duration_hours} hrs` : '—'}</span></div>
                          <div className="flex items-center gap-1.5 text-ink-500"><MapPin className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.location || '—'}</span></div>
                        </div>

                        {displayNote && (
                          <div className="bg-paper-200/50 p-2.5 border border-line text-xs space-y-1 mb-4">
                            <p className="text-ink-600 italic">"{displayNote}"</p>
                            {!isPaid && (
                              <p className="text-[10px] text-amber-700 flex items-center gap-1 font-sans not-italic pt-1 border-t border-line/50">
                                <ShieldCheck className="w-3 h-3 shrink-0" />
                                Contact details hidden until booking deposit is cleared via HostMeUp Escrow.
                              </p>
                            )}
                          </div>
                        )}

                        <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide-sm text-ink hover:underline">
                            <Eye className="w-3.5 h-3.5 text-ink-400" /> View Details
                          </button>

                          <div className="flex flex-wrap items-center gap-2">
                            {booking.status === 'pending' && (
                              <>
                                <button 
                                  onClick={() => updateBookingStatus(booking.id, 'declined')}
                                  disabled={updatingId === booking.id}
                                  className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wide-sm text-red-600 border-red-200 hover:bg-red-50">
                                  {updatingId === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Decline
                                </button>
                                <button 
                                  onClick={() => updateBookingStatus(booking.id, 'accepted')}
                                  disabled={updatingId === booking.id}
                                  className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wide-sm">
                                  {updatingId === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept
                                </button>
                              </>
                            )}

                            {isPendingVerification && (
                              <button
                                onClick={() => artistConfirmBooking(booking.id)}
                                disabled={updatingId === booking.id}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm shadow-xs transition-colors">
                                {updatingId === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Confirm Payment Reference
                              </button>
                            )}

                            {!isCompleted && (booking.status === 'confirmed' || booking.status === 'accepted' || booking.status === 'checked_in' || booking.status === 'fully_paid') && !isPendingVerification && (
                              <>
                                {!booking.is_arrival_verified ? (
                                  <button
                                    onClick={() => setActiveVerifyBooking({ id: booking.id, eventName: booking.event_name || 'Event' })}
                                    className="bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm shadow-xs transition-colors">
                                    <KeyRound className="w-3.5 h-3.5" /> Enter Host Pass Code
                                  </button>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm">
                                    <MapPinCheck className="w-3.5 h-3.5 text-emerald-600" /> Arrived at Event
                                  </span>
                                )}

                                <button
                                  onClick={() => setActiveCheckoutBooking({ id: booking.id, eventName: booking.event_name || 'Event' })}
                                  className="bg-ink hover:bg-ink/90 text-paper inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm shadow-xs transition-colors">
                                  <LogOut className="w-3.5 h-3.5" /> Check Out of Event
                                </button>

                                <button
                                  onClick={() => navigate('/inbox')}
                                  className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wide-sm">
                                  <MessageSquare className="w-3.5 h-3.5" /> Message Host
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Modal: Full Event Details */}
        {selectedBooking && (() => {
          const isPaid = selectedBooking.deposit_paid === true;
          const rawNote = selectedBooking.notes || selectedBooking.special_requests || '';
          const displayNote = isPaid ? rawNote : maskContactInfo(rawNote);
          const rawHostEmail = selectedBooking.host?.email || '';
          const displayHostEmail = isPaid ? rawHostEmail : (rawHostEmail ? maskContactInfo(rawHostEmail) : '');
          const selectedHostId = selectedBooking.host?.id || selectedBooking.host_id || selectedBooking.client_id;

          return (
            <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedBooking(null)}>
              <div className="bg-paper border border-line p-6 max-w-xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6" onClick={(e) => e.stopPropagation()}>
                
                <button onClick={() => setSelectedBooking(null)} className="absolute top-4 right-4 text-ink-400 hover:text-ink">
                  <X className="w-5 h-5" />
                </button>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {renderCustomStatusBadge(selectedBooking)}
                    <span className="text-xs text-ink-400">ID: {selectedBooking.id.substring(0, 8)}...</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-ink">{selectedBooking.event_name || 'Untitled Event'}</h2>
                </div>

                <div className="p-4 border border-line bg-paper-100 flex items-center gap-4">
                  <Link to={`/hosts/${selectedHostId}`} className="group">
                    {selectedBooking.host?.avatar_url ? (
                      <img src={selectedBooking.host.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-line group-hover:opacity-90 transition-opacity" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-ink-200 text-ink-500 flex items-center justify-center font-display font-bold group-hover:bg-ink-300 transition-colors">
                        {selectedBooking.host?.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </Link>
                  <div>
                    <div className="font-display font-semibold text-ink text-sm flex items-center gap-2">
                      <Link to={`/hosts/${selectedHostId}`} className="hover:underline">
                        {selectedBooking.host?.full_name || 'Host'}
                      </Link>
                      <HostStatusBadge isVerified={true} verificationStatus="approved" />
                    </div>
                    {displayHostEmail && (
                      <div className="text-xs text-ink-400 flex items-center gap-1.5 mt-0.5 font-mono">
                        <Mail className="w-3 h-3 text-ink-300" /> {displayHostEmail}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-y border-line py-4 text-xs">
                  <div>
                    <span className="text-ink-400 uppercase tracking-wide-sm block mb-1">Date & Time</span>
                    <div className="font-semibold text-ink flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-ink-400" />
                      {selectedBooking.event_date ? new Date(selectedBooking.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </div>
                    {selectedBooking.start_time && (
                      <div className="text-ink-500 flex items-center gap-1.5 mt-1">
                        <Clock className="w-3.5 h-3.5 text-ink-400" /> {selectedBooking.start_time} ({selectedBooking.duration_hours || 1} hrs)
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-ink-400 uppercase tracking-wide-sm block mb-1">Location</span>
                    <div className="font-semibold text-ink flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-ink-400" />
                      {selectedBooking.location || 'Location Not Specified'}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <span className="text-ink-400 uppercase tracking-wide-sm block">Payment Details</span>
                  <div className="flex justify-between py-1 border-b border-line">
                    <span className="text-ink-500">Total Agreed Price:</span>
                    <span className="font-bold text-ink">{formatCurrency(selectedBooking.total_price || selectedBooking.total_amount)}</span>
                  </div>
                  {selectedBooking.deposit_amount && (
                    <div className="flex justify-between py-1 border-b border-line">
                      <span className="text-ink-500">Required Deposit:</span>
                      <span className="font-bold text-accent">{formatCurrency(selectedBooking.deposit_amount)}</span>
                    </div>
                  )}
                </div>

                {displayNote && (
                  <div className="space-y-1 text-xs">
                    <span className="text-ink-400 uppercase tracking-wide-sm block">Host Notes & Submitted Yoco Reference</span>
                    <div className="p-3 bg-white border border-line text-xs font-mono rounded leading-relaxed text-ink">
                      {displayNote}
                    </div>
                    {!isPaid && (
                      <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1 font-sans">
                        🛡️ Contact details hidden until booking deposit is cleared via HostMeUp Escrow.
                      </p>
                    )}
                  </div>
                )}

                {selectedBooking.status === 'pending_verification' && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                      <Clock3 className="w-4 h-4 text-amber-600 animate-pulse" />
                      <span>Host has submitted a payment reference. Please check your email or Yoco notification before confirming.</span>
                    </div>
                    <button
                      onClick={() => {
                        artistConfirmBooking(selectedBooking.id);
                        setSelectedBooking(null);
                      }}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 px-4 text-xs font-semibold uppercase tracking-wide-sm rounded flex items-center justify-center gap-2 transition-colors">
                      <CheckCircle2 className="w-4 h-4" /> Confirm Payment & Unlock Booking
                    </button>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between border-t border-line">
                  <button
                    onClick={() => {
                      setSelectedBooking(null);
                      navigate('/inbox');
                    }}
                    className="btn-outline inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wide-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Message Host
                  </button>

                  <button 
                    onClick={() => setSelectedBooking(null)} 
                    className="btn-primary px-6 py-2 text-xs uppercase tracking-wide-sm"
                  >
                    Close
                  </button>
                </div>

              </div>
            </div>
          );
        })()}

        {/* Modal: Talent Verification (PIN Check-in) */}
        {activeVerifyBooking && (
          <TalentVerificationModal
            bookingId={activeVerifyBooking.id}
            eventName={activeVerifyBooking.eventName}
            isOpen={!!activeVerifyBooking}
            onClose={() => setActiveVerifyBooking(null)}
            onVerified={() => {
              setActiveVerifyBooking(null);
              loadDashboardData(false);
            }}
          />
        )}

        {/* Modal: Talent Check-out */}
        {activeCheckoutBooking && (
          <TalentCheckoutModal
            bookingId={activeCheckoutBooking.id}
            eventName={activeCheckoutBooking.eventName}
            isOpen={!!activeCheckoutBooking}
            onClose={() => setActiveCheckoutBooking(null)}
            onCheckoutSuccess={() => {
              setActiveCheckoutBooking(null);
              loadDashboardData(false);
            }}
          />
        )}

        {/* Review Modal Trigger (For rating the host) */}
        {reviewBookingTarget && (
          <ReviewModal
            isOpen={isReviewModalOpen}
            onClose={() => {
              setIsReviewModalOpen(false);
              setReviewBookingTarget(null);
            }}
            bookingId={reviewBookingTarget.id}
            artistId={reviewBookingTarget.artist_id || profile?.id}
            targetHostId={reviewBookingTarget.host_id || reviewBookingTarget.client_id}
            hostName={reviewBookingTarget.host?.full_name || 'Event Host'}
            onSuccess={() => loadDashboardData(false)}
          />
        )}

        {/* Pitch Modal Trigger */}
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
            onSuccess={() => loadDashboardData(false)}
          />
        )}

      </div>
    </div>
  );
}
