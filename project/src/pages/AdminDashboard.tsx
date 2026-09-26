import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, MapPin, Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge } from '@/components/UI';

type AdminBookingView = Booking & {
  host?: {
    full_name: string;
    email?: string;
  };
  artist?: {
    stage_name?: string;
    full_name: string;
  };
};

function formatCurrency(n: number | null) {
  if (n == null) return 'R0';
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<AdminBookingView[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const loadAllBookings = useCallback(async () => {
    setLoading(true);
    let rawBookings: any[] = [];
    let fetchError: any = null;

    try {
      // 1. Primary Attempt: Query 'bookings' with explicit FK relationships
      const res1 = await supabase
        .from('bookings')
        .select(`
          *,
          host:profiles!bookings_host_id_fkey(full_name, email),
          artist:profiles!bookings_artist_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (res1.error) {
        // Retry 'bookings' table without FK aliases if relationship cache fails
        const res1Retry = await supabase
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });

        if (!res1Retry.error && res1Retry.data) {
          rawBookings = res1Retry.data;
        } else {
          fetchError = res1Retry.error || res1.error;
        }
      } else if (res1.data) {
        rawBookings = res1.data;
      }

      // 2. Secondary Attempt: Fallback to 'booking' table if 'bookings' fails or is empty
      if (rawBookings.length === 0 || fetchError) {
        const res2 = await supabase
          .from('booking')
          .select('*')
          .order('created_at', { ascending: false });

        if (!res2.error && res2.data) {
          rawBookings = res2.data;
        }
      }

      // 3. Hydrate missing profile details manually if FK relations weren't returned
      if (rawBookings.length > 0) {
        const userIds = Array.from(
          new Set(
            rawBookings
              .flatMap((b) => [b.host_id, b.artist_id])
              .filter(Boolean)
          )
        );

        if (userIds.length > 0) {
          const { data: userProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);

          const profileMap = new Map((userProfiles || []).map((p) => [p.id, p]));

          rawBookings = rawBookings.map((b) => ({
            ...b,
            host: b.host || profileMap.get(b.host_id) || null,
            artist: b.artist || profileMap.get(b.artist_id) || null,
          }));
        }
      }

      setBookings(rawBookings as AdminBookingView[]);
    } catch (err) {
      console.error('Error fetching admin bookings:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllBookings();
  }, [loadAllBookings]);

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  // Platform Metrics
  const totalVolume = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const totalDepositsCollected = bookings
    .filter((b) => b.deposit_paid)
    .reduce((sum, b) => sum + (b.deposit_amount || 0), 0);
  const totalOutstandingBalance = bookings
    .filter((b) => b.status === 'confirmed' || b.status === 'accepted')
    .reduce((sum, b) => {
      const remaining = (b.total_amount || 0) - (b.deposit_paid ? (b.deposit_amount || 0) : 0);
      return sum + Math.max(0, remaining);
    }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <Loader2 className="w-6 h-6 text-ink animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-2">— Admin Control Center</p>
          <h1 className="font-display text-4xl font-bold text-ink mb-1">Global Bookings Overview</h1>
          <p className="text-ink-400">Track all host booking requests, deposits paid, and remaining balances.</p>
        </div>

        {/* Global Financial Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 border-y border-line py-6">
          <div>
            <div className="font-display text-3xl font-bold text-ink mb-1">{formatCurrency(totalVolume)}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400">Total Booking Value</div>
          </div>
          <div>
            <div className="font-display text-3xl font-bold text-accent mb-1">{formatCurrency(totalDepositsCollected)}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400">Deposits Paid (40%)</div>
          </div>
          <div>
            <div className="font-display text-3xl font-bold text-ink-500 mb-1">{formatCurrency(totalOutstandingBalance)}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400">Remaining Balance Due</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {['all', 'pending', 'confirmed', 'accepted', 'declined'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-chip capitalize ${filter === f ? 'filter-chip-active' : 'filter-chip-inactive'}`}
            >
              {f} ({f === 'all' ? bookings.length : bookings.filter((b) => b.status === f).length})
            </button>
          ))}
        </div>

        {/* Bookings Table/List */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center border border-line bg-paper">
            <p className="text-ink-400">No booking requests found for this filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((booking) => {
              const total = booking.total_amount || 0;
              const deposit = booking.deposit_amount || 0;
              const remaining = booking.deposit_paid ? total - deposit : total;

              return (
                <div key={booking.id} className="border border-line p-6 bg-paper hover:border-ink/20 transition-all">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    {/* Event & User Details */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-xl font-bold text-ink">{booking.event_name}</h3>
                        <StatusBadge status={booking.status} />
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-500">
                        <p><strong>Host:</strong> {booking.host?.full_name || 'N/A'}</p>
                        <p><strong>Talent:</strong> {booking.artist?.full_name || 'N/A'}</p>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-ink-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(booking.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {booking.start_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {booking.start_time}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {booking.location}
                        </span>
                      </div>
                    </div>

                    {/* Financial Breakdown Card */}
                    <div className="border border-line bg-paper-200 p-4 min-w-[300px]">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide-sm text-ink-400">Total</p>
                          <p className="font-display font-semibold text-ink text-sm">{formatCurrency(total)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide-sm text-accent">Deposit (40%)</p>
                          <p className="font-display font-semibold text-accent text-sm">{formatCurrency(deposit)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide-sm text-ink-400">Left Due</p>
                          <p className="font-display font-semibold text-ink-500 text-sm">{formatCurrency(remaining)}</p>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-line flex items-center justify-between text-xs">
                        <span className="text-ink-400 font-medium">Payment Status:</span>
                        {booking.deposit_paid ? (
                          <span className="text-accent flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Deposit Paid
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1 font-semibold">
                            <AlertCircle className="w-3.5 h-3.5" /> Deposit Unpaid
                          </span>
                        )}
                      </div>
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
