import React, { useState, useEffect } from 'react';
import { Wallet, Clock, CheckCircle2, AlertCircle, ArrowUpRight, ShieldCheck } from 'lucide-react';

interface EarningsSummary {
  totalEarned: number;
  escrowHeld: number;
  availableBalance: number;
  recentTransactions: Array<{
    id: string;
    eventTitle: string;
    date: string;
    amount: number;
    status: 'escrow_held' | 'completed' | 'processing';
    gpsVerified: boolean;
  }>;
}

export const TalentEarningsTab: React.FC = () => {
  const [stats, setStats] = useState<EarningsSummary>({
    totalEarned: 4500,
    escrowHeld: 1200,
    availableBalance: 3300,
    recentTransactions: [
      {
        id: '1',
        eventTitle: "Zandile's Birthday Celebration",
        date: '2026-10-28',
        amount: 1000,
        status: 'escrow_held',
        gpsVerified: true,
      },
      {
        id: '2',
        eventTitle: 'Capetonian Rooftop Set',
        date: '2026-10-15',
        amount: 3500,
        status: 'completed',
        gpsVerified: true,
      },
    ],
  });

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Lifetime Earnings */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Total Lifetime Earned</span>
            <Wallet className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900">R {stats.totalEarned.toLocaleString()}</p>
          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" /> +15% from last month
          </span>
        </div>

        {/* Escrow Holds (Locked until Check-in) */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">In Escrow (Pending Gig)</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-slate-900">R {stats.escrowHeld.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">Released 24h after GPS arrival verification</p>
        </div>

        {/* Available Payout Balance */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Available for Payout</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-slate-900">R {stats.availableBalance.toLocaleString()}</p>
          <button className="mt-3 w-full bg-slate-900 text-white text-xs font-semibold py-2 rounded-lg hover:bg-slate-800 transition">
            Request Payout to Bank
          </button>
        </div>
      </div>

      {/* Recent Payout Activity Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">Gig Earnings & Payout Breakdown</h3>
          <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
            Protected by HostMeUp Dual-Escrow
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {stats.recentTransactions.map((tx) => (
            <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{tx.eventTitle}</p>
                  {tx.gpsVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">
                      <ShieldCheck className="w-3 h-3" /> 75km GPS Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Event Date: {tx.date}</p>
              </div>

              <div className="text-right">
                <p className="font-semibold text-slate-900">R {tx.amount}</p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                    tx.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : tx.status === 'escrow_held'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {tx.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
