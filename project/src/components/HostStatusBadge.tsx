// src/components/HostStatusBadge.tsx
import React from 'react';
import { ShieldCheck, Clock, Shield } from 'lucide-react';

interface HostStatusBadgeProps {
  isVerified?: boolean;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | null;
}

export default function HostStatusBadge({ isVerified, verificationStatus }: HostStatusBadgeProps) {
  if (isVerified || verificationStatus === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide-sm font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 border border-emerald-200">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        Verified Host
      </span>
    );
  }

  if (verificationStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide-sm font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 border border-amber-200">
        <Clock className="w-3.5 h-3.5 text-amber-600" />
        Verification Pending
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide-sm font-semibold text-ink-500 bg-paper-200 px-2.5 py-1 border border-line">
      <Shield className="w-3.5 h-3.5 text-ink-400" />
      Unverified Host
    </span>
  );
}
