import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Wallet, Clock, CheckCircle2, ArrowUpRight, ShieldCheck, Percent, Loader2 } from 'lucide-react';
import type { Booking } from '@/types';

function formatCurrency(n: number | null) {
  if (n == null) return 'R0';
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export const TalentEarningsTab: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const loadEarningsData = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const authUserId = profile.id;

      // Find associated artist profile ID
      const { data: artistProfile } = await supabase
        .from('artist_profiles')
        .select('id')
        .eq('user_id', authUserId)
        .maybeSingle();

      const targetArtistIds = Array.from(
        new Set([authUserId, artistProfile?.id].filter(Boolean))
      );

      // Fetch bookings for this talent
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .or(`artist_id.in.(${targetArtistIds.join(',')}),client_id.eq.${authUserId}`)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (err) {
      console.error('Error loading earnings data:', err);
    } font-sans finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadEarningsData();
  }, [loadEarningsData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-ink animate-spin" />
      </div>
    );
  }

  // Calculate dynamic totals (applying 33% platform fee deduction)
  const PLATFORM_FEE_RATE = 0.33;

  // Escrow held (Confirmed/Accepted/Checked-in bookings)
  const grossEscrow = bookings
    .filter((b) => ['confirmed', 'accepted', 'checked_in'].includes(b.status) || b.deposit_paid)
    .reduce((sum, b) => sum + (b.total_price || b.total_amount || 0), 0);
  const netEscrow = grossEscrow * (1 - PLATFORM_FEE_RATE);

  // Available / Completed earnings
  const grossCompleted = bookings
    .filter((b) => b.status === 'completed' || b.balance_paid || !!b.completed_at)
    .reduce((sum, b) => sum + (b.total_price || b.total_amount || 0), 0);
  const netCompleted = grossCompleted * (1 - PLATFORM_FEE_RATE);

  // Lifetime Total
  const grossLifetime = bookings
    .filter((b) => ['confirmed', 'accepted', 'completed', 'fully_paid'].includes(b.status))
    .reduce((sum, b) => sum + (b.total_price || b.total_amount || 0), 0);
  const netLifetime = grossLifetime * (1 - PLATFORM_FEE_RATE);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Commission Policy Banner */}
      <div className="bg-purple-900/10 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-900 text-white rounded-lg">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-display font-bold text-ink text-sm">HostMeUp Platform Commission Policy</h4>
            <p className="text-xs text-ink-500">A standard 33% platform fee is applied to all gross booking values to maintain secure escrow safety and platform operations.</p>
          </div>
        </div>
        <span className="hidden sm:inline-block px-3 py-1 bg-purple-900 text-white text-[11px] font-bold uppercase tracking-wide-sm rounded">
          33% Platform Rate
        </span>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-xs border border-line">
          <div className="flex items-center justify-between text-ink-400 mb-2">
            <span className="text-xs uppercase tracking-wide-sm font-semibold">Total Lifetime Net Earned</span>
            <Wallet className="w-5 h-5 text-emerald-800" />
          </div>
          <p className="text-3xl font-display font-bold text-ink">{formatCurrency(netLifetime)}</p>
          <span className="text-xs text-emerald-800 font-medium flex items-center gap-1 mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" /> After 33% platform fee deduction
          </span>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-xs border border-line">
          <div className="flex items-center justify-between text-ink-400 mb-2">
            <span className="text-xs uppercase tracking-wide-sm font-semibold">In Escrow (Net Payout)</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-3xl font-display font-bold text-ink">{formatCurrency(netEscrow)}</p>
          <p className="text-xs text-ink-400 mt-2">Released upon event completion</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-xs border border-line">
          <div className="flex items-center justify-between text-ink-400 mb-2">
            <span className="text-xs uppercase tracking-wide-sm font-semibold">Available for Payout</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-800" />
          </div>
          <p className="text-3xl font-display font-bold text-ink">{formatCurrency(netCompleted)}</p>
          <button className="mt-3 w-full bg-ink text-paper text-xs uppercase font-semibold tracking-wide-sm py-2.5 rounded hover:bg-ink-800 transition">
            Request Payout to Bank
          </button>
        </div>
      </div>

      {/* Real Booking Table */}
      <div className="bg-white rounded-xl shadow-xs border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="font-display font-bold text-ink text-base">Gig Earnings & 33% Commission Breakdown</h3>
          <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-sm font-bold uppercase tracking-wide-sm">
            Protected by HostMeUp Dual-Escrow
          </span>
        </div>

        {bookings.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-400">
            No active or completed bookings found for your profile.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {bookings.map((b) => {
              const grossAmount = b.total_price || b.total_amount || 0;
              const platformFee = grossAmount * PLATFORM_FEE_RATE;
              const netAmount = grossAmount - platformFee;

              return (
                <div key={b.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-paper-100/50 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-bold text-ink text-base">{b.event_name || 'Untitled Event'}</p>
                      {b.is_arrival_verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 font-bold uppercase tracking-wider rounded-xs">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> Arrived / Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-400">
                      Event Date: {b.event_date ? new Date(b.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </p>
                  </div>

                  <div className="w-full sm:w-auto text-left sm:text-right space-y-1 bg-paper-200/40 sm:bg-transparent p-3 sm:p-0 rounded border sm:border-0 border-line">
                    <div className="text-xs text-ink-500">
                      Gross Booking: <span className="font-semibold text-ink">{formatCurrency(grossAmount)}</span>
                    </div>
                    <div className="text-xs text-purple-900">
                      Platform Fee (33%): <span className="font-semibold">-{formatCurrency(platformFee)}</span>
                    </div>
                    <div className="text-sm font-display font-bold text-emerald-800 pt-1 border-t border-line/50">
                      Net Payout: {formatCurrency(netAmount)}
                    </div>
                    <div>
                      <span className="inline-block mt-1 text-[10px] px-2.5 py-0.5 rounded-xs uppercase font-bold tracking-wider bg-paper text-ink-600 border border-line">
                        {b.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
