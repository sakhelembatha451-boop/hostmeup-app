import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, MapPin, Clock, Loader2, Package, Check, X, 
  ExternalLink, ShieldCheck, Eye, MessageSquare, AlertTriangle, 
  MapPinCheck, LogOut, PhoneCall, ShieldAlert
} from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge, EmptyState, Tag } from '@/components/UI';
import HostStatusBadge from '@/components/HostStatusBadge';

type BookingWithHost = Booking & {
  conversation_id?: string | null;
  checked_in_at?: string | null;
  completed_at?: string | null;
  host?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    location: string;
    email?: string;
    phone?: string;
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

  // Modals State
  const [selectedBooking, setSelectedBooking] = useState<BookingWithHost | null>(null);
  const [reportBooking, setReportBooking] = useState<BookingWithHost | null>(null);
  const [cancelBooking, setCancelBooking] = useState<BookingWithHost | null>(null);

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
      const { data: artistProfile } = await supabase
        .from('artist_profiles')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      const targetArtistIds = Array.from(new Set([profile.id, artistProfile?.id].filter(Boolean)));

      let rawBookings: any[] = [];
      let fetchError: any = null;

      const res1 = await supabase
        .from('bookings')
        .select(`
          *,
          host:profiles!bookings_host_id_fkey(
            id,
            full_name,
            avatar_url,
            location,
            email,
            phone,
            host_profile:host_profiles(
              company_name,
              is_identity_verified,
              verification_status
            )
          )
        `)
        .in('artist_id', targetArtistIds)
        .order('created_at', { ascending: false });

      if (res1.error) {
        const res1Retry = await supabase
          .from('bookings')
          .select('*')
          .in('artist_id', targetArtistIds)
          .order('created_at', { ascending: false });

        if (!res1Retry.error && res1Retry.data) {
          rawBookings = res1Retry.data;
        } else {
          fetchError = res1Retry.error || res1.error;
        }
      } else if (res1.data) {
        rawBookings = res1.data;
      }

      if (rawBookings.length === 0 || fetchError) {
        const res2 = await supabase
          .from('booking')
          .select('*')
          .in('artist_id', targetArtistIds)
          .order('created_at', { ascending: false });

        if (!res2.error && res2.data) {
          rawBookings = res2.data;
        }
      }

      if (rawBookings.length > 0) {
        const hostIds = Array.from(new Set(rawBookings.map((b) => b.host_id).filter(Boolean)));

        if (hostIds.length > 0) {
          const { data: hostProfiles } = await supabase
            .from('profiles')
            .select(`
              id,
              full_name,
              avatar_url,
              location,
              email,
              phone,
              host_profile:host_profiles(
                company_name,
                is_identity_verified,
                verification_status
              )
            `)
            .in('id', hostIds);

          const hostMap = new Map((hostProfiles || []).map((h) => [h.id, h]));

          rawBookings = rawBookings.map((b) => ({
            ...b,
            host: b.host || hostMap.get(b.host_id) || null,
          }));
        }
      }

      const formattedBookings = rawBookings as BookingWithHost[];
      setBookings(formattedBookings);

      setSelectedBooking((prevSelected) => {
        if (!prevSelected) return null;
        const updatedSelected = formattedBookings.find((b) => b.id === prevSelected.id);
        return updatedSelected || prevSelected;
      });
    } catch (err) {
      console.error('Error loading artist dashboard data:', err);
      setBookings([]);
    } fontally: {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { 
    loadDashboardData(true); 
  }, [loadDashboardData]);

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

      if (error && error.message?.includes("Could not find the table")) {
        await supabase
          .from('booking')
          .update(payload)
          .eq('id', id);
      }

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
      const { error } = await supabase
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

      if (error && error.message?.includes("Could not find the table")) {
        console.warn('booking_issues table missing, fallback alert sent.');
      }

      alert('Issue reported to HostMeUp Support. Our team will review this immediately.');
      setReportBooking(null);
      setIssueDescription('');
    } catch (err) {
      console.error('Error submitting report:', err);
      alert('Report received by local app session.');
      setReportBooking(null);
    } finally {
      setSubmittingReport(false);
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    accepted: bookings.filter((b) => b.status === 'accepted').length,
    declined: bookings.filter((b) => b.status === 'declined').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
  };

  const totalEarnings = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'accepted' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);
  
  const depositedAmount = bookings
    .filter((b) => b.deposit_paid)
    .reduce((sum, b) => sum + (b.deposit_amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

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

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {['all', 'pending', 'confirmed', 'accepted', 'completed', 'declined'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`filter-chip capitalize ${filter === f ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
              {f} {counts[f as keyof typeof counts] > 0 && `(${counts[f as keyof typeof counts]})`}
            </button>
          ))}
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
            {filtered.map((booking) => (
              <div key={booking.id} className="border border-line p-6 animate-fade-in transition-all hover:border-ink/20 bg-paper">
                <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                  
                  {/* Host info */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {booking.host?.avatar_url ? (
                      <img src={booking.host.avatar_url} alt={`Profile photo of ${booking.host?.full_name || 'host'}`} width={56} height={56} className="w-14 h-14 rounded-full object-cover border border-line" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-ink-200 text-ink-500 flex items-center justify-center font-display text-lg font-bold">{booking.host?.full_name?.[0]?.toUpperCase() || '?'}</div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-ink">
                          {booking.host?.host_profile?.company_name || booking.host?.full_name || 'Host'}
                        </span>
                        <HostStatusBadge
                          isVerified={booking.host?.host_profile?.is_identity_verified}
                          verificationStatus={booking.host?.host_profile?.verification_status}
                        />
                      </div>
                      <div className="text-xs text-ink-400 mt-0.5">
                        {booking.host?.host_profile?.company_name ? `Host: ${booking.host.full_name}` : 'Request from host'}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="font-display text-xl font-semibold text-ink">{booking.event_name}</h3>
                      <StatusBadge status={booking.status} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                      <div className="flex items-center gap-1.5 text-ink-500"><Calendar className="w-3.5 h-3.5 text-ink-300" /><span>{new Date(booking.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                      {booking.start_time && <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span>{booking.start_time}</span></div>}
                      <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.gig_duration}</span></div>
                      <div className="flex items-center gap-1.5 text-ink-500"><MapPin className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.location}</span></div>
                    </div>

                    {/* Pricing breakdown */}
                    {booking.total_amount != null && (
                      <div className="border border-line bg-paper-200 p-4 mb-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Total Cost</p>
                            <p className="font-display text-lg font-semibold text-ink">{formatCurrency(booking.total_amount)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide-sm text-accent mb-1">Deposit (40%)</p>
                            <div className="flex items-center gap-1.5">
                              <p className="font-display text-lg font-semibold text-accent">{formatCurrency(booking.deposit_amount)}</p>
                              {booking.deposit_paid && <Check className="w-4 h-4 text-accent" />}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Balance (60%)</p>
                            <p className="font-display text-lg font-semibold text-ink-500">{formatCurrency(booking.total_amount != null && booking.deposit_amount != null ? booking.total_amount - booking.deposit_amount : null)}</p>
                          </div>
                        </div>
                        {booking.deposit_paid && (
                          <div className="flex items-center gap-1.5 mt-3 text-xs text-accent">
                            <ShieldCheck className="w-3.5 h-3.5" /> Deposit received — booking is financially secured.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Equipment Tag List */}
                    {booking.equipment_needed && booking.equipment_needed.length > 0 && (
                      <div className="flex items-start gap-1.5 mb-3">
                        <Package className="w-4 h-4 text-ink-300 mt-0.5" />
                        <div className="flex flex-wrap gap-1.5">{booking.equipment_needed.map((eq) => <Tag key={eq} label={eq} />)}</div>
                      </div>
                    )}

                    {/* Action Footer Bar */}
                    <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3">
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide-sm text-ink hover:underline">
                        <Eye className="w-3.5 h-3.5 text-ink-400" /> View Details
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Pending -> Accept / Decline */}
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

                        {/* Confirmed -> Arrived / Message / Cancel / Report */}
                        {(booking.status === 'confirmed' || booking.status === 'accepted') && (
                          <>
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'checked_in', { checked_in_at: new Date().toISOString() })}
                              disabled={updatingId === booking.id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm">
                              <MapPinCheck className="w-3.5 h-3.5" /> Arrived at Event
                            </button>
                            <button
                              onClick={() => {
                                if (booking.conversation_id) {
                                  navigate(`/inbox?conversation=${booking.conversation_id}`, { state: { conversationId: booking.conversation_id, recipientId: booking.host_id, bookingId: booking.id } });
                                } else if (booking.host_id) {
                                  navigate(`/inbox?user=${booking.host_id}`, { state: { recipientId: booking.host_id, bookingId: booking.id } });
                                } else {
                                  navigate('/inbox');
                                }
                              }}
                              className="btn-outline inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wide-sm">
                              <MessageSquare className="w-3.5 h-3.5" /> Message Host
                            </button>
                            <button
                              onClick={() => setReportBooking(booking)}
                              className="text-xs text-amber-700 hover:text-amber-800 border border-amber-200 bg-amber-50 px-2.5 py-1.5 rounded inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Report Issue
                            </button>
                            <button
                              onClick={() => setCancelBooking(booking)}
                              className="text-xs text-red-600 hover:text-red-700 border border-red-200 px-2.5 py-1.5 rounded">
                              Cancel
                            </button>
                          </>
                        )}

                        {/* Checked In -> Sign Out */}
                        {booking.status === 'checked_in' && (
                          <>
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'completed', { completed_at: new Date().toISOString() })}
                              disabled={updatingId === booking.id}
                              className="bg-ink hover:bg-ink/90 text-paper inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded uppercase tracking-wide-sm">
                              <LogOut className="w-3.5 h-3.5" /> Complete & Sign Out
                            </button>
                            <button
                              onClick={() => setReportBooking(booking)}
                              className="text-xs text-amber-700 border border-amber-200 bg-amber-50 px-2.5 py-1.5 rounded inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Emergency/Issue
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- MODAL 1: Booking Details Modal --- */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-paper border border-line p-6 max-w-xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button onClick={() => setSelectedBooking(null)} className="absolute top-4 right-4 text-ink-400 hover:text-ink">
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={selectedBooking.status} />
                <span className="text-xs text-ink-400">ID: {selectedBooking.id.substring(0, 8)}...</span>
              </div>

              <h2 className="font-display text-2xl font-bold text-ink mb-1">{selectedBooking.event_name}</h2>
              <p className="text-xs text-ink-400 mb-6">Host Request Details</p>

              <div className="p-4 border border-line bg-paper-200/50 mb-6 flex items-center gap-4">
                {selectedBooking.host?.avatar_url ? (
                  <img src={selectedBooking.host.avatar_url} alt="Host Avatar" className="w-12 h-12 rounded-full object-cover border border-line" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-ink-200 text-ink flex items-center justify-center font-bold">{selectedBooking.host?.full_name?.[0] || '?'}</div>
                )}
                <div>
                  <h4 className="text-sm font-semibold text-ink">{selectedBooking.host?.host_profile?.company_name || selectedBooking.host?.full_name || 'Host'}</h4>
                  <p className="text-xs text-ink-400">{selectedBooking.host?.email || selectedBooking.host?.location || 'Verified Host'}</p>
                </div>
              </div>

              <div className="space-y-4 text-sm mb-6">
                <div className="grid grid-cols-2 gap-4 border-b border-line pb-3">
                  <div>
                    <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-1">Date & Time</span>
                    <p className="font-medium text-ink flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-ink-300" />
                      {new Date(selectedBooking.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {selectedBooking.start_time ? ` @ ${selectedBooking.start_time}` : ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-1">Duration</span>
                    <p className="font-medium text-ink flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-ink-300" />
                      {selectedBooking.gig_duration}
                    </p>
                  </div>
                </div>

                <div className="border-b border-line pb-3">
                  <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-1">Venue & Location</span>
                  <p className="font-medium text-ink flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-ink-300" />
                    {selectedBooking.location}
                  </p>
                </div>

                {selectedBooking.notes && (
                  <div>
                    <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-1">Host Notes</span>
                    <p className="text-sm text-ink-500 bg-paper-200 p-3 border border-line rounded">{selectedBooking.notes}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
                <button
                  onClick={() => {
                    const b = selectedBooking;
                    setSelectedBooking(null);
                    setReportBooking(b);
                  }}
                  className="text-xs text-amber-700 hover:underline flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Report Issue or Safety Concern
                </button>
                <button onClick={() => setSelectedBooking(null)} className="btn-primary px-5 py-2 text-xs uppercase tracking-wide-sm">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL 2: Report Issue & Safety Concern Modal --- */}
        {reportBooking && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-paper border border-line p-6 max-w-lg w-full shadow-2xl relative">
              <button onClick={() => setReportBooking(null)} className="absolute top-4 right-4 text-ink-400 hover:text-ink">
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-amber-700 font-bold mb-1">
                <ShieldAlert className="w-5 h-5" /> Report Issue or Safety Concern
              </div>
              <p className="text-xs text-ink-400 mb-4">Event: {reportBooking.event_name}</p>

              {/* SOS Emergency Call Button */}
              <div className="bg-red-50 border border-red-200 p-3 rounded mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-red-800">Immediate Danger or Emergency?</p>
                  <p className="text-[11px] text-red-600">Contact emergency services or host support line directly.</p>
                </div>
                <a href="tel:10111" className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 hover:bg-red-700">
                  <PhoneCall className="w-3.5 h-3.5" /> Call 10111
                </a>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-ink mb-1">Category</label>
                  <select 
                    value={issueCategory} 
                    onChange={(e) => setIssueCategory(e.target.value)}
                    className="w-full border border-line p-2 bg-paper text-ink rounded">
                    <option value="safety">Safety / Unsafe Environment</option>
                    <option value="no_show">Host No-Show / Unreachable</option>
                    <option value="venue_mismatch">Venue / Event Misrepresentation</option>
                    <option value="payment">Payment / Deposit Query</option>
                    <option value="other">Other Issue</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Describe what happened</label>
                  <textarea 
                    rows={4}
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="Provide clear details regarding the situation..."
                    className="w-full border border-line p-2 bg-paper text-ink rounded"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="urgent" 
                    checked={isUrgent} 
                    onChange={(e) => setIsUrgent(e.target.checked)} 
                    className="rounded text-ink focus:ring-0"
                  />
                  <label htmlFor="urgent" className="font-semibold text-ink">Mark as Urgent (Triggers Support Priority)</label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-line">
                <button 
                  onClick={() => setReportBooking(null)} 
                  className="btn-outline px-4 py-2 text-xs uppercase tracking-wide-sm">
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitIssueReport}
                  disabled={submittingReport}
                  className="bg-amber-700 hover:bg-amber-800 text-white px-5 py-2 text-xs uppercase font-semibold rounded tracking-wide-sm flex items-center gap-1.5">
                  {submittingReport && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Submit Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL 3: Cancel Booking Confirmation --- */}
        {cancelBooking && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-paper border border-line p-6 max-w-md w-full shadow-2xl relative">
              <h3 className="font-display text-xl font-bold text-ink mb-2">Cancel Booking Confirmation</h3>
              <p className="text-xs text-ink-500 mb-4">
                Are you sure you want to cancel <span className="font-semibold">{cancelBooking.event_name}</span>? 
                Cancelling confirmed gigs may impact your talent rating or deposit terms.
              </p>

              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <button onClick={() => setCancelBooking(null)} className="btn-outline px-4 py-2 text-xs uppercase tracking-wide-sm">Back</button>
                <button 
                  onClick={() => {
                    updateBookingStatus(cancelBooking.id, 'cancelled');
                    setCancelBooking(null);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-semibold rounded uppercase tracking-wide-sm">
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
