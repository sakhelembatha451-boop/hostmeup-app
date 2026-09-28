import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Loader2, 
  Package, 
  FileText, 
  CalendarPlus, 
  DollarSign, 
  CheckCircle2, 
  ShieldAlert, 
  X, 
  QrCode, 
  KeyRound,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge, EmptyState, Tag } from '@/components/UI';
import HostStatusBadge from '@/components/HostStatusBadge';

type BookingWithArtist = Booking & {
  balance_paid?: boolean;
  deposit_paid?: boolean;
  verification_pin?: string;
  verification_token?: string;
  is_arrival_verified?: boolean;
  arrival_verified_at?: string;
  artist?: { id: string; full_name: string; avatar_url: string | null; location: string };
};

function formatCurrency(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

export default function HostDashboard() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<BookingWithArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithArtist | null>(null);

  // Deletion and Selection State
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Host Verification State
  const [hostVerification, setHostVerification] = useState<{
    is_identity_verified: boolean;
    verification_status: 'pending' | 'approved' | 'rejected' | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;

    try {
      let rawBookings: any[] = [];
      let fetchErr: any = null;

      const res1 = await supabase
        .from('bookings')
        .select(`*, artist:profiles!bookings_artist_id_fkey(id, full_name, avatar_url, location)`)
        .eq('host_id', profile.id)
        .or('is_deleted.is.null,is_deleted.eq.false')
        .order('created_at', { ascending: false });

      if (res1.error) {
        const res1Retry = await supabase
          .from('bookings')
          .select('*')
          .eq('host_id', profile.id)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('created_at', { ascending: false });

        if (!res1Retry.error) {
          rawBookings = res1Retry.data || [];
        } else {
          fetchErr = res1Retry.error;
        }
      } else {
        rawBookings = res1.data || [];
      }

      if (fetchErr && fetchErr.message?.includes("Could not find the table")) {
        const res2 = await supabase
          .from('booking')
          .select('*')
          .eq('host_id', profile.id)
          .or('is_deleted.is.null,is_deleted.eq.false')
          .order('created_at', { ascending: false });

        if (res2.data) {
          rawBookings = res2.data;
        }
      }

      if (rawBookings.length > 0) {
        const artistIds = Array.from(new Set(rawBookings.map((b) => b.artist_id).filter(Boolean)));
        
        if (artistIds.length > 0) {
          const { data: artistProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, location')
            .in('id', artistIds);

          const profileMap = new Map((artistProfiles || []).map((p) => [p.id, p]));

          rawBookings = rawBookings.map((b) => ({
            ...b,
            artist: b.artist || profileMap.get(b.artist_id) || null,
          }));
        }
      }

      setBookings(rawBookings as BookingWithArtist[]);

      if (selectedBooking) {
        const updatedSelected = rawBookings.find((b) => b.id === selectedBooking.id);
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
    } catch (err) {
      console.error('Error loading host dashboard bookings:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [profile, selectedBooking]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- DELETE HANDLERS ---
  const handleDeleteBookings = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;

    const confirmMsg = idsToDelete.length === 1 
      ? "Are you sure you want to delete this booking card?"
      : `Are you sure you want to delete ${idsToDelete.length} booking cards?`;

    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(true);
    try {
      // Soft delete using is_deleted flag (or change to .delete() if you want hard deletes)
      let { error } = await supabase
        .from('bookings')
        .update({ is_deleted: true })
        .in('id', idsToDelete);

      if (error && error.message.includes("Could not find the table")) {
        await supabase
          .from('booking')
          .update({ is_deleted: true })
          .in('id', idsToDelete);
      }

      // Reset selection and reload data
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

  // Checkbox toggle handler
  const toggleSelectBooking = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBookingIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all / Deselect all
  const toggleSelectAll = () => {
    const visibleIds = filtered.map((b) => b.id);
    if (selectedBookingIds.length === visibleIds.length) {
      setSelectedBookingIds([]);
    } else {
      setSelectedBookingIds(visibleIds);
    }
  };

  const updateBookingStatus = async (id: string, status: string) => {
    let { error } = await supabase.from('bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error && error.message.includes("Could not find the table")) {
      await supabase.from('booking').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    }
    loadData();
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed' || b.deposit_paid).length,
    accepted: bookings.filter((b) => b.status === 'accepted').length,
    declined: bookings.filter((b) => b.status === 'declined').length,
  };

  const isHostVerified = hostVerification?.is_identity_verified || hostVerification?.verification_status === 'approved';

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
        
        {/* Verification Banner */}
        {!isHostVerified && (
          <div className="flex items-start justify-between gap-3 p-4 mb-8 border border-amber-200 bg-amber-50 text-amber-900 text-xs">
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Host Dashboard</p>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-4xl font-bold text-ink tracking-tight">Your Bookings</h1>
              <HostStatusBadge 
                isVerified={hostVerification?.is_identity_verified}
                verificationStatus={hostVerification?.verification_status}
              />
            </div>
            <p className="text-ink-400">Track your booking requests and payment status.</p>
          </div>
          <Link to="/artists" aria-label="Browse and book talent" className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm">
            <CalendarPlus className="w-3.5 h-3.5" /> Book Talent
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 border-y border-line py-6">
          {[
            { label: 'Total', value: counts.all },
            { label: 'Pending', value: counts.pending },
            { label: 'Deposit Paid', value: counts.confirmed },
            { label: 'Declined', value: counts.declined },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="font-display text-4xl font-bold text-ink mb-1">{stat.value}</div>
              <div className="text-xs uppercase tracking-wide-sm text-ink-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters & Bulk Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-line">
          <div className="flex flex-wrap gap-2">
            {['all', 'pending', 'confirmed', 'accepted', 'declined'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`filter-chip capitalize ${filter === f ? 'filter-chip-active' : 'filter-chip-inactive'}`}>
                {f} {counts[f as keyof typeof counts] > 0 && `(${counts[f as keyof typeof counts]})`}
              </button>
            ))}
          </div>

          {/* Bulk Selection Actions */}
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
              const isSelected = selectedBookingIds.includes(booking.id);

              return (
                <div 
                  key={booking.id} 
                  onClick={() => setSelectedBooking(booking)}
                  className={`border p-6 bg-white cursor-pointer animate-fade-in transition-all relative ${
                    isSelected ? 'border-red-400 bg-red-50/10 shadow-sm' : 'border-line hover:border-ink/40 hover:shadow-sm'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                    {/* Bulk Select Checkbox & Talent info */}
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

                      <Link to={`/artists/${booking.artist_id}`} aria-label={`View ${booking.artist?.full_name || 'talent'} profile`}>
                        {booking.artist?.avatar_url ? (
                          <img src={booking.artist.avatar_url} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover border border-line" />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-ink text-paper flex items-center justify-center font-display text-lg font-bold">{booking.artist?.full_name?.[0]?.toUpperCase() || '?'}</div>
                        )}
                      </Link>
                      <div>
                        <Link to={`/artists/${booking.artist_id}`} className="font-display font-semibold text-ink hover:text-accent transition-colors block">
                          {booking.artist?.full_name || 'Talent'}
                        </Link>
                        {booking.artist?.location && <div className="text-xs text-ink-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{booking.artist.location}</div>}
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="font-display text-xl font-semibold text-ink">{booking.event_name}</h3>
                        
                        <div className="flex items-center gap-2">
                          <StatusBadge status={booking.status} />

                          {/* Single Card Delete Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBookings([booking.id]);
                            }}
                            className="p-1.5 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete booking card"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Event details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                        <div className="flex items-center gap-1.5 text-ink-500"><Calendar className="w-3.5 h-3.5 text-ink-300" /><span>{new Date(booking.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                        {booking.start_time && <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span>{booking.start_time}</span></div>}
                        <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.gig_duration}</span></div>
                        <div className="flex items-center gap-1.5 text-ink-500"><MapPin className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.location}</span></div>
                      </div>

                      {/* Notes & Actions */}
                      {booking.status === 'pending' && (
                        <div className="pt-3 border-t border-line flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                            className="text-sm font-medium text-red-500 hover:text-red-600 uppercase tracking-wide-sm transition-colors">Cancel Request</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
