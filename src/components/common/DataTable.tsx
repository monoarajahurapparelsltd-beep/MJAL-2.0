import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  keyExtractor: (item: T) => string;
  pageSize?: number;
  actions?: (item: T) => React.ReactNode;
  headerRightContent?: React.ReactNode;
  customFooter?: (filteredData: T[]) => React.ReactNode;
  footerRow?: (filteredData: T[]) => React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search records...',
  keyExtractor,
  pageSize = 10,
  actions,
  headerRightContent,
  customFooter,
  footerRow
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Filter data
  const filteredData = data.filter((item: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(item).some(val => {
      if (val === null || val === undefined) return false;
      if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(term);
      return String(val).toLowerCase().includes(term);
    });
  });

  // Sort data
  const sortedData = [...filteredData].sort((a: any, b: any) => {
    if (!sortColumn) return 0;
    const valA = a[sortColumn];
    const valB = b[sortColumn];
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (colKey?: keyof T) => {
    if (!colKey) return;
    if (sortColumn === colKey) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden transition-colors">
      {/* Table Top Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
        <div className="relative flex-1 max-w-xs sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-300/90 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8.5 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15 transition-all"
          />
        </div>
        {headerRightContent && <div className="flex items-center gap-2">{headerRightContent}</div>}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 text-[10px] font-extrabold uppercase tracking-wider">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => col.sortable && handleSort(col.accessorKey)}
                  className={`px-3 py-2.5 whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition-colors' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && <ArrowUpDown className="h-3 w-3 text-slate-400 dark:text-slate-500" />}
                  </div>
                </th>
              ))}
              {actions && <th className="px-3 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="py-10 text-center text-slate-400 dark:text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No matching records found</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Try adjusting your search terms or filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map(item => (
                <tr key={keyExtractor(item)} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors">
                  {columns.map((col, idx) => (
                    <td key={idx} className="px-3 py-2 whitespace-nowrap">
                      {col.cell ? col.cell(item) : col.accessorKey ? String((item as any)[col.accessorKey] ?? '-') : '-'}
                    </td>
                  ))}
                  {actions && <td className="px-3 py-2 whitespace-nowrap text-right">{actions(item)}</td>}
                </tr>
              ))
            )}
          </tbody>
          {footerRow ? (
            <tfoot className="sticky bottom-0 z-10 shadow-sm border-t border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              {footerRow(sortedData)}
            </tfoot>
          ) : customFooter ? (
            <tfoot className="sticky bottom-0 z-10 shadow-sm border-t border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              {customFooter(sortedData)}
            </tfoot>
          ) : null}
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-3.5 py-2 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
        <div>
          Showing {sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} records
        </div>
        <div className="flex items-center gap-1.5">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="rounded-md p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 font-semibold">
            Page <strong className="text-slate-900 dark:text-slate-100 font-bold">{currentPage}</strong> of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="rounded-md p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
