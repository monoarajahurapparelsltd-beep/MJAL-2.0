import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getBadgeStyle = (val: string) => {
    const s = val.toLowerCase();
    if (['confirmed', 'active', 'approved', 'pass', 'completed', 'shipment complete', 'full received', 'paid', 'shipped'].some(k => s.includes(k))) {
      return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-500/30';
    }
    if (['running', 'in progress', 'sent', 'washing', 'partial', 'day', 'present', 'dispatched'].some(k => s.includes(k))) {
      return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-600/20 dark:ring-blue-500/30';
    }
    if (['pending', 'draft', 'revision required', 'hold', 'pending rework', 'ready', 'in transit'].some(k => s.includes(k))) {
      return 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 ring-1 ring-inset ring-amber-600/20 dark:ring-amber-500/30';
    }
    if (['cancelled', 'rejected', 'fail', 'inactive', 'delayed', 'absent'].some(k => s.includes(k))) {
      return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-600/20 dark:ring-rose-500/30';
    }
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-1 ring-inset ring-slate-400/20 dark:ring-slate-700';
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-tight ${getBadgeStyle(status)}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 shrink-0" />
      <span className="whitespace-nowrap">{status}</span>
    </span>
  );
};
