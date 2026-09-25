import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import HostVerificationForm from '@/components/HostVerificationForm';
import { Shield, User, Loader2 } from 'lucide-react';

export default function HostSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);

          // Fetch user role from profiles table
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          if (profile) {
            setUserRole(profile.role);
          }
        }
      } catch (err) {
        console.error('Error fetching user context:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ink-400" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-paper py-20 px-6 text-center">
        <h2 className="font-display text-xl font-bold text-ink">Access Denied</h2>
        <p className="text-sm text-ink-500 mt-2">Please log in to manage your account settings.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper py-12 px-6 lg:px-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Host Account & Safety</h1>
          <p className="text-xs text-ink-500 mt-1">
            Manage your personal verification documents to keep talent and venue bookings safe.
          </p>
        </div>

        {/* Host Verification Component */}
        <HostVerificationForm hostId={userId} />
      </div>
    </div>
  );
}
