import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { KeyRound, QrCode, CheckCircle2, ShieldCheck, X, Loader2, AlertCircle } from 'lucide-react';

interface TalentVerificationModalProps {
  bookingId: string;
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TalentVerificationModal({
  bookingId,
  eventName,
  isOpen,
  onClose,
  onSuccess,
}: TalentVerificationModalProps) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  if (!isOpen) return null;

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1); // Take latest char
    setPin(newPin);

    // Auto-focus next input field
    if (value && index < 3) {
      const nextInput = document.getElementById(`pin-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const prevInput = document.getElementById(`pin-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const enteredPin = pin.join('');

    if (enteredPin.length !== 4) {
      setError('Please enter the full 4-digit PIN provided by the host.');
      return;
    }

    setVerifying(true);

    try {
      // 1. Fetch booking to verify PIN matches
      let { data: booking, error: fetchErr } = await supabase
        .from('bookings')
        .select('id, verification_pin, status')
        .eq('id', bookingId)
        .single();

      if (fetchErr && fetchErr.message.includes('Could not find the table')) {
        const fallback = await supabase
          .from('booking')
          .select('id, verification_pin, status')
          .eq('id', bookingId)
          .single();
        booking = fallback.data;
        fetchErr = fallback.error;
      }

      if (fetchErr || !booking) {
        throw new Error('Unable to find booking details.');
      }

      if (booking.verification_pin !== enteredPin) {
        setError('Invalid PIN. Please ask the host for their 4-digit pass code.');
        setVerifying(false);
        return;
      }

      // 2. Try primary update with arrival_verified_at column
      const updateData = {
        is_arrival_verified: true,
        arrival_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let targetTable = 'bookings';
      let { error: updateErr } = await supabase
        .from(targetTable)
        .update(updateData)
        .eq('id', bookingId);

      // Handle table name difference
      if (updateErr && updateErr.message.includes('Could not find the table')) {
        targetTable = 'booking';
        const fallbackUpdate = await supabase
          .from(targetTable)
          .update(updateData)
          .eq('id', bookingId);
        updateErr = fallbackUpdate.error;
      }

      // Safe Fallback: If arrival_verified_at column is missing from schema cache, update standard fields
      if (updateErr && (updateErr.message.includes('arrival_verified_at') || updateErr.code === 'PGRST204')) {
        console.warn('Column arrival_verified_at not found in schema cache. Running safe update fallback...');
        const safeData = {
          is_arrival_verified: true,
          updated_at: new Date().toISOString(),
        };

        const safeFallback = await supabase
          .from(targetTable)
          .update(safeData)
          .eq('id', bookingId);

        updateErr = safeFallback.error;
      }

      if (updateErr) {
        throw updateErr;
      }

      setVerifiedSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-line p-6 sm:p-8 max-w-md w-full relative shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-400 hover:text-ink transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {verifiedSuccess ? (
          <div className="py-8 text-center space-y-3 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="font-display text-2xl font-bold text-ink">On-Site Arrival Verified!</h3>
            <p className="text-xs text-ink-500">
              Arrival confirmed for <strong>{eventName}</strong>. Payment release processing initiated.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4" /> On-Site Arrival Verification
              </div>
              <h2 className="font-display text-2xl font-bold text-ink">Enter Host Pass Code</h2>
              <p className="text-xs text-ink-400">
                Ask the host at <strong>{eventName}</strong> for their 4-digit PIN code to complete on-site check-in.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-6">
              {/* 4-Digit Input Boxes */}
              <div className="flex justify-center gap-3">
                {pin.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`pin-input-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-14 h-16 text-center text-2xl font-bold font-mono bg-paper-200 border border-line rounded focus:border-ink focus:outline-none transition-colors"
                    required
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={verifying || pin.join('').length !== 4}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-wide-sm disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" /> Verify Arrival
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
