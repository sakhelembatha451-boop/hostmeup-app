import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, MapPin, Clock, Loader2, X, 
  ExternalLink, MessageSquare, 
  MapPinCheck, CheckCircle2, KeyRound,
  Trash2, CheckSquare, Square, Clock3,
  PartyPopper, Star, Radio, Send, Wallet
} from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge, EmptyState } from '@/components/UI';
import HostStatusBadge from '@/components/HostStatusBadge';
import TalentVerificationModal from '@/components/TalentVerificationModal';
import TalentCheckoutModal from '@/components/TalentCheckoutModal';
import ReviewModal from '@/components/ReviewModal';
import PitchGigModal from '@/components/PitchGigModal';
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
  if (n == null || isNaN(n)) return 'R0';
  return `R${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ArtistDashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper text-center">
          <h2 className="font-display text-2xl font-bold text-ink mb-2">Dashboard Error</h2>
          <p className="text-sm text-ink-400 mb-4 max-w-md font-mono text-left bg-red-50 p-3 border border-red-200">
            {this.state.error?.toString()}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary px-6 py-2.5 text-xs uppercase tracking-wide-sm"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ArtistDashboardContent() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingWithHost[]>([]);
  const [openGigs, setOpenGigs] = useState<Gig[]>([]);
  const [userPitches, setUserPitches] = useState>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const [selectedBooking, setSelectedBooking] = useState<BookingWithHost | null>(null);
  const [activeVerifyBooking, setActiveVerifyBooking] = useState<{ id: string; eventName: string } | null>(null);
  const [activeCheckoutBooking, setActiveCheckoutBooking] = useState<{ id: string; eventName: string } | null>(null);

  const [reviewBookingTarget, setReviewBookingTarget] = useState<BookingWithHost | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

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

      const targetArtistIds = [authUserId, artistProfile?.id].filter((id): id is string => Boolean(id));

      const { data: rawBookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('*')
        .or(`artist_id.in.(${targetArtistIds.join(',')}),client_id.eq.${authUserId}`)
        .order('created_at', { ascending: false });

      if (bookingsErr) {
        console.error('Error fetching bookings:', bookingsErr);
        setBookings([]);
      } else if (rawBookings && Array.isArray(rawBookings)) {
        const activeBookings = rawBookings.filter((b) => b && !b.is_deleted);
        let processedBookings = activeBookings;
        
        const hostIds = Array.from(
          new Set(activeBookings.map((b) => b.host_id || b.client_id).filter((id): id is string => Boolean(id)))
        );
        const bookingIds = activeBookings.map((b) => b.id);

        let reviewedBookingIds = new Set<string>();
        if (bookingIds.length > 0) {
          const { data: existingReviews } = await supabase
            .from('reviews')
            .select('booking_id')
            .in('booking_id', bookingIds)
            .eq('reviewer_id', authUserId);

          if (existingReviews && Array.isArray(existingReviews)) {
            reviewedBookingIds = new Set(existingReviews.map((r) => r?.booking_id).filter(Boolean));
          }
        }

        if (hostIds.length > 0) {
          const { data: profileRecords } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, location')
            .in('id', hostIds);

          const profileMap = new Map(Array.isArray(profileRecords) ? profileRecords.map((p) => [p?.id, p]) : []);

          processedBookings = activeBookings.map((b) => {
            const p = profileMap.get(b.host_id) || profileMap.get(b.client_id) || null;

            return {
              ...b,
              has_reviewed: reviewedBookingIds.has(b.id),
              host: {
                id: p?.id || b.host_id || b.client_id || 'unknown',
                full_name: p?.full_name || 'Host',
                avatar_url: p?.avatar_url || null,
                location: p?.location || '',
                email: p?.email || '',
                is_verified: true,
                verified: true,
              },
            };
          });
        }

        setBookings(processedBookings as BookingWithHost[]);
      }

      const { data: gigData } = await supabase
        .from('gigs')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(6);

      if (gigData && Array.isArray(gigData) && gigData.length > 0) {
        const gigHostIds = Array.from(
          new Set(gigData.map((g) => g?.host_id).filter((id): id is string => Boolean(id)))
        );
        
        const { data: gigHosts } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', gigHostIds);

        const gigHostMap = new Map(Array.isArray(gigHosts) ? gigHosts.map((h) => [h?.id, h]) : []);

        setOpenGigs(
          gigData.map((g) => ({
            ...g,
            host: gigHostMap.get(g.host_id) || { full_name: 'Event Host', avatar_url: null },
          }))
        );
      } else {
        setOpenGigs([]);
      }

      const { data: pitchData } = await supabase
        .from('gig_pitches')
        .select('gig_id, status, proposed_rate')
        .eq('artist_id', authUserId);

      if (pitchData && Array.isArray(pitchData)) {
        const pitchMap = new Map<string, UserPitch>();
        pitchData.forEach((p) => {
          if (p?.gig_id) pitchMap.set(p.gig_id, p as UserPitch);
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
      Array.isArray(prev) ? (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]) : [id]
    );
  };

  const filtered = Array.isArray(bookings) 
    ? (filter === 'all' ? bookings : bookings.filter((b) => b?.status === filter))
    : [];

  const toggleSelectAll = () => {
    const allFilteredIds = Array.isArray(filtered) ? filtered.map((b) => b.id) : [];
    const areAllSelected = allFilteredIds.every((id) => selectedBookingIds.includes(id));

    if (areAllSelected) {
      setSelectedBookingIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedBookingIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleDeleteBookings = async (idsToDelete: string[], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!idsToDelete || idsToDelete.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${idsToDelete.length} selected booking card(s)?`)) return;

    setIsDeleting(true);
    try {
      setBookings((prev) => prev.filter((b) => !idsToDelete.includes(b.id)));
      setSelectedBookingIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));

      if (selectedBooking && idsToDelete.includes(selectedBooking.id)) {
        setSelectedBooking(null);
      }

      await supabase.from('bookings').update({ is_deleted: true }).in('id', idsToDelete);
    } catch (err: any) {
      console.error('Error deleting booking(s):', err);
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
    return (
      <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 rounded-xs inline-flex items-center gap-1">
        <Clock className="w-3 h-3 text-purple-700 animate-pulse" /> Pitched
      </span>
    );
  };

  const renderCustomStatusBadge = (booking: BookingWithHost) => {
    const isCompleted = booking?.status === 'completed' || !!booking?.completed_at;
    const isCheckedIn = booking?.is_arrival_verified || booking?.status === 'checked_in';
    const isFullyPaid = booking?.balance_paid || booking?.status === 'fully_paid';
    const isDepositPaid = booking?.deposit_paid || booking?.status === 'confirmed';
    const isPendingVerification = booking?.status === 'pending_verification';

    if (isCompleted) return <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 border border-purple-200 rounded-sm inline-flex items-center gap-1"><PartyPopper className="w-3.5 h-3.5 text-purple-600" /> Event Completed</span>;
    if (isCheckedIn) return <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-sm inline-flex items-center gap-1"><MapPinCheck className="w-3.5 h-3.5 text-emerald-600" /> Checked In</span>;
    if (isFullyPaid) return <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Balance Paid</span>;
    if (isDepositPaid) return <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200 rounded-sm inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-teal-600" /> Deposit Paid</span>;
    if (isPendingVerification) return <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 rounded-sm inline-flex items-center gap-1"><Clock3 className="w-3.5 h-3.5 text-amber-600 animate-pulse" /> Pending Verification</span>;

    return <StatusBadge status={booking?.status || 'pending'} />;
  };

  const updateBookingStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await supabase.from('bookings').update({ status: newStatus }).eq('id', id);
      await loadDashboardData(false);
    } catch (err: any) {
      console.error('Error updating status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const artistConfirmBooking = async (bookingId: string) => {
    const targetBooking = bookings.find((b) => b.id === bookingId);
    const isRemainingBalancePayment = targetBooking?.deposit_paid || targetBooking?.status === 'completed';

    if (!window.confirm(isRemainingBalancePayment ? "Confirm receipt of remaining balance?" : "Confirm receipt of deposit?")) return;

    setUpdatingId(bookingId);
    try {
      const generatedPin = targetBooking?.verification_pin || Math.floor(1000 + Math.random() * 9000).toString();
      await supabase.from('bookings').update({
        status: isRemainingBalancePayment ? 'fully_paid' : 'confirmed',
        deposit_paid: true,
        verification_pin: generatedPin,
      }).eq('id', bookingId);

      const hostTargetId = targetBooking?.host_id || targetBooking?.client_id;
      if (hostTargetId) {
        await createNotification(
          hostTargetId,
          'deposit_verified',
          'Payment Confirmed! 🎉',
          `The artist verified your payment reference for "${targetBooking?.event_name || 'Event'}".`,
          '/host-dashboard',
          bookingId
        );
      }

      await loadDashboardData(false);
    } catch (err: any) {
      console.error('Error confirming payment:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const counts = {
    all: Array.isArray(bookings) ? bookings.length : 0,
    pending: Array.isArray(bookings) ? bookings.filter((b) => b?.status === 'pending').length : 0,
    pending_verification: Array.isArray(bookings) ? bookings.filter((b) => b?.status === 'pending_verification').length : 0,
    confirmed: Array.isArray(bookings) ? bookings.filter((b) => b?.status === 'confirmed' || b?.deposit_paid).length : 0,
    accepted: Array.isArray(bookings) ? bookings.filter((b) => b?.status === 'accepted').length : 0,
    declined: Array.isArray(bookings) ? bookings.filter((b) => b?.status === 'declined').length : 0,
    completed: Array.isArray(bookings) ? bookings.filter((b) => b?.status === 'completed' || b?.completed_at).length : 0,
  };

  const totalEarnings = Array.isArray(bookings)
    ? bookings
        .filter((b) => ['confirmed', 'accepted', 'completed', 'fully_paid'].includes(b?.status || ''))
        .reduce((sum, b) => sum + Number(b?.total_price || b?.total_amount || 0), 0)
    : 0;
  
  const depositedAmount = Array.isArray(bookings)
    ? bookings
        .filter((b) => b?.deposit_paid)
        .reduce((sum, b) => sum + Number(b?.deposit_amount || 0), 0)
    : 0;

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  const allFilteredSelected = Array.isArray(filtered) && filtered.length > 0 && filtered.every((b) => selectedBookingIds.includes(b.id));

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12 space-y-10">
        
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

          {!Array.isArray(openGigs) || openGigs.length === 0 ? (
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
                            {gig.category || 'Gig'}
                          </span>
                          {renderPitchStatusBadge(gig)}
                        </div>
                        <span className="font-bold text-emerald-800 text-xs">R{(gig.budget || 0).toLocaleString()}</span>
                      </div>
                      <h4 className="font-display font-bold text-ink text-sm leading-snug line-clamp-1">{gig.title || 'Untitled Gig'}</h4>
                      <div className="space-y-1 text-[11px] text-ink-500">
                        <div className="flex items-center gap-1"><Calendar className="w-3 h-3 text-ink-400" /><span>{gig.event_date ? new Date(gig.event_date).toLocaleDateString() : '—'}</span></div>
                        <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-ink-400" /><span className="truncate">{gig.location || '—'}</span></div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedGigForPitch(gig); setIsPitchModalOpen(true); }}
                      className={`w-full text-center py-2 text-[10px] font-bold uppercase tracking-wide-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs ${existingPitch ? 'bg-purple-900 text-white hover:bg-purple-950' : 'bg-ink text-paper hover:bg-ink-800'}`}
                    >
                      <Send className="w-3 h-3" /> {existingPitch ? 'Edit Submitted Pitch' : 'Pitch for Gig'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-line py-6">
          <div><div className="font-display text-4xl font-bold text-ink mb-1">{counts.all}</div><div className="text-xs uppercase tracking-wide-sm text-ink-400">Total Requests</div></div>
          <div><div className="font-display text-4xl font-bold text-ink mb-1">{counts.pending_verification}</div><div className="text-xs uppercase tracking-wide-sm text-ink-400">Pending Review</div></div>
          <div><div className="font-display text-3xl font-bold text-accent mb-1">{formatCurrency(depositedAmount)}</div><div className="text-xs uppercase tracking-wide-sm text-ink-400">Deposits Received</div></div>
          <div><div className="font-display text-3xl font-bold text-ink-500 mb-1">{formatCurrency(totalEarnings)}</div><div className="text-xs uppercase tracking-wide-sm text-ink-400">Total Booked Value</div></div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'pending_verification', 'confirmed', 'accepted', 'completed', 'declined'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`filter-chip capitalize ${filter === f ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
                {f.replace('_', ' ')} {counts[f as keyof typeof counts] > 0 && `(${counts[f as keyof typeof counts]})`}
              </button>
            ))}
            <button onClick={() => setFilter('earnings')} className={`filter-chip inline-flex items-center gap-1 capitalize ${filter === 'earnings' ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
              <Wallet className="w-3.5 h-3.5" /> Earnings & Payouts
            </button>
          </div>

          {filter !== 'earnings' && Array.isArray(filtered) && filtered.length > 0 && (
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll} className="text-xs font-semibold text-ink-500 hover:text-ink flex items-center gap-1.5 transition-colors">
                {allFilteredSelected ? <CheckSquare className="w-4 h-4 text-ink" /> : <Square className="w-4 h-4 text-ink-300" />}
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </button>
              {selectedBookingIds.length > 0 && (
                <button onClick={(e) => handleDeleteBookings(selectedBookingIds, e)} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded inline-flex items-center gap-1.5 transition-colors shadow-xs">
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete Selected ({selectedBookingIds.length})
                </button>
              )}
            </div>
          )}
        </div>

        {filter === 'earnings' ? (
          <div className="border border-line bg-paper p-8 text-center space-y-3">
            <h3 className="font-display text-lg font-bold text-ink">Earnings & Payouts Overview</h3>
            <p className="text-xs text-ink-400">Total Confirmed Earnings: <strong className="text-accent">{formatCurrency(totalEarnings)}</strong></p>
            <p className="text-xs text-ink-400">Total Escrow Deposits Cleared: <strong className="text-ink">{formatCurrency(depositedAmount)}</strong></p>
          </div>
        ) : (
          !Array.isArray(filtered) || filtered.length === 0 ? (
            <EmptyState icon={<Calendar className="w-8 h-8" />} title="No booking requests yet" message="When hosts send you booking requests, they'll appear here." />
          ) : (
            <div className="space-y-6">
              {filtered.map((booking) => {
                const isSelected = selectedBookingIds.includes(booking.id);
                const isPendingVerification = booking.status === 'pending_verification';
                const isCompleted = booking.status === 'completed' || !!booking.completed_at;
                const isPaid = booking.deposit_paid === true;
                const displayNote = isPaid ? (booking.notes || '') : maskContactInfo(booking.notes || '');
                const hostId = booking.host?.id || booking.host_id || booking.client_id;

                return (
                  <div key={booking.id} onClick={() => setSelectedBooking(booking)} className={`border p-6 bg-white cursor-pointer transition-all relative ${isSelected ? 'border-ink bg-paper-200/20 shadow-sm' : 'border-line hover:border-ink/40'}`}>
                    <div className="absolute top-4 right-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => handleDeleteBookings([booking.id], e)} className="p-1.5 text-ink-300 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      <button onClick={(e) => toggleSelectBooking(booking.id, e)} className="p-1 text-ink-400 hover:text-ink">
                        {isSelected ? <CheckSquare className="w-5 h-5 text-ink" /> : <Square className="w-5 h-5 text-ink-300" />}
                      </button>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-start gap-6 pr-16">
                      <div className="flex items-center gap-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Link to={`/hosts/${hostId}`} className="group">
                          {booking.host?.avatar_url ? (
                            <img src={booking.host.avatar_url} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover border border-line" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-ink-200 text-ink-500 flex items-center justify-center font-bold">{(booking.host?.full_name || 'H')[0]?.toUpperCase()}</div>
                          )}
                        </Link>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link to={`/hosts/${hostId}`} className="font-display font-semibold text-ink hover:underline">{booking.host?.full_name || 'Host'}</Link>
                            <HostStatusBadge isVerified={true} verificationStatus="approved" />
                          </div>
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <h3 className="font-display text-xl font-semibold text-ink">{booking.event_name || 'Untitled Event'}</h3>
                          <div className="flex items-center gap-2">
                            {renderCustomStatusBadge(booking)}
                            {isCompleted && !booking.has_reviewed && (
                              <button onClick={(e) => { e.stopPropagation(); setReviewBookingTarget(booking); setIsReviewModalOpen(true); }} className="px-3 py-1 bg-ink text-paper text-[11px] font-bold uppercase tracking-wider rounded-sm hover:bg-ink/90 inline-flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> Rate Host
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                          <div className="flex items-center gap-1.5 text-ink-500"><Calendar className="w-3.5 h-3.5 text-ink-300" /><span>{booking.event_date ? new Date(booking.event_date).toLocaleDateString() : '—'}</span></div>
                          {booking.start_time && <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span>{booking.start_time}</span></div>}
                          <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span>{booking.duration_hours ? `${booking.duration_hours} hrs` : '—'}</span></div>
                          <div className="flex items-center gap-1.5 text-ink-500"><MapPin className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.location || '—'}</span></div>
                        </div>

                        {displayNote && <div className="bg-paper-200/50 p-2.5 border border-line text-xs mb-4 text-ink-600 italic">"{displayNote}"</div>}

                        <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setSelectedBooking(booking)} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide-sm text-ink hover:underline">
                            <Eye className="w-3.5 h-3.5 text-ink-400" /> View Details
                          </button>

                          <div className="flex flex-wrap items-center gap-2">
                            {booking.status === 'pending' && (
                              <>
                                <button onClick={() => updateBookingStatus(booking.id, 'declined')} disabled={updatingId === booking.id} className="btn-outline px-3 py-1.5 text-xs text-red-600 border-red-200">Decline</button>
                                <button onClick={() => updateBookingStatus(booking.id, 'accepted')} disabled={updatingId === booking.id} className="btn-primary px-3 py-1.5 text-xs">Accept</button>
                              </>
                            )}

                            {isPendingVerification && (
                              <button onClick={() => artistConfirmBooking(booking.id)} disabled={updatingId === booking.id} className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm">
                                Confirm Payment Reference
                              </button>
                            )}

                            {!isCompleted && ['confirmed', 'accepted', 'checked_in', 'fully_paid'].includes(booking.status || '') && !isPendingVerification && (
                              <>
                                {!booking.is_arrival_verified ? (
                                  <button onClick={() => setActiveVerifyBooking({ id: booking.id, eventName: booking.event_name || 'Event' })} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm">
                                    <KeyRound className="w-3.5 h-3.5 inline mr-1" /> Enter Pass Code
                                  </button>
                                ) : (
                                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm">Arrived</span>
                                )}
                                <button onClick={() => setActiveCheckoutBooking({ id: booking.id, eventName: booking.event_name || 'Event' })} className="bg-ink text-paper px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm">Check Out</button>
                                <button onClick={() => navigate('/inbox')} className="btn-outline px-3 py-1.5 text-xs"><MessageSquare className="w-3.5 h-3.5 inline mr-1" /> Message</button>
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

        {selectedBooking && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
            <div className="bg-paper border border-line p-6 max-w-xl w-full shadow-2xl relative space-y-4" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedBooking(null)} className="absolute top-4 right-4 text-ink-400 hover:text-ink"><X className="w-5 h-5" /></button>
              <h2 className="font-display text-2xl font-bold text-ink">{selectedBooking.event_name}</h2>
              <p className="text-xs text-ink-500">Location: {selectedBooking.location}</p>
              <p className="text-xs text-ink-500">Total Price: {formatCurrency(selectedBooking.total_amount || selectedBooking.total_price)}</p>
              <button onClick={() => setSelectedBooking(null)} className="btn-primary w-full py-2 text-xs">Close</button>
            </div>
          </div>
        )}

        {activeVerifyBooking && (
          <TalentVerificationModal bookingId={activeVerifyBooking.id} eventName={activeVerifyBooking.eventName} isOpen={!!activeVerifyBooking} onClose={() => setActiveVerifyBooking(null)} onVerified={() => { setActiveVerifyBooking(null); loadDashboardData(false); }} />
        )}

        {activeCheckoutBooking && (
          <TalentCheckoutModal bookingId={activeCheckoutBooking.id} eventName={activeCheckoutBooking.eventName} isOpen={!!activeCheckoutBooking} onClose={() => setActiveCheckoutBooking(null)} onCheckoutSuccess={() => { setActiveCheckoutBooking(null); loadDashboardData(false); }} />
        )}

        {reviewBookingTarget && (
          <ReviewModal isOpen={isReviewModalOpen} onClose={() => { setIsReviewModalOpen(false); setReviewBookingTarget(null); }} bookingId={reviewBookingTarget.id} artistId={reviewBookingTarget.artist_id || profile?.id} targetHostId={reviewBookingTarget.host_id || reviewBookingTarget.client_id} hostName={reviewBookingTarget.host?.full_name || 'Host'} onSuccess={() => loadDashboardData(false)} />
        )}

        {selectedGigForPitch && (
          <PitchGigModal isOpen={isPitchModalOpen} onClose={() => { setIsPitchModalOpen(false); setSelectedGigForPitch(null); }} gigId={selectedGigForPitch.id} gigTitle={selectedGigForPitch.title} eventDate={selectedGigForPitch.event_date} startTime={selectedGigForPitch.start_time} durationHours={selectedGigForPitch.duration_hours} location={selectedGigForPitch.location} hostId={selectedGigForPitch.host_id} hostName={selectedGigForPitch.host?.full_name} hostAvatar={selectedGigForPitch.host?.avatar_url} suggestedBudget={selectedGigForPitch.budget} onSuccess={() => loadDashboardData(false)} />
        )}

      </div>
    </div>
  );
}

export default function ArtistDashboard() {
  return (
    <DashboardErrorBoundary>
      <ArtistDashboardContent />
    </DashboardErrorBoundary>
  );
}
