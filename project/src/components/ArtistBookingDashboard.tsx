import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Check, 
  X, 
  Loader2, 
  AlertCircle,
  User,
  CheckCircle2,
  XCircle,
  Clock3
} from 'lucide-react';

export interface Booking {
  id: string;
  client_id: string;
  artist_id: string;
  service_id?: string;
  event_date: string;
  start_time: string;
  duration_hours: number;
  total_price: number;
  location: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  created_at: string;
  client_profile?: {
    full_name?: string;
    email?: string;
    avatar_url?: string;
  };
}

export default function ArtistBookingDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all');

  useEffect(() => {
    fetchArtistBookings();
  }, []);

  const fetchArtistBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated.');

      // Fetch bookings where the current user is the artist
      const { data, error: fetchErr } = await supabase
        .from('bookings')
        .select(`
          *,
          client_profile:profiles!client_id(full_name, email, avatar_url)
        `)
        .eq('artist_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      setBookings(data || []);
    } catch (err: any) {
      console.error('Error fetching artist bookings:', err.message);
      setError(err.message || 'Failed to load booking requests.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: 'accepted' | 'declined') => {
    try {
      setUpdatingId(bookingId);

      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (updateErr) throw updateErr;

      // Optimistically update state locally
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
    } catch (err: any) {
      console.error('Error updating status:', err.message);
      alert(`Could not update booking: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    if (filter === 'all') return true;
    return booking.status === filter;
  });

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-green-700 bg-green-100 border border-green-200 px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3" /> Accepted
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-red-700 bg-red-100 border border-red-200 px-2 py-0.5">
            <XCircle className="w-3 h-3" /> Declined
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5">
            <Clock3 className="w-3 h-3" /> Pending Review
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="border border-line bg-paper p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
      </div>
    );
  }

  return (
    <div className="border border-line bg-paper p-6 space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Booking Requests</h2>
          <p className="text-xs text-ink-500 mt-0.5">Manage and respond to gig inquiries from clients.</p>
        </div>

        <div className="flex items-center gap-1 bg-paper-100 border border-line p-1">
          {(['all', 'pending', 'accepted', 'declined'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`px-3 py-1 text-[10px] uppercase font-semibold tracking-wide transition-colors ${
                filter === status
                  ? 'bg-ink text-paper'
                  : 'text-ink-600 hover:text-ink hover:bg-paper-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-line bg-paper-100">
          <Calendar className="w-8 h-8 text-ink-300 mx-auto mb-2" />
          <p className="text-xs text-ink-500 font-medium">No booking requests found in this view.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className="border border-line bg-paper-100 p-4 transition-all hover:border-ink/50 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-paper-200 border border-line flex items-center justify-center text-ink shrink-0 font-bold text-sm">
                    {booking.client_profile?.avatar_url ? (
                      <img
                        src={booking.client_profile.avatar_url}
                        alt="Client"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-ink-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ink">
                      {booking.client_profile?.full_name || 'Client Request'}
                    </h4>
                    <p className="text-[11px] text-ink-500">
                      Requested on {new Date(booking.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div>{getStatusBadge(booking.status)}</div>
              </div>

              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-paper p-3 border border-line text-xs">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-ink-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Date
                  </p>
                  <p className="font-semibold text-ink mt-0.5">{booking.event_date}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-semibold text-ink-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Time & Duration
                  </p>
                  <p className="font-semibold text-ink mt-0.5">
                    {booking.start_time} ({booking.duration_hours} hr{booking.duration_hours > 1 ? 's' : ''})
                  </p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-semibold text-ink-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Venue
                  </p>
                  <p className="font-semibold text-ink mt-0.5 truncate">{booking.location}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-semibold text-ink-400">Total Payout</p>
                  <p className="font-bold text-ink mt-0.5">R{Number(booking.total_price).toFixed(2)}</p>
                </div>
              </div>

              {booking.notes && (
                <p className="text-xs text-ink-600 bg-paper-200/50 p-2.5 border border-line italic">
                  "{booking.notes}"
                </p>
              )}

              {/* Action Buttons for Pending Requests */}
              {booking.status === 'pending' && (
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={updatingId === booking.id}
                    onClick={() => handleUpdateStatus(booking.id, 'declined')}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold uppercase tracking-wide disabled:opacity-50 transition-colors"
                  >
                    {updatingId === booking.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    Decline
                  </button>

                  <button
                    type="button"
                    disabled={updatingId === booking.id}
                    onClick={() => handleUpdateStatus(booking.id, 'accepted')}
                    className="flex items-center gap-1.5 px-5 py-2 bg-ink text-paper hover:bg-ink-800 text-xs font-semibold uppercase tracking-wide disabled:opacity-50 transition-colors"
                  >
                    {updatingId === booking.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Accept Booking
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
