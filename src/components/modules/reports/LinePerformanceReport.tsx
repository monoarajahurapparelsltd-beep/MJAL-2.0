import React, { useState } from 'react';
import {
  Activity,
  Target,
  TrendingUp,
  Percent,
  Search,
  ArrowUpDown,
  Filter,
  Users,
  Award
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const LinePerformanceReport: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState('');
  const [sortField, setSortField] = useState<string>('efficiency');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const sewingList = supabaseDataService.getSewingProduction();

  // Aggregate by Line
  const linesMap = new Map<string, {
    lineNo: string;
    supervisor: string;
    totalTarget: number;
    totalOutput: number;
    totalOperators: number;
    entriesCount: number;
    styles: Set<string>;
  }>();

  sewingList.forEach(s => {
    if (selectedDate && s.date !== selectedDate) return;
    const l = s.lineNo || 'Unassigned';
    const curr = linesMap.get(l) || {
      lineNo: l,
      supervisor: s.submittedBy || 'Line In-charge',
      totalTarget: 0,
      totalOutput: 0,
      totalOperators: 0,
      entriesCount: 0,
      styles: new Set<string>()
    };

    curr.totalTarget += s.dailyTarget || 0;
    curr.totalOutput += s.totalOutput || 0;
    curr.entriesCount += 1;
    if (s.styleNo) curr.styles.add(s.styleNo);

    linesMap.set(l, curr);
  });

  const lineReports = Array.from(linesMap.values()).map(l => {
    const eff = l.totalTarget > 0 ? Math.round((l.totalOutput / l.totalTarget) * 100) : 0;
    const variance = l.totalOutput - l.totalTarget;

    return {
      lineNo: l.lineNo,
      supervisor: l.supervisor,
      totalTarget: l.totalTarget,
      totalOutput: l.totalOutput,
      entriesCount: l.entriesCount,
      stylesList: Array.from(l.styles).join(', ') || 'Various',
      efficiency: eff,
      variance,
      status: eff >= 95 ? 'Top Performer' : eff >= 80 ? 'On Track' : 'Needs Support'
    };
  });

  const sorted = [...lineReports].sort((a, b) => {
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
  const totalTarget = lineReports.reduce((s, l) => s + l.totalTarget, 0);
  const totalOutput = lineReports.reduce((s, l) => s + l.totalOutput, 0);
  const avgEfficiency = totalTarget > 0 ? Math.round((totalOutput / totalTarget) * 100) : 0;
  const topLine = [...lineReports].sort((a, b) => b.efficiency - a.efficiency)[0];

  const exportData = sorted.map(item => ({
    LineNo: item.lineNo,
    Supervisor: item.supervisor,
    RunningStyles: item.stylesList,
    TotalTarget: item.totalTarget,
    TotalOutput: item.totalOutput,
    Efficiency: `${item.efficiency}%`,
    VariancePcs: item.variance,
    Status: item.status
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="SEWING LINE PERFORMANCE & EFFICIENCY BENCHMARK REPORT"
        subtitle="Individual Line Output, Hourly Run-Rate, Efficiency Index & Target Achievement Variance"
        department="Industrial Engineering & Sewing Operations"
        filtersSummary={[
          selectedDate ? `Date: ${selectedDate}` : 'All Recorded Dates',
          `Total Lines Analyzed: ${lineReports.length}`
        ]}
      />

      {/* Control Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5">
            <span className="text-xs font-bold text-slate-600">Filter Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          {selectedDate && (
            <button
              onClick={() => setSelectedDate('')}
              className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
            >
              Clear Date Filter
            </button>
          )}
        </div>

        <ExportPrintToolbar
          title="Line_Performance_Report"
          filename="MJAL_Line_Performance_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Sewing Lines</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{lineReports.length} Active Lines</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Combined Target</p>
          <h3 className="text-base font-black text-blue-900 mt-1">{(totalTarget || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Actual Output</p>
          <h3 className="text-base font-black text-emerald-900 mt-1">{(totalOutput || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Overall Efficiency</p>
          <h3 className="text-base font-black text-purple-900 mt-1">{avgEfficiency}%</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Line Performance & Efficiency Ranking ({sorted.length} Lines)
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            Click column headers to sort
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th onClick={() => handleSort('lineNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Line No <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('supervisor')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Line Supervisor <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">Styles Running</th>
                <th onClick={() => handleSort('totalTarget')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Target Qty <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('totalOutput')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Actual Output <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('variance')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Variance <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('efficiency')} className="p-3 text-center cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-center gap-1">Efficiency % <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-center">Performance Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    No sewing line records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                sorted.map(item => (
                  <tr key={item.lineNo} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono font-bold text-blue-700">{item.lineNo}</td>
                    <td className="p-3 font-semibold text-slate-800">{item.supervisor}</td>
                    <td className="p-3 text-slate-600 max-w-[200px] truncate">{item.stylesList}</td>
                    <td className="p-3 text-right font-semibold text-slate-700">{(item.totalTarget || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-black text-slate-900">{(item.totalOutput || 0).toLocaleString()}</td>
                    <td className={`p-3 text-right font-bold ${item.variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {item.variance >= 0 ? `+${item.variance.toLocaleString()}` : item.variance.toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${item.efficiency >= 95 ? 'bg-emerald-100 text-emerald-800' : item.efficiency >= 80 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
                        {item.efficiency}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Top Performer' ? 'bg-emerald-100 text-emerald-800' : item.status === 'On Track' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
                <tr>
                  <td colSpan={3} className="p-3 uppercase text-slate-700">Factory Aggregate:</td>
                  <td className="p-3 text-right">{(totalTarget || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-emerald-900">{(totalOutput || 0).toLocaleString()}</td>
                  <td className={`p-3 text-right ${totalOutput - totalTarget >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                    {totalOutput - totalTarget >= 0 ? `+${(totalOutput - totalTarget).toLocaleString()}` : (totalOutput - totalTarget).toLocaleString()}
                  </td>
                  <td className="p-3 text-center text-purple-900">{avgEfficiency}%</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <ReportPrintFooter />
    </div>
  );
};
