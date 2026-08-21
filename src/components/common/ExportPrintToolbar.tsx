import React, { useState } from 'react';
import { Printer, FileText, FileSpreadsheet, Check } from 'lucide-react';

interface ExportPrintToolbarProps {
  title: string;
  data: any[];
  filename?: string;
  activeFilters?: Record<string, string>;
}

export const ExportPrintToolbar: React.FC<ExportPrintToolbarProps> = ({
  data,
  filename = 'report'
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleExportCSV = () => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(item =>
      Object.values(item)
        .map(val => `"${String(val ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess('CSV');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleExportExcel = () => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join('\t');
    const rows = data.map(item =>
      Object.values(item)
        .map(val => String(val ?? '').replace(/\t/g, ' '))
        .join('\t')
    );
    const excelContent = 'data:application/vnd.ms-excel;charset=utf-8,' + encodeURIComponent([headers, ...rows].join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', excelContent);
    link.setAttribute('download', `${filename}_${new Date().toISOString().substring(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess('Excel');
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {downloadSuccess && (
        <span className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded animate-fade-in">
          <Check className="h-3 w-3" /> {downloadSuccess} Exported!
        </span>
      )}
      <button
        onClick={handleExportCSV}
        title="Export CSV"
        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <FileText className="h-3 w-3 text-slate-500 dark:text-slate-400" />
        CSV
      </button>
      <button
        onClick={handleExportExcel}
        title="Export Excel"
        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
      >
        <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        Excel
      </button>
      <button
        onClick={handlePrint}
        title="Print Report"
        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <Printer className="h-3 w-3 text-slate-500 dark:text-slate-400" />
        Print
      </button>
    </div>
  );
};
