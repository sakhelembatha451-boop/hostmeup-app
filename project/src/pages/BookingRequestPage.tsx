import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Plus, X, AlertCircle, CheckCircle2, Music, Lock, CreditCard, ShieldCheck } from 'lucide-react';
import type { ArtistWithProfile } from '@/types';
import { getAdminId, createConversation, createNotification } from '@/lib/messaging';

const EQUIPMENT_OPTIONS = ['PA System', 'Microphones', 'DJ Controller', 'Speakers', 'Mixing Board', 'Stage Lighting', 'Instruments', 'Cables', 'Drum Kit', 'Keyboard'];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

export default function BookingRequestPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<ArtistWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [bookingCreated, setBookingCreated] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [customEquipment, setCustomEquipment] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('profiles').select(`*, artist_profile:artist_profiles(*)`).eq('id', id).maybeSingle();
      if (data) setArtist(data as ArtistWithProfile);
      setLoading(false);
    })();
  }, [id]);

  const ap = artist?.artist_profile;
  const rateUnit = ap?.rate_unit || 'hour';
  const baseRate = ap?.base_rate != null ? Number(ap.base_rate) : null;

  // Auto-calculate total and deposit
  const { totalAmount, depositAmount, remainingBalance } = useMemo(() => {
    if (!baseRate || baseRate <= 0) return { totalAmount: 0, depositAmount: 0, remainingBalance: 0 };
    let total = 0;
    if (rateUnit === 'hour') {
      const hours = parseFloat(durationHours) || 0;
      total = baseRate * hours;
    } else {
      // flat event or day rate — duration doesn't change the price
      total = baseRate;
    }
    const deposit = total * 0.4;
    const remaining = total * 0.6;
    return { totalAmount: total, depositAmount: deposit, remainingBalance: remaining };
  }, [baseRate, rateUnit, durationHours]);

  const canCalculate = baseRate != null && baseRate > 0 && (rateUnit !== 'hour' || (parseFloat(durationHours) || 0) > 0);

  const toggleEquipment = (item: string) => setEquipment(equipment.includes(item) ? equipment.filter((e) => e !== item) : [...equipment, item]);
  const addCustomEquipment = () => { if (customEquipment.trim()) { setEquipment([...equipment, customEquipment.trim()]); setCustomEquipment(''); } };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id || !profile) return;
    if (!eventName || !eventDate || !location) { setError('Please fill in all required fields'); return; }
    if (rateUnit === 'hour' && (!durationHours || parseFloat(durationHours) <= 0)) { setError('Please enter the duration in hours'); return; }
    if (!canCalculate) { setError('This talent has not set a booking rate yet. Please contact them directly.'); return; }

    setSubmitting(true); setError('');
    const { data, error: insertErr } = await supabase.from('bookings').insert({
      artist_id: id, host_id: profile.id, event_name: eventName, event_date: eventDate,
      start_time: startTime || null, gig_duration: rateUnit === 'hour' ? `${durationHours} hours` : 'Flat fee',
      equipment_needed: equipment, location, notes, status: 'pending',
      total_amount: totalAmount, deposit_amount: depositAmount, deposit_paid: false,
    }).select('id').single();

    setSubmitting(false);
    if (insertErr) { setError(insertErr.message); return; }
    if (data) {
      setCreatedBookingId(data.id);
      
      // Notify Admin and Talent
      try {
        const adminId = await getAdminId();
        const artistName = ap?.stage_name || artist?.full_name || 'Talent';
        const hostName = profile.full_name || 'A host';
        const initialMsg = `New booking request for ${artistName} — ${eventName} on ${new Date(eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${location}. Duration: ${rateUnit === 'hour' ? `${durationHours} hours` : 'Flat fee'}. Total: ${formatCurrency(totalAmount)} | Deposit (40%): ${formatCurrency(depositAmount)}.`;
        
        // 1. Create message thread
        await createConversation(profile.id, `Booking: ${eventName}`, 'booking', data.id, initialMsg, adminId);
        
        // 2. Send instant bell notification to the Talent/Artist
        await createNotification(
          id, // Artist profile ID
          'booking',
          'New Booking Request! 📅',
          `${hostName} sent a booking request for "${eventName}" on ${eventDate}.`,
          '/artist-dashboard',
          undefined,
          data.id
        );
      } catch (err) {
        console.warn('Non-fatal notification dispatch error:', err);
      }

      setShowCheckout(true);
    }
  };

  const handlePayDeposit = async () => {
    if (!createdBookingId || !id) return;
    setPaying(true);
    // Mark deposit as paid and update status to 'confirmed'
    const { error: payErr } = await supabase.from('bookings')
      .update({ deposit_paid: true, status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', createdBookingId);
    setPaying(false);
    if (payErr) { setError(payErr.message); return; }

    // Notify artist that deposit was paid and booking is locked in
    try {
      await createNotification(
        id,
        'booking',
        'Booking Deposit Paid! 🎉',
        `Deposit of ${formatCurrency(depositAmount)} for "${eventName}" has been paid. Your booking is confirmed!`,
        '/artist-dashboard',
        undefined,
        createdBookingId
      );
    } catch (notifErr) {
      console.warn('Could not dispatch deposit notification:', notifErr);
    }

    // Show success and redirect
    setShowCheckout(false);
    setBookingCreated(true);
    setTimeout(() => navigate('/host-dashboard'), 2000);
  };

  const handleSkipPayment = () => {
    setShowCheckout(false);
    setBookingCreated(true);
    setTimeout(() => navigate('/host-dashboard'), 1500);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;
  if (!artist) return <div className="min-h-screen flex flex-col items-center justify-center text-center px-4"><h2 className="font-display text-2xl text-ink mb-2">Talent not found</h2><Link to="/artists" aria-label="Back to talent directory" className="text-sm font-medium text-accent hover:text-accent-600">Back to directory</Link></div>;

  if (bookingCreated) return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="text-center animate-scale-in">
        <div className="w-16 h-16 border border-accent-200 bg-accent-50 flex items-center justify-center text-accent mx-auto mb-6"><CheckCircle2 className="w-8 h-8" /></div>
        <h2 className="font-display text-3xl font-bold text-ink mb-2">Booking Request Sent.</h2>
        <p className="text-ink-400">Redirecting to your dashboard...</p>
      </div>
    </div>
  );

  const noRateSet = !baseRate || baseRate <= 0;

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-6 lg:px-12 py-12">
        <Link to={`/artists/${id}`} aria-label="Back to talent profile" className="inline-flex items-center gap-2 text-xs font-medium text-ink-400 hover:text-ink uppercase tracking-wide-sm mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Profile
        </Link>

        {/* Talent summary */}
        <div className="flex items-center gap-5 border border-line p-5 mb-8">
          {artist.avatar_url ? (
            <img src={artist.avatar_url} alt={`Profile photo of ${artist?.full_name || 'talent'}`} width={64} height={64} className="w-16 h-16 rounded-full object-cover border border-line" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-ink text-paper flex items-center justify-center font-display text-xl font-bold">{artist.full_name?.[0]?.toUpperCase() || '?'}</div>
          )}
          <div>
            <h2 className="font-display text-xl font-bold text-ink">{ap?.stage_name || artist.full_name}</h2>
            {ap?.performance_roles && ap.performance_roles.length > 0 && <p className="text-sm text-ink-400">{ap.performance_roles.join(', ')}</p>}
            {baseRate != null && baseRate > 0 && <p className="text-sm font-semibold text-accent mt-1">{formatCurrency(baseRate)}/{rateUnit === 'hour' ? 'hr' : rateUnit}</p>}
          </div>
        </div>

        <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Booking Request</p>
        <h1 className="font-display text-3xl font-bold text-ink mb-2">Request this talent.</h1>
        <p className="text-ink-400 mb-10">Fill in your event details below. A 40% deposit is required to confirm your booking.</p>

        {noRateSet && (
          <div className="flex items-start gap-2 p-4 mb-6 border border-amber-200 bg-amber-50 text-amber-800 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>This talent has not set a booking rate yet. You can still send a request, but pricing won't be calculated automatically.</span>
          </div>
        )}

        {error && <div className="flex items-start gap-2 p-3 mb-6 border border-red-200 bg-red-50 text-red-700 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span></div>}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Event details */}
          <div className="border border-line p-6 lg:p-8">
            <h3 className="font-display text-lg font-semibold text-ink mb-6 flex items-center gap-2"><Calendar className="w-4 h-4 text-accent" /> Event Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Event Name *</label>
                <input type="text" required value={eventName} onChange={(e) => setEventName(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="Summer Music Festival 2026" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Event Date *</label>
                <input type="date" required value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" />
              </div>
              {rateUnit === 'hour' ? (
                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Duration (hours) *</label>
                  <input type="number" min="0.5" step="0.5" required value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="e.g. 3" />
                  <p className="text-xs text-ink-300 mt-1">Enter the number of hours for this booking.</p>
                </div>
              ) : (
                <div className="sm:col-span-1">
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Booking Type</label>
                  <div className="input-editorial w-full px-4 py-2.5 text-sm text-ink-500">Flat {rateUnit} rate</div>
                </div>
              )}
              <div>
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> Location *</label>
                <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="Venue address" />
              </div>
            </div>
          </div>

          {/* Pricing summary */}
          {canCalculate && (
            <div className="border border-line p-6 lg:p-8 bg-paper-200">
              <h3 className="font-display text-lg font-semibold text-ink mb-6 flex items-center gap-2"><CreditCard className="w-4 h-4 text-accent" /> Pricing Summary</h3>
              <div className="space-y-4">
                <div className="flex items-baseline justify-between pb-4 border-b border-line">
                  <div>
                    <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Total Booking Cost</p>
                    <p className="text-sm text-ink-500">
                      {rateUnit === 'hour'
                        ? `${formatCurrency(baseRate!)} x ${durationHours || 0} hours`
                        : `Flat ${rateUnit} rate`}
                    </p>
                  </div>
                  <span className="font-display text-3xl font-bold text-ink">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide-sm text-accent mb-1">Required Upfront Deposit (40%)</p>
                    <p className="text-sm text-ink-400">Due now to confirm booking</p>
                  </div>
                  <span className="font-display text-2xl font-semibold text-accent">{formatCurrency(depositAmount)}</span>
                </div>
                <div className="flex items-baseline justify-between pt-4 border-t border-line">
                  <div>
                    <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Remaining Balance (60%)</p>
                    <p className="text-sm text-ink-400">Due after the event</p>
                  </div>
                  <span className="font-display text-2xl font-semibold text-ink-600">{formatCurrency(remainingBalance)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Equipment */}
          <div className="border border-line p-6 lg:p-8">
            <h3 className="font-display text-lg font-semibold text-ink mb-6">Equipment Needed</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {EQUIPMENT_OPTIONS.map((item) => <button key={item} type="button" onClick={() => toggleEquipment(item)} className={`filter-chip ${equipment.includes(item) ? 'filter-chip-active' : 'filter-chip-inactive'}`}>{item}</button>)}
            </div>
            <div className="flex gap-2">
              <input type="text" value={customEquipment} onChange={(e) => setCustomEquipment(e.target.value)} className="input-editorial flex-1 px-4 py-2.5 text-sm" placeholder="Add custom equipment..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomEquipment(); } }} />
              <button type="button" onClick={addCustomEquipment} className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-paper bg-ink hover:bg-ink-700 transition-colors rounded-none whitespace-nowrap"><Plus className="w-4 h-4" /> Add</button>
            </div>
            {equipment.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {equipment.map((item) => <span key={item} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-accent-50 text-accent border border-accent-200 rounded-none">{item}<button type="button" onClick={() => toggleEquipment(item)} className="hover:text-accent-700"><X className="w-3 h-3" /></button></span>)}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="border border-line p-6 lg:p-8">
            <h3 className="font-display text-lg font-semibold text-ink mb-6 flex items-center gap-2"><Music className="w-4 h-4 text-accent" /> Additional Notes</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="Special requests, set preferences, or other details..." />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-xs uppercase tracking-wide-sm disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />} Continue to Checkout
            </button>
            <button type="button" onClick={() => navigate(`/artists/${id}`)} className="btn-outline px-8 py-3.5 text-xs uppercase tracking-wide-sm">Cancel</button>
          </div>
        </form>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowCheckout(false)}>
          <div className="bg-paper border border-line max-w-md w-full p-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 border border-accent-200 bg-accent-50 flex items-center justify-center text-accent"><Lock className="w-5 h-5" /></div>
              <div>
                <h3 className="font-display text-xl font-bold text-ink">Secure Deposit Checkout</h3>
                <p className="text-xs text-ink-400">Pay 40% now to lock in your booking</p>
              </div>
            </div>

            {/* Booking summary */}
            <div className="border border-line p-4 mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">Talent</span>
                <span className="font-medium text-ink">{ap?.stage_name || artist.full_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">Event</span>
                <span className="font-medium text-ink">{eventName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">Date</span>
                <span className="font-medium text-ink">{new Date(eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="h-px bg-line my-2" />
              <div className="flex justify-between text-sm">
                <span className="text-ink-500">Total Booking Cost</span>
                <span className="font-medium text-ink">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-accent font-medium">Upfront Deposit (40%)</span>
                <span className="font-display text-xl font-bold text-accent">{formatCurrency(depositAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">Remaining Balance (60%)</span>
                <span className="font-medium text-ink-500">{formatCurrency(remainingBalance)}</span>
              </div>
            </div>

            {/* Payment form placeholder */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Card Number</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                  <input type="text" placeholder="4242 4242 4242 4242" className="input-editorial w-full pl-10 pr-4 py-3 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">Expiry</label>
                  <input type="text" placeholder="MM / YY" className="input-editorial w-full px-4 py-3 text-sm" />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2">CVC</label>
                  <input type="text" placeholder="123" className="input-editorial w-full px-4 py-3 text-sm" />
                </div>
              </div>
            </div>

            {error && <div className="flex items-start gap-2 p-3 mb-4 border border-red-200 bg-red-50 text-red-700 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span></div>}

            {/* Actions */}
            <button onClick={handlePayDeposit} disabled={paying} className="btn-accent w-full flex items-center justify-center gap-2 py-4 text-xs uppercase tracking-wide-sm disabled:opacity-50 mb-3">
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Pay {formatCurrency(depositAmount)} Deposit & Confirm
            </button>
            <button onClick={handleSkipPayment} className="btn-ghost w-full text-center text-xs uppercase tracking-wide-sm py-2">
              Skip for now — pay later
            </button>
            <p className="text-xs text-ink-300 text-center mt-4 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure payment processing
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
