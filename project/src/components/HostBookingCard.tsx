import { useState } from 'react';
import { QrCode, KeyRound, ShieldCheck } from 'lucide-react';

export function HostBookingCard({ booking }: { booking: any }) {
  const [showVerification, setShowVerification] = useState(false);

  // Generate QR payload
  const qrData = JSON.stringify({
    bookingId: booking.id,
    token: booking.verification_token,
  });
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

  return (
    <div className="border border-line p-6 bg-paper space-y-4">
      {/* Verification Drawer Trigger */}
      <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-emerald-900 text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Arrival Verification Pass
          </div>
          <p className="text-xs text-emerald-700 mt-0.5">
            Share either your QR Code or 4-digit PIN with the talent upon arrival.
          </p>
        </div>

        <button
          onClick={() => setShowVerification(!showVerification)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs uppercase tracking-wider font-semibold px-4 py-2 rounded flex items-center gap-2 whitespace-nowrap"
        >
          <QrCode className="w-4 h-4" />
          {showVerification ? 'Hide Verification' : 'Show Pass & PIN'}
        </button>
      </div>

      {/* Verification Drawer */}
      {showVerification && (
        <div className="p-6 bg-paper border border-line rounded grid grid-cols-1 md:grid-cols-2 gap-6 items-center text-center animate-fade-in">
          {/* Method A: QR Code */}
          <div className="flex flex-col items-center space-y-2 border-b md:border-b-0 md:border-r border-line pb-4 md:pb-0 md:pr-6">
            <p className="text-xs font-semibold text-ink uppercase tracking-wide">Option 1: Scan QR Code</p>
            <div className="p-2 bg-white border border-line rounded shadow-inner">
              <img src={qrImageUrl} alt="Host QR Pass" className="w-40 h-40 object-contain" />
            </div>
          </div>

          {/* Method B: 4-Digit PIN */}
          <div className="flex flex-col items-center space-y-2">
            <p className="text-xs font-semibold text-ink uppercase tracking-wide">Option 2: Unique PIN</p>
            <p className="text-xs text-ink-400">Give this code to the talent if camera access isn't available.</p>
            <div className="font-mono text-3xl font-bold tracking-widest text-emerald-900 bg-emerald-100/50 px-6 py-2 border border-emerald-300 rounded-lg">
              {booking.verification_pin || '----'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
