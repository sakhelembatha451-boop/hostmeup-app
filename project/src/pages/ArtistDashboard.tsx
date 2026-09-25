import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Calendar, MapPin, Clock, Loader2, Package, FileText, Check, X, User, ExternalLink, DollarSign } from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge, EmptyState, Tag } from '@/components/UI';
import HostStatusBadge from '@/components/HostStatusBadge';

type BookingWithHost = Booking & {
  host?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    location: string;
    host_profile?: {
      company_name?: string | null;
      is_identity_verified?: boolean;
      verification_status?: 'pending' | 'approved' | 'rejected' | null;
    } | null;
  };
};

function formatCurrency(n: number | null) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

export default function ArtistDashboard() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<BookingWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const loadBookings = useCallback(async () => {
    if (!profile) return;

    // Select query updated to retrieve host_profile verification details
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        host:profiles!bookings_host_id_fkey(
          id,
          full_name,
          avatar_url,
          location,
          host_profile:host_profiles(
            company_name,
            is_identity_verified,
            verification_status
          )
        )
      `)
      .eq('artist_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) { setBookings([]); }
    else { setBookings((data as unknown as BookingWithHost[]) || []); }
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const updateBookingStatus = async (id: string, status: string) => {
    await supabase.from('bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    loadBookings();
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    accepted: bookings.filter((b) => b.status === 'accepted').length,
    declined: bookings.filter((b) => b.status === 'declined').length,
  };

  // Total earnings from confirmed/accepted bookings
  const totalEarnings = bookings.filter((b) => b.status === 'confirmed' || b.status === 'accepted').reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const depositedAmount = bookings.filter((b) => b.deposit_paid).reduce((sum, b) => sum + (b.deposit_amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-5xl mx-auto px-6 lg:px-12 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Talent Dashboard</p>
            <h1 className="font-display text-4xl font-bold text-ink mb-1 tracking-tight">Incoming Requests</h1>
            <p className="text-ink-400">View and manage your booking requests.</p>
          </div>
          <Link to={`/artists/${profile?.id}`} aria-label="View your public profile" className="btn-outline inline-flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-wide-sm">
            <ExternalLink className="w-3.5 h-3.5" /> View Public Profile
          </Link>
        </div>

        {/* Profile completion check */}
        {(!profile?.bio || !profile?.location) && (
          <div className="border border-accent-200 bg-accent-50 p-5 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border border-accent-200 bg-paper flex items-center justify-center text-accent"><User className="w-5 h-5" /></div>
              <div>
                <div className="font-semibold text-ink text-sm">Complete your profile</div>
                <div className="text-xs text-ink-500">Add your bio and location to attract more hosts</div>
              </div>
            </div>
            <Link to="/artist-profile/edit" aria-label="Edit your profile" className="text-sm font-semibold text-accent hover:text-accent-600 uppercase tracking-wide-sm">Edit Profile →</Link>
          </div>
        )}

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
              <div key={booking.id} className="border border-line p-6 animate-fade-in transition-all hover:border-ink/20">
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
                    <div className="flex items-center gap-3 mb-4">
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
                            <DollarSign className="w-3.5 h-3.5" /> Deposit received — booking is financially secured.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Equipment */}
                    {booking.equipment_needed && booking.equipment_needed.length > 0 && (
                      <div className="flex items-start gap-1.5 mb-3"><Package className="w-4 h-4 text-ink-300 mt-0.5" /><div className="flex flex-wrap gap-1.5">{booking.equipment_needed.map((eq) => <Tag key={eq} label={eq} />)}</div></div>
                    )}

                    {/* Notes */}
                    {booking.notes && (
                      <div className="flex items-start gap-1.5 text-sm text-ink-500 mb-3"><FileText className="w-4 h-4 text-ink-300 mt-0.5 flex-shrink-0" /><span className="line-clamp-2">{booking.notes}</span></div>
                    )}

                    {/* Actions */}
                    {booking.status === 'pending' && (
                      <div className="pt-3 border-t border-line flex gap-3">
                        <button onClick={() => updateBookingStatus(booking.id, 'accepted')}
                          className="btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-xs uppercase tracking-wide-sm"><Check className="w-3.5 h-3.5" /> Accept</button>
                        <button onClick={() => updateBookingStatus(booking.id, 'declined')}
                          className="btn-outline inline-flex items-center gap-1.5 px-5 py-2.5 text-xs uppercase tracking-wide-sm text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"><X className="w-3.5 h-3.5" /> Decline</button>
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
