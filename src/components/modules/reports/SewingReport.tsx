import React, { useState } from 'react';
import {
  Shirt,
  Search,
  ArrowUpDown,
  TrendingUp,
  Percent,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { filterSewingByScope } from '../../../utils/authUtils';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const SewingReport: React.FC = () => {
  const { currentUser } = useAuth();
  const rawSewing = supabaseDataService.getSewingProduction();
  const sewing = filterSewingByScope(rawSewing, currentUser);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('All');
  const [selectedLine, setSelectedLine] = useState('All');
  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Distinct filter options
  const buyers = Array.from(new Set(sewing.map(s => s.buyer).filter(Boolean)));
  const lines = Array.from(new Set(sewing.map(s => s.lineNo).filter(Boolean)));

  // Filter items
  const filtered = sewing.filter(item => {
    const q = (searchQuery || '').trim().toLowerCase();
    const matchSearch =
      !q ||
      (item.styleNo || '').toLowerCase().includes(q) ||
      (item.poNo || '').toLowerCase().includes(q) ||
      (item.lineNo || '').toLowerCase().includes(q) ||
      (item.colour || '').toLowerCase().includes(q);

    const matchBuyer = selectedBuyer === 'All' || item.buyer === selectedBuyer;
    const matchLine = selectedLine === 'All' || item.lineNo === selectedLine;

    return matchSearch && matchBuyer && matchLine;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let valA = (a as any)[sortField] ?? '';
    let valB = (b as any)[sortField] ?? '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // KPIs
  const totalInput = sorted.reduce((s, x) => s + (x.inputQty || 0), 0);
  const totalTarget = sorted.reduce((s, x) => s + (x.dailyTarget || 0), 0);
  const totalOutput = sorted.reduce((s, x) => s + (x.totalOutput || 0), 0);
  const totalAlter = sorted.reduce((s, x) => s + (x.alterQty || 0), 0);
  const totalReject = sorted.reduce((s, x) => s + (x.rejectQty || 0), 0);
  const totalWip = sorted.reduce((s, x) => s + (x.wipQty || 0), 0);
  const overallEfficiency = totalTarget > 0 ? Math.round((totalOutput / totalTarget) * 100) : 0;

  // Exportable format
  const exportData = sorted.map(item => ({
    Date: item.date,
    Line: item.lineNo,
    Buyer: item.buyer,
    StyleNo: item.styleNo,
    PONo: item.poNo,
    Colour: item.colour,
    Size: item.size || 'ALL',
    InputQty: item.inputQty || 0,
    DailyTarget: item.dailyTarget || 0,
    TotalOutput: item.totalOutput || 0,
    Efficiency: item.dailyTarget ? `${Math.round(((item.totalOutput || 0) / item.dailyTarget) * 100)}%` : '0%',
    AlterQty: item.alterQty || 0,
    RejectQty: item.rejectQty || 0,
    WIP: item.wipQty || 0,
    Supervisor: item.lineSupervisor || item.submittedBy || 'Line In-charge'
  }));

  return (
    <div className="space-y-6">
      {/* Print Header */}
      <ReportPrintHeader
        title="SEWING FLOOR PRODUCTION & LINE EFFICIENCY REPORT"
        subtitle="Daily Line-Wise Hourly Output, Production Efficiency & Quality Defect Breakdown"
        department="Sewing Division"
        filtersSummary={[
          `Buyer: ${selectedBuyer}`,
          `Line: ${selectedLine}`,
          searchQuery ? `Search: "${searchQuery}"` : ''
        ].filter(Boolean)}
      />

      {/* Control Filter Bar & Export Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Style, PO, Line, Colour..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600 w-56"
            />
          </div>

          <select
            value={selectedBuyer}
            onChange={e => setSelectedBuyer(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-600"
          >
            <option value="All">All Buyers ({buyers.length})</option>
            {buyers.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={selectedLine}
            onChange={e => setSelectedLine(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-blue-600"
          >
            <option value="All">All Lines ({lines.length})</option>
            {lines.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {(selectedBuyer !== 'All' || selectedLine !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedBuyer('All');
                setSelectedLine('All');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        <ExportPrintToolbar
          title="Sewing_Floor_Report"
          filename="MJAL_Sewing_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Input</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{(totalInput || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Planned Target</p>
          <h3 className="text-base font-black text-blue-900 mt-1">{(totalTarget || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Actual Output</p>
          <h3 className="text-base font-black text-indigo-900 mt-1">{(totalOutput || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Overall Efficiency</p>
          <h3 className="text-base font-black text-emerald-900 mt-1">{overallEfficiency}%</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Total Alter / Re-stitch</p>
          <h3 className="text-base font-black text-amber-900 mt-1">{(totalAlter || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Floor WIP</p>
          <h3 className="text-base font-black text-purple-900 mt-1">{(totalWip || 0).toLocaleString()} pcs</h3>
        </div>
      </div>

      {/* Sewing Records Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Sewing Lines Production Statements ({sorted.length} Entries)
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            Click column headers to sort
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th onClick={() => handleSort('date')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('lineNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Line <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('buyer')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Buyer <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('styleNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Style No <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">PO No</th>
                <th className="p-3">Colour / Size</th>
                <th onClick={() => handleSort('inputQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Input <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('dailyTarget')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Target <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('totalOutput')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Output <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-center">Efficiency</th>
                <th className="p-3 text-right">Alter</th>
                <th className="p-3 text-right">Reject</th>
                <th className="p-3 text-right">WIP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400 font-medium">
                    No matching sewing production records found.
                  </td>
                </tr>
              ) : (
                sorted.map(item => {
                  const eff = item.dailyTarget ? Math.round(((item.totalOutput || 0) / item.dailyTarget) * 100) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-700 whitespace-nowrap">{item.date}</td>
                      <td className="p-3 font-black text-indigo-700 whitespace-nowrap">{item.lineNo}</td>
                      <td className="p-3 font-bold text-slate-900">{item.buyer}</td>
                      <td className="p-3 font-bold text-blue-700">{item.styleNo}</td>
                      <td className="p-3 font-mono text-slate-700">{item.poNo}</td>
                      <td className="p-3 text-slate-700">
                        {item.colour} {item.size ? `(${item.size})` : ''}
                      </td>
                      <td className="p-3 text-right font-medium text-slate-700">{(item.inputQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold text-slate-700">{(item.dailyTarget || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-black text-indigo-900">{(item.totalOutput || 0).toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${eff >= 90 ? 'bg-emerald-100 text-emerald-800' : eff >= 75 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                          {eff}%
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-amber-700">{(item.alterQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-rose-600">{(item.rejectQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-purple-700">{(item.wipQty || 0).toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
                <tr>
                  <td colSpan={6} className="p-3 uppercase text-slate-700">Total Summary:</td>
                  <td className="p-3 text-right">{(totalInput || 0).toLocaleString()}</td>
                  <td className="p-3 text-right">{(totalTarget || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-indigo-900">{(totalOutput || 0).toLocaleString()}</td>
                  <td className="p-3 text-center text-emerald-800">{overallEfficiency}%</td>
                  <td className="p-3 text-right text-amber-700">{(totalAlter || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-rose-700">{(totalReject || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-purple-900">{(totalWip || 0).toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Print Footer */}
      <ReportPrintFooter />
    </div>
  );
};
