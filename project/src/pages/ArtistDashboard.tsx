import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, MapPin, Clock, Loader2, Package, Check, X, 
  ExternalLink, ShieldCheck, Eye, MessageSquare, AlertTriangle, 
  MapPinCheck, LogOut, PhoneCall, ShieldAlert, CheckCircle2, KeyRound,
  Trash2, CheckSquare, Square, User, Mail, DollarSign, FileText, Clock3,
  PartyPopper
} from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge, EmptyState, Tag } from '@/components/UI';
import HostStatusBadge from '@/components/HostStatusBadge';
import TalentVerificationModal from '@/components/TalentVerificationModal';
import TalentCheckoutModal from '@/components/TalentCheckoutModal';

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

function formatCurrency(n: number | null) {
  if (n == null) return 'R0';
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function ArtistDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingWithHost[]>([]);
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
        return;
      }

      if (!rawBookings || rawBookings.length === 0) {
        setBookings([]);
        return;
      }

      const activeBookings = rawBookings.filter((b) => !b.is_deleted);

      if (activeBookings.length === 0) {
        setBookings([]);
        return;
      }

      let processedBookings = activeBookings;
      const hostIds = Array.from(
        new Set(activeBookings.map((b) => b.host_id || b.client_id).filter(Boolean))
      );

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

      const formattedBookings = processedBookings as BookingWithHost[];
      setBookings(formattedBookings);

      setSelectedBooking((prevSelected) => {
        if (!prevSelected) return null;
        const updatedSelected = formattedBookings.find((b) => b.id === prevSelected.id);
        return updatedSelected || prevSelected;
      });
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
      setSelectedBookingIds((prev) => prev.filter((id) => id !== id));

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

  const renderCustomStatusBadge = (booking: BookingWithHost) => {
    const isCompleted = booking.status === 'completed' || !!booking.completed_at;
    const isCheckedIn = booking.is_arrival_verified || booking.status === 'checked_in';
    const isFullyPaid = booking.balance_paid || booking.status === 'fully_paid';
    const isDepositPaid = booking.deposit_paid || booking.status === 'confirmed';
    const isPendingVerification = booking.status === 'pending_verification';

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

      if (error) {
        console.error('Supabase update status error:', error);
        throw error;
      }

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
    const isRemainingBalancePayment = targetBooking?.deposit_paid;

    const confirmPromptText = isRemainingBalancePayment
      ? "CONFIRMATION NOTICE:\n\nYou confirm that you have checked your email or Yoco notification and received the REMAINING BALANCE payment.\n\nBy clicking OK, you agree that you have verified the funds and acknowledge full payment for this event."
      : "CONFIRMATION NOTICE:\n\nYou confirm that you have checked your email or Yoco notification and received the DEPOSIT payment.\n\nBy clicking OK, you agree that you have verified the funds and unlocked the event pass for the host.";

    if (!window.confirm(confirmPromptText)) return;

    setUpdatingId(bookingId);
    try {
      const generatedPin = targetBooking?.verification_pin || Math.floor(1000 + Math.random() * 9000).toString();

      const updatePayload = isRemainingBalancePayment ? {
        status: 'fully_paid',
        balance_paid: true,
        notes: `[Full Payment Verified & Confirmed by Talent]`
      } : {
        status: 'confirmed',
        deposit_paid: true,
        verification_pin: generatedPin,
        notes: `[Deposit Verified & Confirmed by Talent]`
      };

      const { error } = await supabase
        .from('bookings')
        .update(updatePayload)
        .eq('id', bookingId);

      if (error) throw error;

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
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Talent Dashboard</p>
            <h1 className="font-display text-4xl font-bold text-ink mb-1 tracking-tight">Incoming Requests</h1>
            <p className="text-ink-400">View, manage, check into events, and monitor safety features.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/artists/${profile?.id}`} aria-label="View public profile" className="btn-outline inline-flex items-center gap-2 px-4 py-2.5 text-xs uppercase tracking-wide-sm">
              <ExternalLink className="w-3.5 h-3.5" /> View Profile
            </Link>
          </div>
        </div>

        {/* Earnings & Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 border-y border-line py-6">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'pending_verification', 'confirmed', 'accepted', 'completed', 'declined'].map((f) => (
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

        {/* Booking Card List */}
        {filtered.length === 0 ? (
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
                      {booking.host?.avatar_url ? (
                        <img src={booking.host.avatar_url} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover border border-line" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-ink-200 text-ink-500 flex items-center justify-center font-display text-lg font-bold">{booking.host?.full_name?.[0]?.toUpperCase() || '?'}</div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display font-semibold text-ink">
                            {booking.host?.full_name || 'Host'}
                          </span>
                          <HostStatusBadge isVerified={true} verificationStatus="approved" />
                        </div>
                        <div className="text-xs text-ink-400 mt-0.5">Verified Host</div>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="font-display text-xl font-semibold text-ink">{booking.event_name || 'Untitled Event'}</h3>
                        {renderCustomStatusBadge(booking)}
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
                              onClick={() => setSelectedBooking(booking)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm shadow-xs transition-colors">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Payment
                            </button>
                          )}

                          {(booking.status === 'confirmed' || booking.status === 'accepted' || booking.status === 'checked_in' || booking.status === 'fully_paid') && !isPendingVerification && (
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

                              {booking.status !== 'completed' && (
                                <button
                                  onClick={() => setActiveCheckoutBooking({ id: booking.id, eventName: booking.event_name || 'Event' })}
                                  className="bg-ink hover:bg-ink/90 text-paper inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm shadow-xs transition-colors">
                                  <LogOut className="w-3.5 h-3.5" /> Check Out of Event
                                </button>
                              )}

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
        )}

        {/* Modal: Full Event Details */}
        {selectedBooking && (
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

              {/* Host Info */}
              <div className="p-4 border border-line bg-paper-100 flex items-center gap-4">
                {selectedBooking.host?.avatar_url ? (
                  <img src={selectedBooking.host.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-line" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-ink-200 text-ink-500 flex items-center justify-center font-display font-bold">
                    {selectedBooking.host?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <div className="font-display font-semibold text-ink text-sm flex items-center gap-2">
                    {selectedBooking.host?.full_name || 'Host'}
                    <HostStatusBadge isVerified={true} verificationStatus="approved" />
                  </div>
                  {selectedBooking.host?.email && (
                    <div className="text-xs text-ink-400 flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3 h-3 text-ink-300" /> {selectedBooking.host.email}
                    </div>
                  )}
                </div>
              </div>

              {/* Event Schedule & Location */}
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

              {/* Pricing Breakdown */}
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

              {/* Notes / Special Requests / Submitted Reference */}
              {(selectedBooking.notes || selectedBooking.special_requests) && (
                <div className="space-y-1 text-xs">
                  <span className="text-ink-400 uppercase tracking-wide-sm block">Host Notes & Submitted Yoco Reference</span>
                  <p className="p-3 bg-paper-100 border border-line text-ink-600 rounded-xs leading-relaxed font-mono">
                    {selectedBooking.notes || selectedBooking.special_requests}
                  </p>
                </div>
              )}

              {/* Modal Confirmation Action for Pending Verification */}
              {selectedBooking.status === 'pending_verification' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <Clock3 className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span>Host has submitted a payment reference. Please check your Resend email invoice or Yoco notification before confirming.</span>
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

              {/* Modal Actions */}
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
        )}

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

      </div>
    </div>
  );
}
