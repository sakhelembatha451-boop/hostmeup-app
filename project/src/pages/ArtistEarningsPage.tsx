import { TalentEarningsTab } from '@/components/TalentEarningsTab';
import { Wallet } from 'lucide-react';

export default function ArtistEarningsPage() {
  return (
    <div className="min-h-screen bg-paper py-10">
      <div className="max-w-6xl mx-auto px-6 lg:px-12 mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="w-8 h-8 text-emerald-700" />
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">Earnings & Payouts</h1>
            <p className="text-xs text-ink-400">Monitor your cleared payouts, active escrow funds, and bank setup.</p>
          </div>
        </div>
      </div>
      <TalentEarningsTab />
    </div>
  );
}
