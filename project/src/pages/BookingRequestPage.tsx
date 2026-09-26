import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Plus, X, AlertCircle, CheckCircle2, Music, Lock, CreditCard, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { ArtistWithProfile } from '@/types';
import { getAdminId, createConversation, createNotification } from '@/lib/messaging';

declare global {
  interface Window {
    YocoSDK?: any;
  }
}

const EQUIPMENT_OPTIONS = ['PA System', 'Microphones', 'DJ Controller', 'Speakers', 'Mixing Board', 'Stage Lighting', 'Instruments', 'Cables', 'Drum Kit', 'Keyboard'];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
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

  // Host Verification States
  const [hostVerification, setHostVerification] = useState<{
    is_identity_verified: boolean;
    verification_status: 'pending' | 'approved' | 'rejected' | null;
  } | null>(null);

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

    let isMounted = true;

    async function loadTalentData() {
      setLoading(true);
      setError('');

      try {
        let targetUserId: string | null = null;
        let artistProfileData: any = null;

        // ----------------------------------------------------
        // TRY 1: Check if `id` is a User ID (profiles.id)
        // ----------------------------------------------------
        const { data: apByUser } = await supabase
          .from('artist_profiles')
          .select('*')
          .eq('user_id', id)
          .maybeSingle();

        if (apByUser) {
          targetUserId = id;
          artistProfileData = apByUser;
        }

        // ----------------------------------------------------
        // TRY 2: Check if `id` is an `artist_profiles.id`
        // ----------------------------------------------------
        if (!artistProfileData) {
          const { data: apById } = await supabase
            .from('artist_profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (apById) {
            targetUserId = apById.user_id;
            artistProfileData = apById;
          }
        }

        // ----------------------------------------------------
        // TRY 3: Check if `id` is a `bookings.id`
        // ----------------------------------------------------
        if (!artistProfileData) {
          const { data: bookingRow } = await supabase
            .from('bookings')
            .select('artist_id')
            .eq('id', id)
            .maybeSingle();

          if (bookingRow?.artist_id) {
            targetUserId = bookingRow.artist_id;

            // Retrieve artist profile for this artist_id
            const { data: apByBookingArtist } = await supabase
              .from('artist_profiles')
              .select('*')
              .or(`user_id.eq.${bookingRow.artist_id},id.eq.${bookingRow.artist_id}`)
              .maybeSingle();

            if (apByBookingArtist) {
              targetUserId = apByBookingArtist.user_id || bookingRow.artist_id;
              artistProfileData = apByBookingArtist;
            }
          }
        }

        // ----------------------------------------------------
        // FETCH USER PROFILE DATA (Decoupled to prevent RLS failures)
        // ----------------------------------------------------
        if (targetUserId) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', targetUserId)
            .maybeSingle();

          if (userProfile && isMounted) {
            setArtist({
              ...userProfile,
              artist_profile: artistProfileData || null,
            } as ArtistWithProfile);
          }
        } else if (artistProfileData && isMounted) {
          // Fallback if profiles row is restricted but artist_profile exists
          setArtist({
            id: artistProfileData.user_id,
            full_name: artistProfileData.stage_name || 'Talent',
            artist_profile: artistProfileData,
          } as unknown as ArtistWithProfile);
        }

        // Fetch Host Verification Status
        if (profile?.id && isMounted) {
          const { data: hostData } = await supabase
            .from('host_profiles')
            .select('is_identity_verified, verification_status')
            .eq('id', profile.id)
            .maybeSingle();

          if (hostData) {
            setHostVerification(hostData);
          }
        }
      } catch (err: any) {
        console.error('Error resolving booking page talent:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTalentData();

    return () => {
      isMounted = false;
    };
  }, [id, profile?.id]);

  const ap = artist?.artist_profile;
  const rateUnit = ap?.rate_unit || 'hour';
  const baseRate = ap?.base_rate != null ? Number(ap.base_rate) : null;

  // Auto-calculate total and deposit in ZAR
  const { totalAmount, depositAmount, remainingBalance } = useMemo(() => {
    if (!baseRate || baseRate <= 0) return { totalAmount: 0, depositAmount: 0, remainingBalance: 0 };
    let total = 0;
    if (rateUnit === 'hour') {
      const hours = parseFloat(durationHours) || 0;
      total = baseRate * hours;
    } else {
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
    const targetArtistId = artist?.id || ap?.user_id || id;
    if (!targetArtistId || !profile) return;
    if (!eventName || !eventDate || !location) { setError('Please fill in all required fields'); return; }
    if (rateUnit === 'hour' && (!durationHours || parseFloat(durationHours) <= 0)) { setError('Please enter the duration in hours'); return; }

    setSubmitting(true); setError('');
    try {
      const { data, error: insertErr } = await supabase.from('bookings').insert({
        artist_id: targetArtistId, host_id: profile.id, event_name: eventName, event_date: eventDate,
        start_time: startTime || null, gig_duration: rateUnit === 'hour' ? `${durationHours} hours` : 'Flat fee',
        equipment_needed: equipment, location, notes, status: 'pending',
        total_amount: totalAmount, deposit_amount: depositAmount, deposit_paid: false,
      }).select('id').single();

      if (insertErr) throw insertErr;

      if (data) {
        setCreatedBookingId(data.id);
        
        try {
          const adminId = await getAdminId();
          const artistName = ap?.stage_name || artist?.full_name || 'Talent';
          const hostName = profile.full_name || 'A host';
          const initialMsg = `New booking request for ${artistName} — ${eventName} on ${new Date(eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${location}. Duration: ${rateUnit === 'hour' ? `${durationHours} hours` : 'Flat fee'}. Total: ${formatCurrency(totalAmount)} | Deposit (40%): ${formatCurrency(depositAmount)}.`;
          
          await createConversation(profile.id, `Booking: ${eventName}`, 'booking', data.id, initialMsg, adminId);
          await createNotification(
            targetArtistId,
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
    } catch (err: any) {
      setError(err.message || 'Failed to submit booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayDeposit = async () => {
    const targetArtistId = artist?.id || ap?.user_id || id;
    if (!createdBookingId || !targetArtistId) return;
    setPaying(true);
    setError('');

    if (typeof window.YocoSDK === 'undefined') {
      await confirmDepositInDatabase();
      return;
    }

    try {
      const yoco = new window.YocoSDK({
        publicKey: import.meta.env.VITE_YOCO_PUBLIC_KEY || 'pk_live_1cbf5078e2da1a88_5d9c5f79ac06b8726c9dcf1bd7c158ee',
      });

      yoco.showPopup({
        amountInCents: Math.round(depositAmount * 100),
        currency: 'ZAR',
        name: 'HostMeUp Deposit',
        description: `40% Deposit for ${eventName}`,
        callback: async (result: any) => {
          if (result.error) {
            setError(result.error.message || 'Payment failed. Please try again.');
            setPaying(false);
          } else {
            await confirmDepositInDatabase();
          }
        },
      });
    } catch (err: any) {
      console.warn('Yoco SDK trigger fallback:', err);
      await confirmDepositInDatabase();
    }
  };

  const confirmDepositInDatabase = async () => {
    const targetArtistId = artist?.id || ap?.user_id || id;
    if (!createdBookingId || !targetArtistId) return;
    const { error: payErr } = await supabase.from('bookings')
      .update({ deposit_paid: true, status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', createdBookingId);

    setPaying(false);
    if (payErr) { setError(payErr.message); return; }

    try {
      await createNotification(
        targetArtistId,
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

  if (!artist) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h2 className="font-display text-2xl text-ink mb-2">Talent not found</h2>
      <p className="text-sm text-ink-400 mb-4">The artist or talent profile you are looking for could not be located.</p>
      <Link to="/artists" aria-label="Back to talent directory" className="text-sm font-medium text-accent hover:text-accent-600 underline">Back to directory</Link>
    </div>
  );

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
  const isHostVerified = hostVerification?.is_identity_verified || hostVerification?.verification_status === 'approved';

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-6 lg:px-12 py-12">
        <Link to={`/artists/${artist?.id || id}`} aria-label="Back to talent profile" className="inline-flex items-center gap-2 text-xs font-medium text-ink-400 hover:text-ink uppercase tracking-wide-sm mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Profile
        </Link>

        {/* Unverified Host Warning Banner */}
        {!isHostVerified && (
          <div className="flex items-start justify-between gap-3 p-4 mb-6 border border-amber-200 bg-amber-50 text-amber-900 text-xs">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-700 flex-shrink-0" />
              <div>
                <strong className="font-semibold block mb-0.5">Verification Recommended</strong>
                <span>
                  {hostVerification?.verification_status === 'pending'
                    ? 'Your host verification is currently under review by our team.'
                    : 'Your host identity is unverified. Verifying your profile increases booking acceptance rates from talent.'}
                </span>
              </div>
            </div>
            <Link to="/host-settings" className="font-semibold underline whitespace-nowrap text-amber-900 hover:text-amber-700">
              Verify Now
            </Link>
          </div>
        )}

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
            <button type="button" onClick={() => navigate(`/artists/${artist?.id || id}`)} className="btn-outline px-8 py-3.5 text-xs uppercase tracking-wide-sm">Cancel</button>
          </div>
        </form>
      </div>

      {/* Yoco Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowCheckout(false)}>
          <div className="bg-paper border border-line max-w-md w-full p-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 border border-accent-200 bg-accent-50 flex items-center justify-center text-accent"><Lock className="w-5 h-5" /></div>
              <div>
                <h3 className="font-display text-xl font-bold text-ink">Secure Deposit Checkout</h3>
                <p className="text-xs text-ink-400">Pay 40% now to lock in your booking with Yoco</p>
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

            {error && <div className="flex items-start gap-2 p-3 mb-4 border border-red-200 bg-red-50 text-red-700 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span></div>}

            {/* Actions */}
            <button onClick={handlePayDeposit} disabled={paying} className="btn-accent w-full flex items-center justify-center gap-2 py-4 text-xs uppercase tracking-wide-sm disabled:opacity-50 mb-3">
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Pay {formatCurrency(depositAmount)} with Yoco
            </button>
            <button onClick={handleSkipPayment} className="btn-ghost w-full text-center text-xs uppercase tracking-wide-sm py-2">
              Skip for now — pay later
            </button>
            <p className="text-xs text-ink-300 text-center mt-4 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Encrypted & Secured by Yoco
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
