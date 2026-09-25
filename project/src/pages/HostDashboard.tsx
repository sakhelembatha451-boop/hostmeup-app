import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Calendar, MapPin, Clock, Loader2, Package, FileText, CalendarPlus, DollarSign, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge, EmptyState, Tag } from '@/components/UI';
import HostStatusBadge from '@/components/HostStatusBadge';

type BookingWithArtist = Booking & { artist?: { id: string; full_name: string; avatar_url: string | null; location: string } };

function formatCurrency(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

export default function HostDashboard() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<BookingWithArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [payingId, setPayingId] = useState<string | null>(null);

  // Host Verification State
  const [hostVerification, setHostVerification] = useState<{
    is_identity_verified: boolean;
    verification_status: 'pending' | 'approved' | 'rejected' | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;

    // 1. Fetch Bookings
    const { data: bookingsData, error } = await supabase
      .from('bookings')
      .select(`*, artist:profiles!bookings_artist_id_fkey(id, full_name, avatar_url, location)`)
      .eq('host_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) { setBookings([]); }
    else { setBookings((bookingsData as BookingWithArtist[]) || []); }

    // 2. Fetch Host Verification Status
    const { data: hostData } = await supabase
      .from('host_profiles')
      .select('is_identity_verified, verification_status')
      .eq('id', profile.id)
      .maybeSingle();

    if (hostData) {
      setHostVerification(hostData);
    }

    setLoading(false);
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateBookingStatus = async (id: string, status: string) => {
    await supabase.from('bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    loadData();
  };

  const payDeposit = async (id: string) => {
    setPayingId(id);
    await supabase.from('bookings').update({ deposit_paid: true, status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', id);
    setPayingId(null);
    loadData();
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    accepted: bookings.filter((b) => b.status === 'accepted').length,
    declined: bookings.filter((b) => b.status === 'declined').length,
  };

  const isHostVerified = hostVerification?.is_identity_verified || hostVerification?.verification_status === 'approved';

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
        
        {/* Verification Alert Banner */}
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
            title={bookings.length === 0 ? "No booking requests yet" : "No bookings match this filter"}
            message={bookings.length === 0 ? "Browse talent and send your first booking request to get started." : "Try a different filter."}
            actionLabel={bookings.length === 0 ? "Browse Talent" : undefined}
            actionTo={bookings.length === 0 ? "/artists" : undefined} />
        ) : (
          <div className="space-y-6">
            {filtered.map((booking) => (
              <div key={booking.id} className="border border-line p-6 animate-fade-in transition-all hover:border-ink/20">
                <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                  {/* Talent info */}
                  <Link to={`/artists/${booking.artist_id}`} aria-label={`View ${booking.artist?.full_name || 'talent'} profile`} className="flex items-center gap-4 flex-shrink-0">
                    {booking.artist?.avatar_url ? (
                      <img src={booking.artist.avatar_url} alt={`Profile photo of ${booking.artist?.full_name || 'talent'}`} width={56} height={56} className="w-14 h-14 rounded-full object-cover border border-line" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-ink text-paper flex items-center justify-center font-display text-lg font-bold">{booking.artist?.full_name?.[0]?.toUpperCase() || '?'}</div>
                    )}
                    <div>
                      <div className="font-display font-semibold text-ink hover:text-accent transition-colors">{booking.artist?.full_name || 'Talent'}</div>
                      {booking.artist?.location && <div className="text-xs text-ink-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{booking.artist.location}</div>}
                    </div>
                  </Link>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="font-display text-xl font-semibold text-ink">{booking.event_name}</h3>
                      <StatusBadge status={booking.status} />
                    </div>

                    {/* Event details */}
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
                              {booking.deposit_paid && <CheckCircle2 className="w-4 h-4 text-accent" />}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Balance (60%)</p>
                            <p className="font-display text-lg font-semibold text-ink-500">{formatCurrency(booking.total_amount != null && booking.deposit_amount != null ? booking.total_amount - booking.deposit_amount : null)}</p>
                          </div>
                        </div>
                        {!booking.deposit_paid && booking.status === 'pending' && (
                          <button onClick={() => payDeposit(booking.id)} disabled={payingId === booking.id}
                            className="btn-accent w-full mt-4 flex items-center justify-center gap-2 py-2.5 text-xs uppercase tracking-wide-sm disabled:opacity-50">
                            {payingId === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                            Pay {formatCurrency(booking.deposit_amount)} Deposit Now
                          </button>
                        )}
                      </div>
                    )}

                    {/* Equipment */}
                    {booking.equipment_needed && booking.equipment_needed.length > 0 && (
                      <div className="flex items-start gap-1.5 mb-3">
                        <Package className="w-4 h-4 text-ink-300 mt-0.5" />
                        <div className="flex flex-wrap gap-1.5">{booking.equipment_needed.map((eq) => <Tag key={eq} label={eq} />)}</div>
                      </div>
                    )}

                    {/* Notes */}
                    {booking.notes && (
                      <div className="flex items-start gap-1.5 text-sm text-ink-500 mb-3">
                        <FileText className="w-4 h-4 text-ink-300 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{booking.notes}</span>
                      </div>
                    )}

                    {/* Actions */}
                    {booking.status === 'pending' && (
                      <div className="pt-3 border-t border-line">
                        <button onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                          className="text-sm font-medium text-red-500 hover:text-red-600 uppercase tracking-wide-sm transition-colors">Cancel Request</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
