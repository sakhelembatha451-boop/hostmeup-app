import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, MapPin, Clock, Loader2, Package, FileText, Check, X, 
  ExternalLink, ShieldCheck, Eye, MessageSquare, AlertCircle 
} from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge, EmptyState, Tag } from '@/components/UI';
import HostStatusBadge from '@/components/HostStatusBadge';

type BookingWithHost = Booking & {
  conversation_id?: string | null;
  host?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    location: string;
    email?: string;
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

  // Modal State for Booking Details
  const [selectedBooking, setSelectedBooking] = useState<BookingWithHost | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!profile) return;

    setLoading(true);

    try {
      // 1. Fetch artist profile ID
      const { data: artistProfile } = await supabase
        .from('artist_profiles')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      const targetArtistIds = Array.from(new Set([profile.id, artistProfile?.id].filter(Boolean)));

      let rawBookings: any[] = [];
      let fetchError: any = null;

      // 2. Primary attempt: Query 'bookings' with explicit FK relationships
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

      // 3. Fallback attempt: Query 'booking' table
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

      // 4. Hydrate Host details manually if auto-join wasn't performed
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

      setBookings(rawBookings as BookingWithHost[]);

      // Keep current modal selection fresh if open
      if (selectedBooking) {
        const updatedSelected = rawBookings.find((b) => b.id === selectedBooking.id);
        if (updatedSelected) setSelectedBooking(updatedSelected as BookingWithHost);
      }
    } catch (err) {
      console.error('Error loading artist dashboard data:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [profile, selectedBooking]);

  useEffect(() => { 
    loadDashboardData(); 
  }, [loadDashboardData]);

  const updateBookingStatus = async (id: string, newStatus: 'accepted' | 'declined') => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error && error.message?.includes("Could not find the table")) {
        await supabase
          .from('booking')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', id);
      }

      await loadDashboardData();
    } catch (err) {
      console.error('Error updating booking status:', err);
      alert('Could not update booking status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    accepted: bookings.filter((b) => b.status === 'accepted').length,
    declined: bookings.filter((b) => b.status === 'declined').length,
  };

  const totalEarnings = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'accepted')
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);
  
  const depositedAmount = bookings
    .filter((b) => b.deposit_paid)
    .reduce((sum, b) => sum + (b.deposit_amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Talent Dashboard</p>
            <h1 className="font-display text-4xl font-bold text-ink mb-1 tracking-tight">Incoming Requests</h1>
            <p className="text-ink-400">View, manage, and respond to your gig booking requests.</p>
          </div>
          <Link to={`/artists/${profile?.id}`} aria-label="View your public profile" className="btn-outline inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm">
            <ExternalLink className="w-3.5 h-3.5" /> View Public Profile
          </Link>
        </div>

        {/* Earnings + Stats */}
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
          {['all', 'pending', 'confirmed', 'accepted', 'declined'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`filter-chip capitalize ${filter === f ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
              {f} {counts[f as keyof typeof counts] > 0 && `(${counts[f as keyof typeof counts]})`}
            </button>
          ))}
        </div>

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
                        <Eye className="w-3.5 h-3.5 text-ink-400" /> View Full Details
                      </button>

                      <div className="flex items-center gap-2">
                        {/* Status Pending -> Show Accept / Decline */}
                        {booking.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => updateBookingStatus(booking.id, 'declined')}
                              disabled={updatingId === booking.id}
                              className="btn-outline inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wide-sm text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 disabled:opacity-50">
                              {updatingId === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Decline
                            </button>
                            <button 
                              onClick={() => updateBookingStatus(booking.id, 'accepted')}
                              disabled={updatingId === booking.id}
                              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wide-sm disabled:opacity-50">
                              {updatingId === booking.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Accept Request
                            </button>
                          </>
                        )}

                        {/* Status Confirmed or Accepted -> Option to Message Host */}
                        {(booking.status === 'confirmed' || booking.status === 'accepted') && (
                          <button
                            onClick={() => navigate('/inbox')}
                            className="btn-outline inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-wide-sm">
                            <MessageSquare className="w-3.5 h-3.5" /> Message Host
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detailed Booking Modal Drawer */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-paper border border-line p-6 max-w-xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setSelectedBooking(null)} 
                className="absolute top-4 right-4 text-ink-400 hover:text-ink">
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={selectedBooking.status} />
                <span className="text-xs text-ink-400">ID: {selectedBooking.id.substring(0, 8)}...</span>
              </div>

              <h2 className="font-display text-2xl font-bold text-ink mb-1">{selectedBooking.event_name}</h2>
              <p className="text-xs text-ink-400 mb-6">Host Request Details</p>

              {/* Host Summary */}
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

              {/* Performance Details */}
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

                {/* Requirements / Equipment */}
                {selectedBooking.equipment_needed && selectedBooking.equipment_needed.length > 0 && (
                  <div className="border-b border-line pb-3">
                    <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-2">Requested Equipment</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBooking.equipment_needed.map((eq) => <Tag key={eq} label={eq} />)}
                    </div>
                  </div>
                )}

                {/* Host Notes */}
                {selectedBooking.notes && (
                  <div>
                    <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-1">Host Notes / Instructions</span>
                    <p className="text-sm text-ink-500 bg-paper-200 p-3 border border-line rounded">{selectedBooking.notes}</p>
                  </div>
                )}
              </div>

              {/* Financial Breakdown */}
              <div className="border border-line bg-paper-200 p-4 mb-6">
                <h4 className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3 font-semibold">Financial Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-400">Total Booking Value:</span>
                    <span className="font-bold text-ink">{formatCurrency(selectedBooking.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-400">Upfront Deposit (40%):</span>
                    <span className="font-bold text-accent">{formatCurrency(selectedBooking.deposit_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-400">Post-Gig Balance (60%):</span>
                    <span className="font-bold text-ink-500">
                      {formatCurrency(selectedBooking.total_amount != null && selectedBooking.deposit_amount != null ? selectedBooking.total_amount - selectedBooking.deposit_amount : null)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
                {selectedBooking.status === 'pending' ? (
                  <>
                    <button
                      onClick={() => {
                        updateBookingStatus(selectedBooking.id, 'declined');
                        setSelectedBooking(null);
                      }}
                      className="btn-outline px-4 py-2 text-xs uppercase tracking-wide-sm text-red-600 border-red-200 hover:bg-red-50">
                      Decline Request
                    </button>
                    <button
                      onClick={() => {
                        updateBookingStatus(selectedBooking.id, 'accepted');
                        setSelectedBooking(null);
                      }}
                      className="btn-primary px-5 py-2 text-xs uppercase tracking-wide-sm">
                      Accept Booking
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="btn-primary px-5 py-2 text-xs uppercase tracking-wide-sm">
                    Close Details
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
