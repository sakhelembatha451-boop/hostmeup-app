import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loader2, ArrowLeft, Calendar, Clock, MapPin, Plus, X, AlertCircle, CheckCircle2, Music, Lock, CreditCard, ShieldCheck, ShieldAlert, UserPlus, Trash2, Search } from 'lucide-react';
import type { ArtistWithProfile } from '@/types';
import { getAdminId, createConversation, createNotification } from '@/lib/messaging';

interface SelectedTalent {
  artist: ArtistWithProfile;
  rate: number;
  rateUnit: string;
}

const EQUIPMENT_OPTIONS = ['PA System', 'Microphones', 'DJ Controller', 'Speakers', 'Mixing Board', 'Stage Lighting', 'Instruments', 'Cables', 'Drum Kit', 'Keyboard'];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

export default function BookingRequestPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [bookingCreated, setBookingCreated] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);

  const [selectedTalents, setSelectedTalents] = useState<SelectedTalent[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ArtistWithProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  const extractTalentInfo = (artistData: ArtistWithProfile): SelectedTalent => {
    const ap = artistData.artist_profile;
    const rateUnit = ap?.rate_unit || 'hour';
    const baseRate = ap?.base_rate ?? ap?.hourly_rate ?? ap?.rate ?? 0;
    return {
      artist: artistData,
      rate: Number(baseRate) || 0,
      rateUnit,
    };
  };

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function loadTalentData() {
      setLoading(true);
      setError('');

      try {
        let targetUserId: string | null = null;
        let artistProfileData: any = null;

        const { data: apByUser } = await supabase
          .from('artist_profiles')
          .select('*')
          .eq('user_id', id)
          .maybeSingle();

        if (apByUser) {
          targetUserId = id;
          artistProfileData = apByUser;
        } else {
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

        let fetchedArtist: ArtistWithProfile | null = null;

        if (targetUserId) {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', targetUserId)
            .maybeSingle();

          if (userProfile && isMounted) {
            fetchedArtist = {
              ...userProfile,
              artist_profile: artistProfileData || null,
            } as ArtistWithProfile;
          }
        } else if (artistProfileData && isMounted) {
          fetchedArtist = {
            id: artistProfileData.user_id,
            full_name: artistProfileData.stage_name || 'Talent',
            artist_profile: artistProfileData,
          } as unknown as ArtistWithProfile;
        }

        if (fetchedArtist && isMounted) {
          setSelectedTalents([extractTalentInfo(fetchedArtist)]);
        }

        if (profile?.id && isMounted) {
          const { data: hostData } = await supabase
            .from('host_profiles')
            .select('is_identity_verified, verification_status')
            .eq('id', profile.id)
            .maybeSingle();

          if (hostData) setHostVerification(hostData);
        }
      } catch (err: any) {
        console.error('Error resolving booking page talent:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTalentData();
    return () => { isMounted = false; };
  }, [id, profile?.id]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data: profiles } = await supabase
          .from('artist_profiles')
          .select('*, profiles:user_id(*)')
          .or(`stage_name.ilike.%${searchQuery}%,bio.ilike.%${searchQuery}%`)
          .limit(5);

        if (profiles) {
          const formatted: ArtistWithProfile[] = profiles.map((ap: any) => ({
            ...(ap.profiles || {}),
            id: ap.user_id,
            full_name: ap.stage_name || ap.profiles?.full_name || 'Talent Provider',
            artist_profile: ap,
          }));
          setSearchResults(formatted.filter(item => !selectedTalents.some(st => st.artist.id === item.id)));
        }
      } catch (err) {
        console.error('Error searching talents:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedTalents]);

  const addTalentToBooking = (artistToAdd: ArtistWithProfile) => {
    setSelectedTalents(prev => [...prev, extractTalentInfo(artistToAdd)]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeTalentFromBooking = (artistId: string) => {
    if (selectedTalents.length <= 1) {
      setError('A booking must have at least one talent provider.');
      return;
    }
    setSelectedTalents(prev => prev.filter(t => t.artist.id !== artistId));
  };

  const { totalAmount, depositAmount, remainingBalance } = useMemo(() => {
    const hours = parseFloat(durationHours) || 0;
    let total = 0;

    selectedTalents.forEach(item => {
      if (item.rateUnit === 'hour') {
        total += item.rate * hours;
      } else {
        total += item.rate;
      }
    });

    const deposit = total * 0.4;
    const remaining = total * 0.6;
    return { totalAmount: total, depositAmount: deposit, remainingBalance: remaining };
  }, [selectedTalents, durationHours]);

  const toggleEquipment = (item: string) => setEquipment(equipment.includes(item) ? equipment.filter((e) => e !== item) : [...equipment, item]);
  const addCustomEquipment = () => { if (customEquipment.trim()) { setEquipment([...equipment, customEquipment.trim()]); setCustomEquipment(''); } };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (selectedTalents.length === 0) { setError('Please select at least one talent provider.'); return; }
    if (!eventName || !eventDate || !location) { setError('Please fill in all required fields'); return; }

    const hasHourlyTalent = selectedTalents.some(t => t.rateUnit === 'hour');
    if (hasHourlyTalent && (!durationHours || parseFloat(durationHours) <= 0)) { 
      setError('Please enter the duration in hours for hourly talent.'); 
      return; 
    }

    setSubmitting(true);
    setError('');

    const primaryTalent = selectedTalents[0].artist;
    const targetArtistId = primaryTalent.id || primaryTalent.artist_profile?.user_id || id;

    const payload = {
      artist_id: targetArtistId,
      host_id: profile.id,
      event_name: eventName,
      event_date: eventDate,
      start_time: startTime || null,
      gig_duration: `${durationHours || '1'} hours`,
      equipment_needed: equipment,
      location,
      notes: `Hired Talent Providers (${selectedTalents.length}): ${selectedTalents.map(t => t.artist.artist_profile?.stage_name || t.artist.full_name).join(', ')}. ${notes}`,
      status: 'pending',
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      deposit_paid: false,
    };

    try {
      let { data, error: insertErr } = await supabase
        .from('bookings')
        .insert(payload)
        .select('id')
        .single();

      if (insertErr && insertErr.message.includes("Could not find the table")) {
        const fallback = await supabase
          .from('booking')
          .insert(payload)
          .select('id')
          .single();

        data = fallback.data;
        insertErr = fallback.error;
      }

      if (insertErr) throw insertErr;

      if (data) {
        setCreatedBookingId(data.id);
        
        try {
          const adminId = await getAdminId();
          const hostName = profile.full_name || 'A host';

          for (const item of selectedTalents) {
            const artistObj = item.artist;
            const artistName = artistObj.artist_profile?.stage_name || artistObj.full_name || 'Talent';
            const artistUserId = artistObj.id || artistObj.artist_profile?.user_id;

            if (artistUserId) {
              const initialMsg = `New booking request for ${artistName} — ${eventName} on ${new Date(eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${location}. Duration: ${durationHours ? `${durationHours} hours` : 'Event'}. Total: ${formatCurrency(item.rateUnit === 'hour' ? item.rate * (parseFloat(durationHours) || 1) : item.rate)}.`;
              
              await createConversation(profile.id, `Booking: ${eventName}`, 'booking', data.id, initialMsg, adminId);
              await createNotification(
                artistUserId,
                'booking',
                'New Booking Request! 📅',
                `${hostName} sent a booking request for "${eventName}" on ${eventDate}.`,
                '/artist-dashboard',
                undefined,
                data.id
              );
            }
          }
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
    if (!createdBookingId) return;
    setPaying(true);
    setError('');

    try {
      const secretKey = import.meta.env.VITE_YOCO_SECRET_KEY || 'sk_live_1cbf5078e2da1a88_5d9c5f79ac06b8726c9dcf1bd7c158ee';

      const response = await fetch('https://online.yoco.com/v1/checkouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          amount: Math.round(depositAmount * 100),
          currency: 'ZAR',
          successUrl: `${window.location.origin}/host-dashboard?booking_id=${createdBookingId}&payment=success`,
          cancelUrl: `${window.location.origin}/booking/${id}?payment=cancelled`,
          metadata: {
            bookingId: createdBookingId,
            eventName: eventName,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.redirectUrl) {
        throw new Error(data.message || 'Failed to initialize Yoco Checkout session.');
      }

      window.location.href = data.redirectUrl;
    } catch (err: any) {
      console.error('Yoco Checkout error:', err);
      setError(err.message || 'Payment gateway failed to initialize.');
      setPaying(false);
    }
  };

  const handleSkipPayment = () => {
    setShowCheckout(false);
    setBookingCreated(true);
    setTimeout(() => navigate('/host-dashboard'), 1500);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 text-ink animate-spin" /></div>;

  if (selectedTalents.length === 0) return (
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
        <h2 className="font-display text-3xl font-bold text-ink mb-2">Booking Requests Sent!</h2>
        <p className="text-ink-400">Redirecting to your dashboard...</p>
      </div>
    </div>
  );

  const isHostVerified = hostVerification?.is_identity_verified || hostVerification?.verification_status === 'approved';

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-6 lg:px-12 py-12">
        <Link to={`/artists/${selectedTalents[0]?.artist.id || id}`} aria-label="Back to talent profile" className="inline-flex items-center gap-2 text-xs font-medium text-ink-400 hover:text-ink uppercase tracking-wide-sm mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Profile
        </Link>

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

        <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-2">— Multi-Talent Booking Request</p>
        <h1 className="font-display text-3xl font-bold text-ink mb-2">Hire talent for your event.</h1>
        <p className="text-ink-400 mb-8">Add multiple providers to a single event booking and pay one combined 40% deposit.</p>

        <div className="border border-line p-6 mb-8 bg-paper-100">
          <h3 className="font-display text-base font-bold text-ink mb-4 flex items-center justify-between">
            <span>Selected Talent Roster ({selectedTalents.length})</span>
          </h3>

          <div className="space-y-3 mb-6">
            {selectedTalents.map((item, idx) => {
              const ap = item.artist.artist_profile;
              const name = ap?.stage_name || item.artist.full_name;
              return (
                <div key={item.artist.id || idx} className="flex items-center justify-between p-4 bg-paper border border-line">
                  <div className="flex items-center gap-4">
                    {item.artist.avatar_url ? (
                      <img src={item.artist.avatar_url} alt={name} className="w-12 h-12 rounded-full object-cover border border-line" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-ink text-paper flex items-center justify-center font-bold">{name[0]?.toUpperCase()}</div>
                    )}
                    <div>
                      <h4 className="font-bold text-ink text-sm">{name}</h4>
                      <p className="text-xs text-ink-400">{ap?.performance_roles?.join(', ') || ap?.category || 'Talent Provider'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-accent">
                      {formatCurrency(item.rate)}/{item.rateUnit === 'hour' ? 'hr' : item.rateUnit}
                    </span>
                    {selectedTalents.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => removeTalentFromBooking(item.artist.id)} 
                        className="text-ink-400 hover:text-red-600 transition-colors"
                        title="Remove talent"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative">
            <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2 flex items-center gap-1">
              <UserPlus className="w-3.5 h-3.5" /> Add Another Talent / Asset Provider to Event
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search talent or asset by stage name..."
                className="input-editorial w-full pl-9 pr-4 py-2.5 text-sm"
              />
              <Search className="w-4 h-4 text-ink-400 absolute left-3 top-3" />
              {isSearching && <Loader2 className="w-4 h-4 text-ink-400 animate-spin absolute right-3 top-3" />}
            </div>

            {searchResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-paper border border-line shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => addTalentToBooking(res)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-paper-200 border-b border-line last:border-0 transition-colors"
                  >
                    <span className="text-sm font-medium text-ink">{res.artist_profile?.stage_name || res.full_name}</span>
                    <span className="text-xs text-accent font-semibold">+ Add Provider</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div className="flex items-start gap-2 p-3 mb-6 border border-red-200 bg-red-50 text-red-700 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span></div>}

        <form onSubmit={handleSubmit} className="space-y-8">
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
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Booking Duration (Hours) *</label>
                <input type="number" min="0.5" step="0.5" required value={durationHours} onChange={(e) => setDurationHours(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="e.g. 4" />
                <p className="text-xs text-ink-300 mt-1">This duration applies to all hourly rate talent selected above.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> Location / Venue *</label>
                <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="Venue address" />
              </div>
            </div>
          </div>

          <div className="border border-line p-6 lg:p-8 bg-paper-200">
            <h3 className="font-display text-lg font-semibold text-ink mb-6 flex items-center gap-2"><CreditCard className="w-4 h-4 text-accent" /> Pricing Summary</h3>
            <div className="space-y-4">
              <div className="flex items-baseline justify-between pb-4 border-b border-line">
                <div>
                  <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Total Booking Cost</p>
                  <p className="text-sm text-ink-500">Combined total for {selectedTalents.length} provider(s)</p>
                </div>
                <span className="font-display text-3xl font-bold text-ink">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide-sm text-accent mb-1">Required Upfront Deposit (40%)</p>
                  <p className="text-sm text-ink-400">Due now to confirm all providers</p>
                </div>
                <span className="font-display text-2xl font-semibold text-accent">{formatCurrency(depositAmount)}</span>
              </div>
              <div className="flex items-baseline justify-between pt-4 border-t border-line">
                <div>
                  <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-1">Remaining Balance (60%)</p>
                  <p className="text-sm text-ink-400">Due after event completion</p>
                </div>
                <span className="font-display text-2xl font-semibold text-ink-600">{formatCurrency(remainingBalance)}</span>
              </div>
            </div>
          </div>

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

          <div className="border border-line p-6 lg:p-8">
            <h3 className="font-display text-lg font-semibold text-ink mb-6 flex items-center gap-2"><Music className="w-4 h-4 text-accent" /> Additional Notes</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="input-editorial w-full px-4 py-2.5 text-sm" placeholder="Special requests or instructions for the team..." />
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting} className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-xs uppercase tracking-wide-sm disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />} Continue to Checkout
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn-outline px-8 py-3.5 text-xs uppercase tracking-wide-sm">Cancel</button>
          </div>
        </form>
      </div>

      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setShowCheckout(false)}>
          <div className="bg-paper border border-line max-w-md w-full p-8 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 border border-accent-200 bg-accent-50 flex items-center justify-center text-accent"><Lock className="w-5 h-5" /></div>
              <div>
                <h3 className="font-display text-xl font-bold text-ink">Secure Deposit Checkout</h3>
                <p className="text-xs text-ink-400">Pay combined 40% deposit with Yoco</p>
              </div>
            </div>

            <div className="border border-line p-4 mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">Providers Hired</span>
                <span className="font-medium text-ink">{selectedTalents.length} Talent(s)</span>
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
