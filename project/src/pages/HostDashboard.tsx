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
  KeyRound 
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

  // Host Verification State
  const [hostVerification, setHostVerification] = useState<{
    is_identity_verified: boolean;
    verification_status: 'pending' | 'approved' | 'rejected' | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!profile) return;

    try {
      // 1. Fetch Bookings with fallback logic
      let rawBookings: any[] = [];
      let fetchErr: any = null;

      // Primary attempt: Query 'bookings' table
      const res1 = await supabase
        .from('bookings')
        .select(`*, artist:profiles!bookings_artist_id_fkey(id, full_name, avatar_url, location)`)
        .eq('host_id', profile.id)
        .order('created_at', { ascending: false });

      if (res1.error) {
        // Retry without FK alias if schema cache mismatch happens
        const res1Retry = await supabase
          .from('bookings')
          .select('*')
          .eq('host_id', profile.id)
          .order('created_at', { ascending: false });

        if (!res1Retry.error) {
          rawBookings = res1Retry.data || [];
        } else {
          fetchErr = res1Retry.error;
        }
      } else {
        rawBookings = res1.data || [];
      }

      // Secondary attempt: Fallback to 'booking' table if 'bookings' table is missing
      if (fetchErr && fetchErr.message?.includes("Could not find the table")) {
        const res2 = await supabase
          .from('booking')
          .select('*')
          .eq('host_id', profile.id)
          .order('created_at', { ascending: false });

        if (res2.data) {
          rawBookings = res2.data;
        }
      }

      // Hydrate missing artist profiles manually if FK relationship wasn't embedded
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

      // Update selectedBooking if open to keep UI in sync
      if (selectedBooking) {
        const updatedSelected = rawBookings.find((b) => b.id === selectedBooking.id);
        if (updatedSelected) setSelectedBooking(updatedSelected);
      }

      // 2. Fetch Host Verification Status
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

  const updateBookingStatus = async (id: string, status: string) => {
    let { error } = await supabase.from('bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error && error.message.includes("Could not find the table")) {
      await supabase.from('booking').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    }
    loadData();
  };

  // Helper function to send email notification and invoice to both host and artist
  const sendPaymentNotification = async (payload: {
    booking: BookingWithArtist;
    paymentType: 'deposit' | 'balance';
    amountPaid: number;
    remainingBalance: number;
  }) => {
    try {
      const { booking, paymentType, amountPaid, remainingBalance } = payload;

      const { data: hostProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', booking.host_id)
        .single();

      const { data: artistProfile } = await supabase
        .from('profiles')
        .select('email, full_name, stage_name')
        .eq('id', booking.artist_id)
        .single();

      await supabase.functions.invoke('send-invoice', {
        body: {
          paymentType,
          amountPaid,
          remainingBalance,
          booking: {
            id: booking.id,
            event_name: booking.event_name,
            event_date: booking.event_date,
            total_amount: booking.total_amount,
            verification_pin: booking.verification_pin,
            verification_token: booking.verification_token,
          },
          host: {
            full_name: hostProfile?.full_name || profile?.full_name || 'Host',
            email: hostProfile?.email || profile?.email || '',
          },
          artist: {
            full_name: artistProfile?.full_name || 'Talent Provider',
            email: artistProfile?.email || '',
            stage_name: artistProfile?.stage_name || booking.artist?.full_name,
          },
        },
      });
    } catch (err) {
      console.error('Notification dispatch error (payment recorded successfully):', err);
    }
  };

  // Pay Deposit (40%) in Rands
  const payDeposit = async (booking: BookingWithArtist, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPayingId(booking.id);
    try {
      let { error } = await supabase
        .from('bookings')
        .update({ deposit_paid: true, status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', booking.id);

      if (error && error.message.includes("Could not find the table")) {
        const retry = await supabase
          .from('booking')
          .update({ deposit_paid: true, status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('id', booking.id);
        error = retry.error;
      }

      if (error) {
        console.error('Error paying deposit:', error);
        alert(`Payment failed: ${error.message}`);
      } else {
        const depositAmount = booking.deposit_amount || (booking.total_amount ? booking.total_amount * 0.4 : 0);
        const remainingBalance = booking.total_amount != null ? booking.total_amount - depositAmount : 0;

        await sendPaymentNotification({
          booking,
          paymentType: 'deposit',
          amountPaid: depositAmount,
          remainingBalance,
        });
      }
    } catch (err) {
      console.error('Unexpected error paying deposit:', err);
    } finally {
      setPayingId(null);
      loadData();
    }
  };

  // Pay Remaining Balance (60%) in Rands
  const payRemainingBalance = async (booking: BookingWithArtist, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPayingId(booking.id);
    try {
      const remainingBalance = booking.total_amount != null && booking.deposit_amount != null 
        ? booking.total_amount - booking.deposit_amount 
        : 0;

      let { error } = await supabase
        .from('bookings')
        .update({ balance_paid: true, status: 'fully_paid', updated_at: new Date().toISOString() })
        .eq('id', booking.id);

      if (error && error.message.includes("Could not find the table")) {
        const retry = await supabase
          .from('booking')
          .update({ balance_paid: true, status: 'fully_paid', updated_at: new Date().toISOString() })
          .eq('id', booking.id);
        error = retry.error;
      }

      if (error) {
        console.error('Error paying balance:', error);
        alert(`Payment failed: ${error.message}`);
      } else {
        await sendPaymentNotification({
          booking,
          paymentType: 'balance',
          amountPaid: remainingBalance,
          remainingBalance: 0,
        });
      }
    } catch (err) {
      console.error('Unexpected error paying balance:', err);
    } finally {
      setPayingId(null);
      loadData();
    }
  };

  // Helper for dynamic payment status badge rendering
  const renderCustomStatusBadge = (booking: BookingWithArtist) => {
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

  // Helper component for Talent Verification Pass Drawer with On-Site Verification Badge
  const VerificationPassDrawer = ({ booking }: { booking: BookingWithArtist }) => {
    const isEligible = booking.status === 'confirmed' || booking.status === 'fully_paid' || booking.deposit_paid;
    if (!isEligible) return null;

    return (
      <div className="border border-emerald-200 bg-emerald-50/50 p-4 my-4 rounded space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-emerald-700" /> Talent Verification Pass
            </p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              Show this QR code or 4-digit PIN to the talent when they arrive on-site.
            </p>
          </div>

          {/* On-Site Verification Status Badge */}
          {booking.is_arrival_verified ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-semibold rounded whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
              <span>
                Talent Checked In{' '}
                {booking.arrival_verified_at 
                  ? `(${new Date(booking.arrival_verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` 
                  : ''}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-[11px] rounded whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>Awaiting Talent Check-in</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-white p-3 border border-emerald-200 rounded">
          {/* QR Pass */}
          <div className="flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-line pb-3 sm:pb-0 sm:pr-3">
            <p className="text-[10px] font-semibold text-ink-400 uppercase mb-1 flex items-center gap-1">
              <QrCode className="w-3 h-3" /> Option 1: QR Scan
            </p>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(JSON.stringify({ bookingId: booking.id, token: booking.verification_token }))}`} 
              alt="Arrival Verification QR Code" 
              className="w-28 h-28 object-contain"
            />
          </div>

          {/* 4-Digit PIN */}
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-semibold text-ink-400 uppercase mb-1 flex items-center gap-1">
              <KeyRound className="w-3 h-3" /> Option 2: Unique PIN
            </p>
            <div className="font-mono text-2xl font-bold text-emerald-900 bg-emerald-100 px-4 py-1.5 border border-emerald-300 rounded tracking-widest mt-1">
              {booking.verification_pin || '----'}
            </div>
          </div>
        </div>
      </div>
    );
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
            {filtered.map((booking) => {
              const remainingBalance = booking.total_amount != null && booking.deposit_amount != null 
                ? booking.total_amount - booking.deposit_amount 
                : null;

              return (
                <div 
                  key={booking.id} 
                  onClick={() => setSelectedBooking(booking)}
                  className="border border-line p-6 bg-white cursor-pointer animate-fade-in transition-all hover:border-ink/40 hover:shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                    {/* Talent info */}
                    <div className="flex items-center gap-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Link to={`/artists/${booking.artist_id}`} aria-label={`View ${booking.artist?.full_name || 'talent'} profile`}>
                        {booking.artist?.avatar_url ? (
                          <img src={booking.artist.avatar_url} alt={`Profile photo of ${booking.artist?.full_name || 'talent'}`} width={56} height={56} className="w-14 h-14 rounded-full object-cover border border-line" />
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
                          {renderCustomStatusBadge(booking)}
                        </div>
                      </div>

                      {/* Event details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
                        <div className="flex items-center gap-1.5 text-ink-500"><Calendar className="w-3.5 h-3.5 text-ink-300" /><span>{new Date(booking.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                        {booking.start_time && <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span>{booking.start_time}</span></div>}
                        <div className="flex items-center gap-1.5 text-ink-500"><Clock className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.gig_duration}</span></div>
                        <div className="flex items-center gap-1.5 text-ink-500"><MapPin className="w-3.5 h-3.5 text-ink-300" /><span className="truncate">{booking.location}</span></div>
                      </div>

                      {/* Talent Verification Pass Drawer */}
                      <VerificationPassDrawer booking={booking} />

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
                                {(booking.deposit_paid || booking.status === 'confirmed' || booking.balance_paid) && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Balance (60%)</p>
                              <div className="flex items-center gap-1.5">
                                <p className="font-display text-lg font-semibold text-ink-500">{formatCurrency(remainingBalance)}</p>
                                {(booking.balance_paid || booking.status === 'fully_paid') && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                              </div>
                            </div>
                          </div>

                          {/* ACTION 1: Pay Deposit in Rands */}
                          {!booking.deposit_paid && (booking.status === 'accepted' || booking.status === 'pending') && (
                            <button
                              onClick={(e) => payDeposit(booking, e)}
                              disabled={payingId === booking.id}
                              className="btn-accent w-full mt-4 flex items-center justify-center gap-2 py-2.5 text-xs uppercase tracking-wide-sm disabled:opacity-50"
                            >
                              {payingId === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                              Pay Deposit ({formatCurrency(booking.deposit_amount)}) Now
                            </button>
                          )}

                          {/* ACTION 2: Pay Remaining Balance in Rands */}
                          {booking.deposit_paid && !booking.balance_paid && remainingBalance != null && (
                            <button
                              onClick={(e) => payRemainingBalance(booking, e)}
                              disabled={payingId === booking.id}
                              className="btn-primary w-full mt-4 flex items-center justify-center gap-2 py-2.5 text-xs uppercase tracking-wide-sm bg-ink text-paper hover:bg-ink-700 disabled:opacity-50"
                            >
                              {payingId === booking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                              Pay Remaining Balance ({formatCurrency(remainingBalance)}) Now
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
                        <div className="pt-3 border-t border-line" onClick={(e) => e.stopPropagation()}>
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

        {/* BOOKING DETAILS MODAL */}
        {selectedBooking && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedBooking(null)}>
            <div 
              className="bg-paper border border-line p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="absolute top-5 right-5 text-ink-400 hover:text-ink transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">— Booking Details</p>
                  <h2 className="font-display text-2xl font-bold text-ink">{selectedBooking.event_name}</h2>
                </div>
                {renderCustomStatusBadge(selectedBooking)}
              </div>

              {/* Artist Details */}
              <div className="flex items-center gap-4 bg-paper-200 p-3 border border-line">
                {selectedBooking.artist?.avatar_url ? (
                  <img src={selectedBooking.artist.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-line" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-ink text-paper flex items-center justify-center font-display font-bold">
                    {selectedBooking.artist?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <h4 className="font-display font-semibold text-ink">{selectedBooking.artist?.full_name || 'Talent Provider'}</h4>
                  {selectedBooking.artist?.location && <p className="text-xs text-ink-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{selectedBooking.artist.location}</p>}
                </div>
              </div>

              {/* Event Metadata Breakdown */}
              <div className="space-y-3 text-xs sm:text-sm text-ink divide-y divide-line">
                <div className="pt-2 flex justify-between">
                  <span className="text-ink-400">Date:</span>
                  <span className="font-medium">{new Date(selectedBooking.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {selectedBooking.start_time && (
                  <div className="pt-2 flex justify-between">
                    <span className="text-ink-400">Start Time:</span>
                    <span className="font-medium">{selectedBooking.start_time}</span>
                  </div>
                )}
                <div className="pt-2 flex justify-between">
                  <span className="text-ink-400">Duration:</span>
                  <span className="font-medium">{selectedBooking.gig_duration}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-ink-400">Location:</span>
                  <span className="font-medium text-right max-w-[200px]">{selectedBooking.location}</span>
                </div>
              </div>

              {/* Talent Verification Pass in Modal */}
              <VerificationPassDrawer booking={selectedBooking} />

              {/* Equipment & Notes */}
              {selectedBooking.equipment_needed && selectedBooking.equipment_needed.length > 0 && (
                <div className="border-t border-line pt-3">
                  <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Equipment Needed</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedBooking.equipment_needed.map((eq) => <Tag key={eq} label={eq} />)}
                  </div>
                </div>
              )}

              {selectedBooking.notes && (
                <div className="border-t border-line pt-3">
                  <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Notes / Special Instructions</p>
                  <p className="text-xs text-ink-500">{selectedBooking.notes}</p>
                </div>
              )}

              {/* Financial Breakdown Box */}
              {selectedBooking.total_amount != null && (
                <div className="p-4 bg-paper-200 border border-line space-y-2 text-xs">
                  <div className="flex justify-between font-medium text-ink-400">
                    <span>Total Cost:</span>
                    <span className="text-ink font-bold font-display text-sm">{formatCurrency(selectedBooking.total_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-ink-400">
                    <span className="flex items-center gap-1">
                      Deposit (40%): 
                      {(selectedBooking.deposit_paid || selectedBooking.status === 'confirmed' || selectedBooking.balance_paid) && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </span>
                    <span className="text-accent font-bold font-display text-sm">{formatCurrency(selectedBooking.deposit_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-ink-400">
                    <span className="flex items-center gap-1">
                      Balance (60%): 
                      {(selectedBooking.balance_paid || selectedBooking.status === 'fully_paid') && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </span>
                    <span className="text-ink-500 font-bold font-display text-sm">
                      {formatCurrency(
                        selectedBooking.total_amount != null && selectedBooking.deposit_amount != null
                          ? selectedBooking.total_amount - selectedBooking.deposit_amount
                          : 0
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons Inside Modal */}
              <div className="flex flex-col gap-2 pt-2">
                {!selectedBooking.deposit_paid && (selectedBooking.status === 'accepted' || selectedBooking.status === 'pending') && (
                  <button
                    onClick={(e) => payDeposit(selectedBooking, e)}
                    disabled={payingId === selectedBooking.id}
                    className="btn-accent w-full flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-wide-sm disabled:opacity-50"
                  >
                    {payingId === selectedBooking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                    Pay Deposit ({formatCurrency(selectedBooking.deposit_amount)}) Now
                  </button>
                )}

                {selectedBooking.deposit_paid && !selectedBooking.balance_paid && (
                  <button
                    onClick={(e) => payRemainingBalance(selectedBooking, e)}
                    disabled={payingId === selectedBooking.id}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-wide-sm bg-ink text-paper hover:bg-ink-700 disabled:opacity-50"
                  >
                    {payingId === selectedBooking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                    Pay Remaining Balance ({formatCurrency(
                      selectedBooking.total_amount != null && selectedBooking.deposit_amount != null
                        ? selectedBooking.total_amount - selectedBooking.deposit_amount
                        : 0
                    )}) Now
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="w-full border border-line py-2.5 text-xs uppercase tracking-wide-sm font-semibold text-ink hover:bg-paper-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
