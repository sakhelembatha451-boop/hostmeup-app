import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Mail, Settings, Users, Calendar, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    pendingVerifications: 0,
    totalBookings: 0,
    totalArtists: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminStats() {
      try {
        const { count: pendingCount } = await supabase
          .from('host_profiles')
          .select('*', { count: 'exact', head: true })
          .eq('verification_status', 'pending');

        const { count: bookingsCount } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true });

        const { count: artistsCount } = await supabase
          .from('artist_profiles')
          .select('*', { count: 'exact', head: true });

        setStats({
          pendingVerifications: pendingCount || 0,
          totalBookings: bookingsCount || 0,
          totalArtists: artistsCount || 0,
        });
      } catch (err) {
        console.error('Error loading admin stats:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ink-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper py-12 px-6 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <p className="text-xs uppercase tracking-wide-sm text-ink-400 mb-2">— System Management</p>
          <h1 className="font-display text-3xl font-bold text-ink">Admin Portal</h1>
          <p className="text-xs text-ink-500 mt-1">Manage platform verifications, messages, and configurations.</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-line py-6">
          <div>
            <div className="font-display text-3xl font-bold text-accent">{stats.pendingVerifications}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400 mt-1">Pending Verifications</div>
          </div>
          <div>
            <div className="font-display text-3xl font-bold text-ink">{stats.totalBookings}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400 mt-1">Total Bookings</div>
          </div>
          <div>
            <div className="font-display text-3xl font-bold text-ink-500">{stats.totalArtists}</div>
            <div className="text-xs uppercase tracking-wide-sm text-ink-400 mt-1">Registered Artists</div>
          </div>
        </div>

        {/* Management Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link to="/admin/verifications" className="border border-line p-6 hover:border-ink transition-all bg-paper flex flex-col justify-between space-y-4">
            <div>
              <ShieldCheck className="w-6 h-6 text-accent mb-3" />
              <h3 className="font-display text-lg font-bold text-ink">Identity Verifications</h3>
              <p className="text-xs text-ink-500 mt-1">Review uploaded documents and approve host status.</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide-sm text-accent">Review Requests →</span>
          </Link>

          <Link to="/admin/inbox" className="border border-line p-6 hover:border-ink transition-all bg-paper flex flex-col justify-between space-y-4">
            <div>
              <Mail className="w-6 h-6 text-ink-400 mb-3" />
              <h3 className="font-display text-lg font-bold text-ink">Platform Inbox</h3>
              <p className="text-xs text-ink-500 mt-1">View incoming platform inquiries and admin support messages.</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide-sm text-ink">Open Inbox →</span>
          </Link>

          <Link to="/admin/settings" className="border border-line p-6 hover:border-ink transition-all bg-paper flex flex-col justify-between space-y-4">
            <div>
              <Settings className="w-6 h-6 text-ink-400 mb-3" />
              <h3 className="font-display text-lg font-bold text-ink">System Settings</h3>
              <p className="text-xs text-ink-500 mt-1">Configure platform rates, deposit requirements, and general policies.</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide-sm text-ink">Manage Settings →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
