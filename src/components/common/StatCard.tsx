import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  variant?: 'blue' | 'emerald' | 'amber' | 'indigo' | 'slate' | 'rose' | 'purple' | 'cyan';
  color?: 'blue' | 'emerald' | 'amber' | 'indigo' | 'slate' | 'rose' | 'purple' | 'cyan';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendType = 'neutral',
  icon: Icon,
  variant,
  color
}) => {
  const activeVariant = variant || color || 'blue';
  const iconColorStyles: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: 'bg-blue-50/90 dark:bg-blue-950/60', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-1 ring-blue-500/20' },
    emerald: { bg: 'bg-emerald-50/90 dark:bg-emerald-950/60', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-1 ring-emerald-500/20' },
    amber: { bg: 'bg-amber-50/90 dark:bg-amber-950/60', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-1 ring-amber-500/20' },
    indigo: { bg: 'bg-indigo-50/90 dark:bg-indigo-950/60', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-1 ring-indigo-500/20' },
    slate: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', ring: 'ring-1 ring-slate-400/20' },
    rose: { bg: 'bg-rose-50/90 dark:bg-rose-950/60', text: 'text-rose-600 dark:text-rose-400', ring: 'ring-1 ring-rose-500/20' },
    purple: { bg: 'bg-purple-50/90 dark:bg-purple-950/60', text: 'text-purple-600 dark:text-purple-400', ring: 'ring-1 ring-purple-500/20' },
    cyan: { bg: 'bg-cyan-50/90 dark:bg-cyan-950/60', text: 'text-cyan-600 dark:text-cyan-400', ring: 'ring-1 ring-cyan-500/20' },
  };

  const style = iconColorStyles[activeVariant] || iconColorStyles.blue;

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 sm:p-3.5 shadow-2xs transition-all hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700 min-w-0 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-1 min-w-0">
        <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {title}
        </p>
        <div className={`flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-md sm:rounded-lg ${style.bg} ${style.text} ${style.ring} shrink-0`}>
          <Icon className="h-3 w-3 sm:h-4 sm:w-4" />
        </div>
      </div>

      <div className="mt-0.5 sm:mt-2 flex items-baseline justify-between gap-1 min-w-0 flex-wrap">
        <span className="text-sm sm:text-lg lg:text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 font-sans truncate">
          {value}
        </span>
        {trend && (
          <span
            className={`inline-flex items-center text-[7px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded shrink-0 ${
              trendType === 'positive'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-600/20'
                : trendType === 'negative'
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 ring-1 ring-rose-600/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-700'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-0.5 sm:mt-1 text-[8px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
};
