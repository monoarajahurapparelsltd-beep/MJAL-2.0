import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/90 dark:border-slate-800 transition-colors">
      <div>
        <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 font-sans">{title}</h1>
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
};
