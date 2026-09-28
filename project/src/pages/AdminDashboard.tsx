import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, MapPin, Clock, Loader2, CheckCircle2, AlertCircle, 
  X, Eye, Package, ShieldAlert, Check, AlertTriangle, PhoneCall 
} from 'lucide-react';
import type { Booking } from '@/types';
import { StatusBadge, Tag } from '@/components/UI';

type AdminBookingView = Booking & {
  deposit_paid?: boolean;
  balance_paid?: boolean;
  equipment_needed?: string[];
  notes?: string;
  host?: {
    id?: string;
    full_name: string;
    email?: string;
    avatar_url?: string;
  };
  artist?: {
    id?: string;
    stage_name?: string;
    full_name: string;
    email?: string;
    avatar_url?: string;
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
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modals State
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingView | null>(null);
  const [reportBooking, setReportBooking] = useState<AdminBookingView | null>(null);

  // Dispute / Override Form State
  const [issueCategory, setIssueCategory] = useState<string>('safety');
  const [issueDescription, setIssueDescription] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState<boolean>(false);
  const [submittingReport, setSubmittingReport] = useState<boolean>(false);

  const loadAllBookings = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setLoading(true);
    let rawBookings: any[] = [];
    let fetchError: any = null;

    try {
      // 1. Query 'bookings' table
      const res1 = await supabase
        .from('bookings')
        .select(`
          *,
          host:profiles!bookings_host_id_fkey(id, full_name, email, avatar_url),
          artist:profiles!bookings_artist_id_fkey(id, full_name, email, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (res1.error) {
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

      // 2. Fallback to 'booking' table
      if (rawBookings.length === 0 || fetchError) {
        const res2 = await supabase
          .from('booking')
          .select('*')
          .order('created_at', { ascending: false });

        if (!res2.error && res2.data) {
          rawBookings = res2.data;
        }
      }

      // 3. Hydrate profile details manually if FK relations were empty
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
            .select('id, full_name, email, avatar_url')
            .in('id', userIds);

          const profileMap = new Map((userProfiles || []).map((p) => [p.id, p]));

          rawBookings = rawBookings.map((b) => ({
            ...b,
            host: b.host || profileMap.get(b.host_id) || null,
            artist: b.artist || profileMap.get(b.artist_id) || null,
          }));
        }
      }

      const formatted = rawBookings as AdminBookingView[];
      setBookings(formatted);

      setSelectedBooking((prev) => {
        if (!prev) return null;
        return formatted.find((b) => b.id === prev.id) || prev;
      });
    } catch (err) {
      console.error('Error fetching admin bookings:', err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllBookings(true);
  }, [loadAllBookings]);

  // Status Badge Renderer
  const renderCustomStatusBadge = (booking: AdminBookingView) => {
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

  // Status Override Handler
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

      await loadAllBookings(false);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Could not update booking status.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Submit Dispute Note
  const handleSubmitDispute = async () => {
    if (!reportBooking || !issueDescription.trim()) {
      alert('Please explain the issue or dispute action.');
      return;
    }

    setSubmittingReport(true);
    try {
      await supabase
        .from('booking_issues')
        .insert({
          booking_id: reportBooking.id,
          category: issueCategory,
          description: `[ADMIN ACTION]: ${issueDescription}`,
          is_urgent: isUrgent,
          status: 'investigating',
          created_at: new Date().toISOString()
        });

      alert('Admin dispute note saved.');
      setReportBooking(null);
      setIssueDescription('');
    } catch (err) {
      console.error('Error logging dispute:', err);
      setReportBooking(null);
    } finally {
      setSubmittingReport(false);
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);

  // Metrics
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
        
        {/* Header */}
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
          {['all', 'pending', 'confirmed', 'accepted', 'completed', 'declined'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-chip capitalize ${filter === f ? 'filter-chip-active' : 'filter-chip-inactive'}`}
            >
              {f} ({f === 'all' ? bookings.length : bookings.filter((b) => b.status === f).length})
            </button>
          ))}
        </div>

        {/* Bookings List */}
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
                <div 
                  key={booking.id} 
                  onClick={() => setSelectedBooking(booking)}
                  className="border border-line p-6 bg-paper cursor-pointer hover:border-ink/40 transition-all shadow-sm"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    
                    {/* Event & User Details */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-xl font-bold text-ink">{booking.event_name}</h3>
                        {renderCustomStatusBadge(booking)}
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-500">
                        <p><strong>Host:</strong> {booking.host?.full_name || 'N/A'}</p>
                        <p><strong>Talent:</strong> {booking.artist?.stage_name || booking.artist?.full_name || 'N/A'}</p>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-ink-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-ink-300" />
                          {new Date(booking.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {booking.start_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-ink-300" />
                            {booking.start_time}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-ink-300" />
                          {booking.location}
                        </span>
                      </div>
                    </div>

                    {/* Financial Breakdown Card */}
                    <div className="border border-line bg-paper-200 p-4 min-w-[300px]" onClick={(e) => e.stopPropagation()}>
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

                      {/* Admin Quick Actions */}
                      <div className="mt-3 pt-2 border-t border-line flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="text-[11px] font-semibold text-ink uppercase tracking-wide-sm hover:underline flex items-center gap-1">
                          <Eye className="w-3 h-3 text-ink-400" /> Details
                        </button>
                        <button
                          onClick={() => setReportBooking(booking)}
                          className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-200 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Flag
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal 1: Booking Details */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedBooking(null)}>
            <div className="bg-paper border border-line p-6 max-w-xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedBooking(null)} className="absolute top-4 right-4 text-ink-400 hover:text-ink">
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                {renderCustomStatusBadge(selectedBooking)}
                <span className="text-xs text-ink-400 font-mono">ID: {selectedBooking.id}</span>
              </div>

              <h2 className="font-display text-2xl font-bold text-ink mb-1">{selectedBooking.event_name}</h2>
              <p className="text-xs text-ink-400 mb-6">Admin Booking Record</p>

              {/* Host & Talent Details */}
              <div className="grid grid-cols-2 gap-4 p-4 border border-line bg-paper-200/50 mb-6 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-ink-400 block mb-1">Host</span>
                  <p className="font-semibold text-ink">{selectedBooking.host?.full_name || 'N/A'}</p>
                  <p className="text-ink-400">{selectedBooking.host?.email || 'No email registered'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-ink-400 block mb-1">Talent</span>
                  <p className="font-semibold text-ink">{selectedBooking.artist?.stage_name || selectedBooking.artist?.full_name || 'N/A'}</p>
                  <p className="text-ink-400">{selectedBooking.artist?.email || 'No email registered'}</p>
                </div>
              </div>

              {/* Event Metadata */}
              <div className="space-y-4 text-sm mb-6">
                <div className="grid grid-cols-2 gap-4 border-b border-line pb-3">
                  <div>
                    <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-1">Date & Time</span>
                    <p className="font-medium text-ink flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-ink-300" />
                      {new Date(selectedBooking.event_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {selectedBooking.start_time ? ` @ ${selectedBooking.start_time}` : ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-1">Duration</span>
                    <p className="font-medium text-ink flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-ink-300" />
                      {selectedBooking.gig_duration || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="border-b border-line pb-3">
                  <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-1">Venue Location</span>
                  <p className="font-medium text-ink flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-ink-300" />
                    {selectedBooking.location}
                  </p>
                </div>

                {selectedBooking.equipment_needed && selectedBooking.equipment_needed.length > 0 && (
                  <div className="border-b border-line pb-3">
                    <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-2">Required Equipment</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBooking.equipment_needed.map((eq) => <Tag key={eq} label={eq} />)}
                    </div>
                  </div>
                )}

                {selectedBooking.notes && (
                  <div>
                    <span className="text-xs uppercase tracking-wide-sm text-ink-400 block mb-1">Event Notes</span>
                    <p className="text-sm text-ink-500 bg-paper-200 p-3 border border-line rounded">{selectedBooking.notes}</p>
                  </div>
                )}

                {/* Financial Summary */}
                {selectedBooking.total_amount != null && (
                  <div className="p-4 bg-paper-200 border border-line space-y-2 text-xs">
                    <div className="flex justify-between font-medium text-ink-400">
                      <span>Total Agreed Value:</span>
                      <span className="text-ink font-bold font-display text-sm">{formatCurrency(selectedBooking.total_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-ink-400">
                      <span className="flex items-center gap-1">
                        40% Deposit: 
                        {(selectedBooking.deposit_paid || selectedBooking.status === 'confirmed') && (
                          <Check className="w-3.5 h-3.5 text-accent" />
                        )}
                      </span>
                      <span className="text-accent font-bold font-display text-sm">{formatCurrency(selectedBooking.deposit_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-ink-400">
                      <span className="flex items-center gap-1">
                        60% Balance: 
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
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
                <button
                  onClick={() => {
                    const b = selectedBooking;
                    setSelectedBooking(null);
                    setReportBooking(b);
                  }}
                  className="text-xs text-amber-700 hover:underline flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Flag Dispute Note
                </button>
                <div className="flex items-center gap-2">
                  {selectedBooking.status !== 'cancelled' && (
                    <button
                      onClick={() => {
                        updateBookingStatus(selectedBooking.id, 'cancelled');
                        setSelectedBooking(null);
                      }}
                      className="px-3 py-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 rounded">
                      Force Cancel
                    </button>
                  )}
                  <button onClick={() => setSelectedBooking(null)} className="btn-primary px-5 py-2 text-xs uppercase tracking-wide-sm">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal 2: Admin Dispute / Flag Note */}
        {reportBooking && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-paper border border-line p-6 max-w-lg w-full shadow-2xl relative">
              <button onClick={() => setReportBooking(null)} className="absolute top-4 right-4 text-ink-400 hover:text-ink">
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-amber-700 font-bold mb-1">
                <ShieldAlert className="w-5 h-5" /> Flag Dispute or System Note
              </div>
              <p className="text-xs text-ink-400 mb-4">Event: {reportBooking.event_name}</p>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-ink mb-1">Category</label>
                  <select 
                    value={issueCategory} 
                    onChange={(e) => setIssueCategory(e.target.value)}
                    className="w-full border border-line p-2 bg-paper text-ink rounded">
                    <option value="safety">Safety / Terms Breach</option>
                    <option value="no_show">No-Show Investigation</option>
                    <option value="payment">Deposit / Escrow Dispute</option>
                    <option value="other">General Flag</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Administrative Note</label>
                  <textarea 
                    rows={4}
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="Enter dispute summary or investigation details..."
                    className="w-full border border-line p-2 bg-paper text-ink rounded"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="urgent_admin_flag" 
                    checked={isUrgent} 
                    onChange={(e) => setIsUrgent(e.target.checked)} 
                    className="rounded text-ink focus:ring-0"
                  />
                  <label htmlFor="urgent_admin_flag" className="font-semibold text-ink">Mark as Priority Dispute</label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-line">
                <button 
                  onClick={() => setReportBooking(null)} 
                  className="btn-outline px-4 py-2 text-xs uppercase tracking-wide-sm">
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitDispute}
                  disabled={submittingReport}
                  className="bg-amber-700 hover:bg-amber-800 text-white px-5 py-2 text-xs uppercase font-semibold rounded tracking-wide-sm flex items-center gap-1.5">
                  {submittingReport && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Note
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
