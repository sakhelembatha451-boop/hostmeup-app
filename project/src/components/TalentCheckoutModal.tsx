import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, LogOut, Loader2, PartyPopper, MapPin } from 'lucide-react';

interface TalentCheckoutModalProps {
  bookingId: string;
  eventName: string;
  location: string;
  isOpen: boolean;
  onClose: () => void;
  onCheckoutSuccess: () => void;
}

// Helper to calculate distance in meters using Haversine formula
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper to geocode address text using OpenStreetMap Nominatim
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`, {
      headers: { 'User-Agent': 'HostMeUp-App' }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.error('Geocoding error:', err);
  }
  return null;
}

export default function TalentCheckoutModal({
  bookingId,
  eventName,
  location,
  isOpen,
  onClose,
  onCheckoutSuccess,
}: TalentCheckoutModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Please enter your account password confirmation.');
      return;
    }

    setLoading(true);
    setStatusMessage('Verifying session...');

    try {
      // 1. Get current authenticated user session securely
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setError('User session not found. Please log in again.');
        setLoading(false);
        setStatusMessage(null);
        return;
      }

      // 2. Perform Geofence & GPS Verification (75-meter radius)
      setStatusMessage('Checking GPS location (75m geofence)...');
      
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser.');
        setLoading(false);
        setStatusMessage(null);
        return;
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      }).catch((geoErr) => {
        console.error('Geolocation error:', geoErr);
        throw new Error('Unable to retrieve your GPS location. Please ensure location permissions are enabled.');
      });

      const artistLat = position.coords.latitude;
      const artistLng = position.coords.longitude;

      // Geocode the venue location string
      const venueCoords = await geocodeAddress(location || 'Cape Town');
      if (!venueCoords) {
        throw new Error(`Could not verify venue address coordinates for "${location}". Please contact support.`);
      }

      const distance = getDistanceInMeters(artistLat, artistLng, venueCoords.lat, venueCoords.lng);
      console.log(`Checkout distance from venue: ${Math.round(distance)} meters`);

      const ALLOWED_RADIUS_METERS = 75;

      if (distance > ALLOWED_RADIUS_METERS) {
        setError(`Geofence check failed: You are approximately ${Math.round(distance)} meters away from the venue. You must be within ${ALLOWED_RADIUS_METERS} meters to check out.`);
        setLoading(false);
        setStatusMessage(null);
        return;
      }

      // 3. Fetch booking details to retrieve the host ID
      setStatusMessage('Submitting checkout request...');
      const { data: bookingData, error: fetchError } = await supabase
        .from('bookings')
        .select('id, host_id, client_id, event_name')
        .eq('id', bookingId)
        .single();

      if (fetchError) {
        console.error('Error fetching booking:', fetchError);
      }

      // 4. Update booking status to 'pending_checkout_approval' with audit coordinates
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'pending_checkout_approval',
          checkout_lat: artistLat,
          checkout_lng: artistLng,
          notes: `[Checkout requested by talent at ${new Date().toLocaleTimeString()} - Password Confirmed & Awaiting Host Approval]`,
        })
        .eq('id', bookingId);

      if (updateError) {
        throw updateError;
      }

      // 5. Dispatch real-time notification to the host for Dual-Party Approval
      const hostTargetId = bookingData?.host_id || bookingData?.client_id;
      if (hostTargetId) {
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: hostTargetId,
          type: 'checkout_request',
          title: 'Checkout Approval Required 📍',
          message: `The artist has requested check-out for "${bookingData?.event_name || eventName}". Tap to review and approve completion.`,
          link: '/host-dashboard',
          related_id: bookingId,
          is_read: false,
        });

        if (notifError) {
          console.error('Error inserting notification (check RLS policies):', notifError);
        }
      } else {
        console.warn('Could not find host_id or client_id on booking for notification dispatch.');
      }

      alert('Checkout request submitted successfully! Awaiting host approval.');
      onCheckoutSuccess();
      onClose();
    } catch (err: any) {
      console.error('Checkout error catch block:', err);
      setError(err?.message || 'Failed to check out. Please try again.');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-paper border border-line p-6 max-w-md w-full shadow-2xl relative space-y-6" onClick={(e) => e.stopPropagation()}>
        
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-400 hover:text-ink">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-purple-50 text-purple-700 border border-purple-200 rounded-full flex items-center justify-center mx-auto">
            <PartyPopper className="w-6 h-6" />
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">Secure Check Out</h2>
          <p className="text-xs text-ink-400">
            Event: <strong className="text-ink">{eventName}</strong>
          </p>
          <div className="flex items-center justify-center gap-1 text-xs text-ink-500 pt-1">
            <MapPin className="w-3.5 h-3.5 text-purple-600" />
            <span>Venue: {location || 'Standard Venue'} (75m Geofence Active)</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleCheckout} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-1.5">
              Account Password Confirmation
            </label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-line rounded bg-white text-ink focus:outline-none focus:border-ink"
              required
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-outline flex-1 py-2.5 text-xs uppercase tracking-wide-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-ink text-paper hover:bg-ink/90 py-2.5 text-xs font-semibold uppercase tracking-wide-sm rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{statusMessage || 'Verifying...'}</span>
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Request Checkout</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
