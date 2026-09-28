import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LogOut, X, Loader2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

interface TalentCheckoutModalProps {
  bookingId: string;
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TalentCheckoutModal({
  bookingId,
  eventName,
  isOpen,
  onClose,
  onSuccess,
}: TalentCheckoutModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Please enter your account password to confirm checkout.');
      return;
    }

    setLoading(true);

    try {
      // 1. Re-authenticate user via Supabase to verify password security
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) throw new Error('User session not found.');

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (authError) {
        throw new Error('Incorrect password. Please try again.');
      }

      // 2. Update booking status to completed / checked out
      const checkoutData = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let { error: updateErr } = await supabase
        .from('bookings')
        .update(checkoutData)
        .eq('id', bookingId);

      if (updateErr && updateErr.message?.includes('Could not find the table')) {
        const fallback = await supabase
          .from('booking')
          .update(checkoutData)
          .eq('id', bookingId);
        updateErr = fallback.error;
      }

      if (updateErr) throw updateErr;

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err.message || 'Checkout failed. Please check your credentials.');
    } finally {
      setLoading(false);
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

        {success ? (
          <div className="py-8 text-center space-y-3 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="font-display text-2xl font-bold text-ink">Successfully Checked Out!</h3>
            <p className="text-xs text-ink-500">
              Gig concluded for <strong>{eventName}</strong>. Final balance release requested.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-ink-700 text-xs font-bold uppercase tracking-wider mb-1">
                <Lock className="w-4 h-4" /> Security Confirmation
              </div>
              <h2 className="font-display text-2xl font-bold text-ink">Check Out from Event</h2>
              <p className="text-xs text-ink-400">
                Enter your account password to securely check out and sign off from <strong>{eventName}</strong>.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide-sm text-ink-500 mb-1">
                  Account Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full border border-line p-3 bg-paper-200 text-ink rounded text-sm focus:outline-none focus:border-ink"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-xs uppercase tracking-wide-sm disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying Password...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" /> Confirm Check Out
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
