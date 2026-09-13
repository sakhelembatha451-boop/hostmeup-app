import { Link } from 'react-router-dom';
import type { BookingStatus } from '@/types';

export function StatusBadge({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-accent-50 text-accent-600 border-accent-200',
    accepted: 'bg-accent-50 text-accent-600 border-accent-200',
    declined: 'bg-red-50 text-red-600 border-red-200',
    cancelled: 'bg-paper-300 text-ink-400 border-line',
  };
  const labels: Record<BookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Deposit Paid',
    accepted: 'Accepted',
    declined: 'Declined',
    cancelled: 'Cancelled',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium uppercase tracking-wide-sm border rounded-none ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function Tag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-ink-500 border border-line rounded-none">
      {label}
    </span>
  );
}

export function EmptyState({
  icon, title, message, actionLabel, actionTo,
}: {
  icon: React.ReactNode; title: string; message: string; actionLabel?: string; actionTo?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="w-16 h-16 rounded-none border border-line flex items-center justify-center text-ink-300 mb-6">
        {icon}
      </div>
      <h3 className="font-display text-xl text-ink mb-2">{title}</h3>
      <p className="text-sm text-ink-400 max-w-sm mb-6">{message}</p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn-primary px-6 py-3 text-xs uppercase tracking-wide-sm">{actionLabel}</Link>
      )}
    </div>
  );
}
