import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { X, LogOut, Loader2, PartyPopper } from 'lucide-react';

interface TalentCheckoutModalProps {
  bookingId: string;
  eventName: string;
  isOpen: boolean;
  onClose: () => void;
  onCheckoutSuccess: () => void;
}

export default function TalentCheckoutModal({
  bookingId,
  eventName,
  isOpen,
  onClose,
  onCheckoutSuccess,
}: TalentCheckoutModalProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your account password to confirm check-out.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Verify user password via Supabase re-authentication
      if (user?.email) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: password,
        });

        if (authError) {
          setError('Incorrect password. Please try again.');
          setLoading(false);
          return;
        }
      }

      // 2. Update booking status to 'completed'
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: `[Checked out by talent at ${new Date().toLocaleTimeString()}]`,
        })
        .eq('id', bookingId);

      if (updateError) {
        throw updateError;
      }

      alert('Successfully checked out of event! Event marked as completed.');
      onCheckoutSuccess();
      onClose();
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err?.message || 'Failed to check out. Please try again.');
    } finally {
      setLoading(false);
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
          <h2 className="font-display text-2xl font-bold text-ink">Check Out From Event</h2>
          <p className="text-xs text-ink-400">
            Event: <strong className="text-ink">{eventName}</strong>
          </p>
          <p className="text-xs text-ink-500">
            Enter your account password to securely check out and sign off from this event.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleCheckout} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide-sm text-ink-400 mb-1.5">
              Account Password
            </label>
            <input
              type="password"
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
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Confirm Check Out</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
