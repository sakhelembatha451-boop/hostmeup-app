import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { KeyRound, ShieldCheck, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { createNotification } from '@/lib/messaging';

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
    newPin[index] = value.slice(-1);
    setPin(newPin);

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
      let { data: booking, error: fetchErr } = await supabase
        .from('bookings')
        .select('id, verification_pin, status, host_id, client_id, event_name')
        .eq('id', bookingId)
        .single();

      if (fetchErr && fetchErr.message.includes('Could not find the table')) {
        const fallback = await supabase
          .from('booking')
          .select('id, verification_pin, status, host_id, client_id, event_name')
          .eq('id', bookingId)
          .single();
        booking = fallback.data;
        fetchErr = fallback.error;
      }

      if (fetchErr || !booking) {
        throw new Error('Unable to find booking details.');
      }

      if (booking.verification_pin !== enteredPin) {
        setError('Invalid PIN code. Please confirm with the host.');
        setVerifying(false);
        return;
      }

      const updateData = {
        is_arrival_verified: true,
        arrival_verified_at: new Date().toISOString(),
        status: 'checked_in',
        updated_at: new Date().toISOString(),
      };

      let targetTable = 'bookings';
      let { error: updateErr } = await supabase
        .from(targetTable)
        .update(updateData)
        .eq('id', bookingId);

      if (updateErr && updateErr.message.includes('Could not find the table')) {
        targetTable = 'booking';
        const fallbackUpdate = await supabase
          .from(targetTable)
          .update(updateData)
          .eq('id', bookingId);
        updateErr = fallbackUpdate.error;
      }

      if (updateErr && (updateErr.message.includes('arrival_verified_at') || updateErr.code === 'PGRST204')) {
        const safeFallback = await supabase
          .from(targetTable)
          .update({
            is_arrival_verified: true,
            status: 'checked_in',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId);

        updateErr = safeFallback.error;
      }

      if (updateErr) throw updateErr;

      // Dispatch Real-Time Notification to the Host upon successful check-in
      const hostTargetId = booking.host_id || booking.client_id;
      if (hostTargetId) {
        await createNotification(
          hostTargetId,
          'check_in',
          'Artist Arrived & Checked In 📍',
          `The artist has checked in at "${booking.event_name || eventName}".`,
          '/host-dashboard',
          bookingId
        );
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
      className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-line p-8 max-w-md w-full relative shadow-2xl space-y-6"
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
          <div className="py-8 text-center space-y-4 animate-fade-in">
            <div className="w-14 h-14 bg-emerald-700 text-paper flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-xs uppercase tracking-wide-sm text-emerald-800 font-bold">— Verified</p>
            <h3 className="font-display text-2xl font-bold text-ink">Arrival Confirmed</h3>
            <p className="text-xs text-ink-500 leading-relaxed max-w-xs mx-auto">
              On-site check-in verified for <strong>{eventName}</strong>. Escrow payout processing initiated.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-[10px] uppercase tracking-wide-sm text-emerald-700 font-bold flex items-center gap-1 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Escrow Security Check-In
              </p>
              <h2 className="font-display text-3xl font-bold text-ink tracking-tight">Host Verification</h2>
              <p className="text-xs text-ink-500 mt-1">
                Enter the 4-digit PIN provided by the event host at <strong>{eventName}</strong>.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-800 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-6">
              {/* 4-Digit Sharp Minimalist Inputs */}
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
                    className="w-14 h-16 text-center text-2xl font-bold font-mono bg-paper-100 border border-line text-ink focus:border-ink focus:bg-paper focus:outline-none transition-colors"
                    required
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={verifying || pin.join('').length !== 4}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-xs font-semibold uppercase tracking-wide-sm bg-ink text-paper hover:bg-ink/90 disabled:opacity-50 transition-colors border border-ink"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying Code...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" /> Verify & Authorize
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
