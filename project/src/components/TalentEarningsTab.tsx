import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Wallet, Clock, CheckCircle2, ArrowUpRight, ShieldCheck, Sparkles, Loader2, Landmark } from 'lucide-react';
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

      const { data: artistProfile } = await supabase
        .from('artist_profiles')
        .select('id')
        .eq('user_id', authUserId)
        .maybeSingle();

      const targetArtistIds = Array.from(
        new Set([authUserId, artistProfile?.id].filter(Boolean))
      );

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
    } finally {
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

  const PLATFORM_FEE_RATE = 0.33;

  const grossEscrow = bookings
    .filter((b) => ['confirmed', 'accepted', 'checked_in'].includes(b.status) || b.deposit_paid)
    .reduce((sum, b) => sum + (b.total_price || b.total_amount || 0), 0);
  const netEscrow = grossEscrow * (1 - PLATFORM_FEE_RATE);

  const grossCompleted = bookings
    .filter((b) => b.status === 'completed' || b.balance_paid || !!b.completed_at)
    .reduce((sum, b) => sum + (b.total_price || b.total_amount || 0), 0);
  const netCompleted = grossCompleted * (1 - PLATFORM_FEE_RATE);

  const grossLifetime = bookings
    .filter((b) => ['confirmed', 'accepted', 'completed', 'fully_paid'].includes(b.status))
    .reduce((sum, b) => sum + (b.total_price || b.total_amount || 0), 0);
  const netLifetime = grossLifetime * (1 - PLATFORM_FEE_RATE);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Vibe Banner: Commission Policy */}
      <div className="bg-gradient-to-r from-emerald-950 via-zinc-900 to-black text-paper rounded-2xl p-6 shadow-md border border-emerald-900/40 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-display font-bold text-lg text-white">Secure Escrow & Transparent Payouts</h4>
            <p className="text-xs text-zinc-400 mt-0.5">33% standard platform fee applies to support 24/7 dual-escrow safety and instant bookings.</p>
          </div>
        </div>
        <div className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-full relative z-10">
          Transparent 33% Rate
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Lifetime Earnings Card */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-line hover:border-emerald-500/50 transition-all group">
          <div className="flex items-center justify-between text-ink-400 mb-3">
            <span className="text-xs uppercase tracking-wide-sm font-bold text-zinc-500">Total Lifetime Net</span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-4xl font-display font-bold text-ink tracking-tight">{formatCurrency(netLifetime)}</p>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-3">
            <ArrowUpRight className="w-4 h-4" /> Clean cash after 33% platform split
          </div>
        </div>

        {/* Escrow Card */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-line hover:border-amber-500/50 transition-all group">
          <div className="flex items-center justify-between text-ink-400 mb-3">
            <span className="text-xs uppercase tracking-wide-sm font-bold text-zinc-500">Locked in Escrow</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-4xl font-display font-bold text-ink tracking-tight">{formatCurrency(netEscrow)}</p>
          <p className="text-xs text-zinc-500 mt-3">Released automatically upon event sign-off</p>
        </div>

        {/* Available Payout Card (Vibey & Bold) */}
        <div className="bg-gradient-to-br from-ink to-zinc-900 text-paper rounded-2xl p-6 shadow-lg border border-ink relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-3 relative z-10">
              <span className="text-xs uppercase tracking-wide-sm font-bold text-emerald-400">Ready to Withdraw</span>
              <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-4xl font-display font-bold text-white tracking-tight relative z-10">{formatCurrency(netCompleted)}</p>
          </div>
          <button 
            onClick={() => alert('Payout request initiated! Funds will reflect in your bank account within 1-3 business days.')}
            className="mt-5 w-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs uppercase font-bold tracking-wider py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer relative z-10"
          >
            <Landmark className="w-4 h-4" /> Request Payout to Bank
          </button>
        </div>

      </div>

      {/* Booking Breakdown Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-line overflow-hidden">
        <div className="px-6 py-5 border-b border-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-paper-100/30">
          <h3 className="font-display font-bold text-ink text-lg">Gig Earnings & Breakdown</h3>
          <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full font-bold uppercase tracking-wider inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> HostMeUp Dual-Escrow Protected
          </span>
        </div>

        {bookings.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Wallet className="w-10 h-10 text-zinc-300 mx-auto animate-pulse" />
            <p className="text-sm font-medium text-ink">No bookings or payouts yet</p>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">When hosts book your talent services and deposits clear, your earnings and 33% breakdowns will appear right here.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {bookings.map((b) => {
              const grossAmount = b.total_price || b.total_amount || 0;
              const platformFee = grossAmount * PLATFORM_FEE_RATE;
              const netAmount = grossAmount - platformFee;

              return (
                <div key={b.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-paper-100/40 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-bold text-ink text-base">{b.event_name || 'Untitled Event'}</p>
                      {b.is_arrival_verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 font-bold uppercase tracking-wider rounded-md">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified Arrival
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Event Date: {b.event_date ? new Date(b.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </p>
                  </div>

                  <div className="w-full sm:w-auto text-left sm:text-right space-y-1.5 bg-paper-200/50 sm:bg-transparent p-4 sm:p-0 rounded-xl border sm:border-0 border-line">
                    <div className="text-xs text-zinc-500">
                      Gross Total: <span className="font-semibold text-ink">{formatCurrency(grossAmount)}</span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      Platform Split (33%): <span className="font-semibold text-zinc-700">-{formatCurrency(platformFee)}</span>
                    </div>
                    <div className="text-base font-display font-bold text-emerald-700 pt-1 border-t border-line/60">
                      Your Net: {formatCurrency(netAmount)}
                    </div>
                    <div>
                      <span className="inline-block mt-1 text-[10px] px-2.5 py-0.5 rounded-md uppercase font-bold tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
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
