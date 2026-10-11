import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, MapPin, Clock, Loader2, Package, Check, X, 
  ExternalLink, ShieldCheck, Eye, MessageSquare, AlertTriangle, 
  MapPinCheck, LogOut, PhoneCall, ShieldAlert, CheckCircle2, KeyRound,
  Trash2, CheckSquare, Square
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
  const [reportBooking, setReportBooking] = useState<BookingWithHost | null>(null);
  const [cancelBooking, setCancelBooking] = useState<BookingWithHost | null>(null);
  const [activeVerifyBooking, setActiveVerifyBooking] = useState<{ id: string; eventName: string } | null>(null);
  const [activeCheckoutBooking, setActiveCheckoutBooking] = useState<{ id: string; eventName: string } | null>(null);

  // Issue Reporting Form State
  const [issueCategory, setIssueCategory] = useState<string>('safety');
  const [issueDescription, setIssueDescription] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState<boolean>(false);
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);

  const loadDashboardData = useCallback(async (isInitialLoad = false) => {
    if (!profile) return;

    if (isInitialLoad) {
      setLoading(true);
    }

    try {
      // 1. Resolve artist profile ID & user ID securely
      const { data: artistProfile } = await supabase
        .from('artist_profiles')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      // Collect all possible identifiers for this artist user (user ID, artist profile ID, and client fallback)
      const targetArtistIds = Array.from(
        new Set([profile.id, artistProfile?.id].filter(Boolean))
      );

      // 2. Query bookings matching artist_id OR client_id using safe .in() filters
      let { data: rawBookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('*')
        .in('artist_id', targetArtistIds)
        .or('is_deleted.eq.false,is_deleted.is.null')
        .order('created_at', { ascending: false });

      // Fallback check if table name is singular or if client_id needs matching too
      if (bookingsErr || !rawBookings || rawBookings.length === 0) {
        const fallback = await supabase
          .from('bookings')
          .select('*')
          .in('client_id', targetArtistIds)
          .or('is_deleted.eq.false,is_deleted.is.null')
          .order('created_at', { ascending: false });

        if (fallback.data && fallback.data.length > 0) {
          rawBookings = fallback.data;
        }
      }

      if (!rawBookings || rawBookings.length === 0) {
        setBookings([]);
        return;
      }

      // 3. Collect host identifiers and fetch profiles
      const hostIds = Array.from(
        new Set(rawBookings.map((b) => b.host_id || b.client_id).filter(Boolean))
      );

      let processedBookings = rawBookings;
      if (hostIds.length > 0) {
        const { data: profileRecords } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, location')
          .in('id', hostIds);

        const profileMap = new Map((profileRecords || []).map((p) => [p.id, p]));

        processedBookings = rawBookings.map((b) => {
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
  }, [profile]);

  useEffect(() => { 
    loadDashboardData(true); 
  }, [loadDashboardData]);

  // Handle Multi-selection Toggle
  const toggleSelectBooking = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedBookingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  // Toggle Select All filtered bookings
  const toggleSelectAll = () => {
    const allFilteredIds = filtered.map((b) => b.id);
    const areAllSelected = allFilteredIds.every((id) => selectedBookingIds.includes(id));

    if (areAllSelected) {
      setSelectedBookingIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedBookingIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  // Delete Bookings (Single or Bulk)
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

      let { error } = await supabase
        .from('bookings')
        .update({ is_deleted: true })
        .in('id', idsToDelete);

      if (error) {
        const hardDelete = await supabase
          .from('bookings')
          .delete()
          .in('id', idsToDelete);

        if (hardDelete.error) {
          throw hardDelete.error;
        }
      }
    } catch (err: any) {
      console.error('Error deleting booking(s):', err);
      alert(`Could not delete booking: ${err?.message || 'Database permission denied'}`);
      loadDashboardData(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Dynamic status badge renderer
  const renderCustomStatusBadge = (booking: BookingWithHost) => {
    const isFullyPaid = booking.balance_paid || booking.status === 'fully_paid';
    const isDepositPaid = booking.deposit_paid || booking.status === 'confirmed';

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

    return <StatusBadge status={booking.status} />;
  };

  // Update Booking Status Handler
  const updateBookingStatus = async (id: string, newStatus: string, extraFields: Record<string, any> = {}) => {
    setUpdatingId(id);
    try {
      const payload = { 
        status: newStatus, 
        updated_at: new Date().toISOString(),
        ...extraFields 
      };

      const { error } = await supabase
        .from('bookings')
        .update(payload)
        .eq('id', id);

      if (error) throw error;

      await loadDashboardData(false);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Could not update status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Submit Issue Report to Supabase
  const handleSubmitIssueReport = async () => {
    if (!reportBooking || !issueDescription.trim()) {
      alert('Please explain the issue before submitting.');
      return;
    }

    setSubmittingReport(true);
    try {
      await supabase
        .from('booking_issues')
        .insert({
          booking_id: reportBooking.id,
          reporter_id: profile?.id,
          category: issueCategory,
          description: issueDescription,
          is_urgent: isUrgent,
          status: 'open',
          created_at: new Date().toISOString()
        });

      alert('Issue reported to HostMeUp Support. Our team will review this immediately.');
      setReportBooking(null);
      setIssueDescription('');
    } catch (err) {
      console.error('Error submitting report:', err);
      setReportBooking(null);
    } finally {
      setSubmittingReport(false);
    }
  };

  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed' || b.deposit_paid).length,
    accepted: bookings.filter((b) => b.status === 'accepted').length,
    declined: bookings.filter((b) => b.status === 'declined').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
  };

  const totalEarnings = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'accepted' || b.status === 'completed' || b.status === 'fully_paid')
    .reduce((sum, b) => sum + (b.total_amount || b.total_price || 0), 0);
  
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
            <div className="font-display text-4xl font-bold text-ink mb-1">{counts.pending}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400">Pending</div>
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
            {['all', 'pending', 'confirmed', 'accepted', 'completed', 'declined'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`filter-chip capitalize ${filter === f ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
                {f} {counts[f as keyof typeof counts] > 0 && `(${counts[f as keyof typeof counts]})`}
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
                        <h3 className="font-display text-xl font-semibold text-ink">{booking.event_name}</h3>
                        {renderCustomStatusBadge(booking)}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                        <div className="flex items-center gap-1.5 text-ink-500"><Calendar className="w-3.5 h-3.5 text-ink-300" /><span>{new Date(booking.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                        {booking.start_time && <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span>{booking.start_time}</span></div>}
                        <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.gig_duration || `${booking.duration_hours || 1} hrs`}</span></div>
                        <div className="flex items-center gap-1.5 text-ink-500"><MapPin className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.location}</span></div>
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

                          {(booking.status === 'confirmed' || booking.status === 'accepted' || booking.status === 'checked_in') && (
                            <>
                              {!booking.is_arrival_verified ? (
                                <button
                                  onClick={() => setActiveVerifyBooking({ id: booking.id, eventName: booking.event_name })}
                                  className="bg-amber-600 hover:bg-amber-700 text-white inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm shadow-xs transition-colors">
                                  <KeyRound className="w-3.5 h-3.5" /> Enter Host Pass Code
                                </button>
                              ) : (
                                <button
                                  onClick={() => updateBookingStatus(booking.id, 'checked_in', { checked_in_at: new Date().toISOString() })}
                                  disabled={updatingId === booking.id}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm">
                                  <MapPinCheck className="w-3.5 h-3.5" /> Arrived at Event
                                </button>
                              )}

                              <button
                                onClick={() => setActiveCheckoutBooking({ id: booking.id, eventName: booking.event_name })}
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
        )}

        {/* Modal: Details */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedBooking(null)}>
            <div className="bg-paper border border-line p-6 max-w-xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedBooking(null)} className="absolute top-4 right-4 text-ink-400 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
              <h2 className="font-display text-2xl font-bold text-ink mb-1">{selectedBooking.event_name}</h2>
              <div className="pt-4 flex justify-end">
                <button onClick={() => setSelectedBooking(null)} className="btn-primary px-5 py-2 text-xs uppercase tracking-wide-sm">Close</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
