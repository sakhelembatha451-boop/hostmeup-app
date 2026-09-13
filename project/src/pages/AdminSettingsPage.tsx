import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function AdminSettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [setting, setSetting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSetAdmin = async () => {
    if (!profile) return;
    setSetting(true);
    setError('');
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ is_admin: true, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    setSetting(false);
    if (updateErr) { setError(updateErr.message); return; }
    await refreshProfile();
    setSuccess(true);
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-6 lg:px-12 py-12">
        <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-3">— Admin</p>
        <h1 className="font-display text-4xl font-bold text-ink mb-2 tracking-tight">Admin Settings</h1>
        <p className="text-ink-400 mb-10">Manage your platform admin access.</p>

        {error && (
          <div className="flex items-start gap-2 p-3 mb-6 border border-red-200 bg-red-50 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
          </div>
        )}

        <div className="border border-line p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-12 h-12 flex items-center justify-center border ${profile?.is_admin ? 'border-accent-200 bg-accent-50 text-accent' : 'border-line text-ink-300'}`}>
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">Admin Access</h3>
              <p className="text-sm text-ink-400">Admins can view all user conversations and booking threads.</p>
            </div>
          </div>

          {profile?.is_admin ? (
            <div className="flex items-center gap-3 p-4 border border-accent-200 bg-accent-50">
              <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-accent">You have admin access.</p>
                <p className="text-xs text-accent/70 mt-0.5">Visit the Admin Inbox to view and reply to all user messages.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-500 mb-6">
                You are not currently an admin. Click below to grant yourself admin access for this platform.
                This will allow you to receive direct messages from users and booking request notifications.
              </p>
              <button onClick={handleSetAdmin} disabled={setting}
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-wide-sm disabled:opacity-50">
                {setting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Grant Admin Access
              </button>
              {success && (
                <div className="mt-4 flex items-center gap-2 p-3 border border-accent-200 bg-accent-50 text-accent text-sm">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Admin access granted successfully.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
