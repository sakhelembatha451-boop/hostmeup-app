import React, { useState } from 'react';
import { Wallet, Clock, CheckCircle2, ArrowUpRight, ShieldCheck, Percent } from 'lucide-react';

interface EarningsSummary {
  totalEarned: number;
  escrowHeld: number;
  availableBalance: number;
  platformFeePercentage: number;
  recentTransactions: Array<{
    id: string;
    eventTitle: string;
    date: string;
    grossAmount: number;
    status: 'escrow_held' | 'completed' | 'processing';
    gpsVerified: boolean;
  }>;
}

export const TalentEarningsTab: React.FC = () => {
  const [stats] = useState<EarningsSummary>({
    totalEarned: 4500,
    escrowHeld: 1200,
    availableBalance: 3300,
    platformFeePercentage: 33,
    recentTransactions: [
      {
        id: '1',
        eventTitle: "Zandile's Birthday Celebration",
        date: '2026-10-28',
        grossAmount: 1500, // 33% platform fee = R495, Net = R1005
        status: 'escrow_held',
        gpsVerified: true,
      },
      {
        id: '2',
        eventTitle: 'Capetonian Rooftop Set',
        date: '2026-10-15',
        grossAmount: 5223.88, // 33% fee = ~R1,723.88, Net = R3,500
        status: 'completed',
        gpsVerified: true,
      },
    ],
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Platform Fee Notice Banner */}
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
        {/* Total Lifetime Net Earnings */}
        <div className="bg-white rounded-xl p-6 shadow-xs border border-line">
          <div className="flex items-center justify-between text-ink-400 mb-2">
            <span className="text-xs uppercase tracking-wide-sm font-semibold">Total Lifetime Net Earned</span>
            <Wallet className="w-5 h-5 text-emerald-800" />
          </div>
          <p className="text-3xl font-display font-bold text-ink">R {stats.totalEarned.toLocaleString()}</p>
          <span className="text-xs text-emerald-800 font-medium flex items-center gap-1 mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" /> After 33% platform fee deduction
          </span>
        </div>

        {/* Escrow Holds (Locked until Check-in) */}
        <div className="bg-white rounded-xl p-6 shadow-xs border border-line">
          <div className="flex items-center justify-between text-ink-400 mb-2">
            <span className="text-xs uppercase tracking-wide-sm font-semibold">In Escrow (Net Payout)</span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-3xl font-display font-bold text-ink">R {stats.escrowHeld.toLocaleString()}</p>
          <p className="text-xs text-ink-400 mt-2">Released 24h after GPS arrival verification</p>
        </div>

        {/* Available Payout Balance */}
        <div className="bg-white rounded-xl p-6 shadow-xs border border-line">
          <div className="flex items-center justify-between text-ink-400 mb-2">
            <span className="text-xs uppercase tracking-wide-sm font-semibold">Available for Payout</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-800" />
          </div>
          <p className="text-3xl font-display font-bold text-ink">R {stats.availableBalance.toLocaleString()}</p>
          <button className="mt-3 w-full bg-ink text-paper text-xs uppercase font-semibold tracking-wide-sm py-2.5 rounded hover:bg-ink-800 transition">
            Request Payout to Bank
          </button>
        </div>
      </div>

      {/* Recent Payout Activity Table */}
      <div className="bg-white rounded-xl shadow-xs border border-line overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="font-display font-bold text-ink text-base">Gig Earnings & 33% Commission Breakdown</h3>
          <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-sm font-bold uppercase tracking-wide-sm">
            Protected by HostMeUp Dual-Escrow
          </span>
        </div>

        <div className="divide-y divide-line">
          {stats.recentTransactions.map((tx) => {
            const platformFee = Math.round(tx.grossAmount * 0.33 * 100) / 100;
            const netAmount = Math.round((tx.grossAmount - platformFee) * 100) / 100;

            return (
              <div key={tx.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-paper-100/50 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-ink text-base">{tx.eventTitle}</p>
                    {tx.gpsVerified && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 font-bold uppercase tracking-wider rounded-xs">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" /> 75km GPS Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-400">Event Date: {tx.date}</p>
                </div>

                <div className="w-full sm:w-auto text-left sm:text-right space-y-1 bg-paper-200/40 sm:bg-transparent p-3 sm:p-0 rounded border sm:border-0 border-line">
                  <div className="text-xs text-ink-500">
                    Gross Booking: <span className="font-semibold text-ink">R {tx.grossAmount.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-purple-900">
                    Platform Fee (33%): <span className="font-semibold">-R {platformFee.toLocaleString()}</span>
                  </div>
                  <div className="text-sm font-display font-bold text-emerald-800 pt-1 border-t border-line/50">
                    Net Payout: R {netAmount.toLocaleString()}
                  </div>
                  <div>
                    <span
                      className={`inline-block mt-1 text-[10px] px-2.5 py-0.5 rounded-xs uppercase font-bold tracking-wider ${
                        tx.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : tx.status === 'escrow_held'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-paper text-ink-600 border border-line'
                      }`}
                    >
                      {tx.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
