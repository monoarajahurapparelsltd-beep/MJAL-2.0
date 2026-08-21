import React, { useState } from 'react';
import {
  ClipboardCheck,
  Search,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Percent
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const QCReport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedResult, setSelectedResult] = useState('All');
  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const qcList = supabaseDataService.getQCInspections();

  const inspectionTypes = Array.from(new Set(qcList.map(q => q.inspectionType).filter(Boolean)));
  const results = Array.from(new Set(qcList.map(q => q.result).filter(Boolean)));

  const filtered = qcList.filter(item => {
    const q = (searchQuery || '').trim().toLowerCase();
    const matchSearch =
      !q ||
      (item.styleNo || '').toLowerCase().includes(q) ||
      (item.poNo || '').toLowerCase().includes(q) ||
      (item.lineNo || '').toLowerCase().includes(q) ||
      (item.inspectorName || '').toLowerCase().includes(q);

    const matchType = selectedType === 'All' || item.inspectionType === selectedType;
    const matchResult = selectedResult === 'All' || item.result === selectedResult;

    return matchSearch && matchType && matchResult;
  });

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
  const totalInspected = sorted.reduce((s, q) => s + (q.inspectedQty || 0), 0);
  const totalPassed = sorted.reduce((s, q) => s + (q.passedQty || 0), 0);
  const totalRework = sorted.reduce((s, q) => s + (q.reworkQty || 0), 0);
  const totalReject = sorted.reduce((s, q) => s + (q.rejectQty || 0), 0);
  const avgDHU = sorted.length > 0
    ? (sorted.reduce((s, q) => s + (q.dhu || 0), 0) / sorted.length).toFixed(2)
    : '0.00';
  const passRate = totalInspected > 0 ? Math.round((totalPassed / totalInspected) * 100) : 0;

  const exportData = sorted.map(item => ({
    Date: item.date,
    InspectionType: item.inspectionType,
    LineNo: item.lineNo,
    StyleNo: item.styleNo,
    PONo: item.poNo,
    Colour: item.colour,
    InspectedQty: item.inspectedQty || 0,
    PassedQty: item.passedQty || 0,
    ReworkQty: item.reworkQty || 0,
    RejectQty: item.rejectQty || 0,
    DHUPct: `${item.dhu || 0}%`,
    Inspector: item.inspectorName,
    Result: item.result
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="QUALITY ASSURANCE & DEFECT (DHU) AUDIT REPORT"
        subtitle="End-to-End Quality Inspection Log, Defect Classification, AQL Standard Audit & Re-check Status"
        department="Quality Assurance (QA/QC)"
        filtersSummary={[
          `Type: ${selectedType}`,
          `Result: ${selectedResult}`,
          searchQuery ? `Search: "${searchQuery}"` : ''
        ].filter(Boolean)}
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Style, PO, Line, Inspector..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600 w-56"
            />
          </div>

          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Inspection Types ({inspectionTypes.length})</option>
            {inspectionTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={selectedResult}
            onChange={e => setSelectedResult(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Results</option>
            {results.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {(selectedType !== 'All' || selectedResult !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedType('All');
                setSelectedResult('All');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        <ExportPrintToolbar
          title="QC_DHU_Report"
          filename="MJAL_QC_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Inspected</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{(totalInspected || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Passed First Time</p>
          <h3 className="text-base font-black text-emerald-900 mt-1">{(totalPassed || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Rework Identified</p>
          <h3 className="text-base font-black text-amber-900 mt-1">{(totalRework || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Critical Rejects</p>
          <h3 className="text-base font-black text-rose-600 mt-1">{(totalReject || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Average DHU %</p>
          <h3 className="text-base font-black text-blue-900 mt-1">{avgDHU}%</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Overall Pass Rate</p>
          <h3 className="text-base font-black text-purple-900 mt-1">{passRate}%</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            QC Audit Log & Defect Summaries ({sorted.length} Inspections)
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
                <th className="p-3">Type</th>
                <th onClick={() => handleSort('lineNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Line <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('styleNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Style No <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">PO / Colour</th>
                <th onClick={() => handleSort('inspectedQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Inspected <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('passedQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Passed <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-right">Rework</th>
                <th className="p-3 text-right">Reject</th>
                <th onClick={() => handleSort('dhu')} className="p-3 text-center cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-center gap-1">DHU % <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">Inspector</th>
                <th className="p-3 text-center">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400 font-medium">
                    No matching QC inspection records found.
                  </td>
                </tr>
              ) : (
                sorted.map(item => {
                  const isPass = item.result === 'Pass';
                  const isFail = item.result === 'Fail';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-700 whitespace-nowrap">{item.date}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-bold">
                          {item.inspectionType}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{item.lineNo}</td>
                      <td className="p-3 font-bold text-blue-700">{item.styleNo}</td>
                      <td className="p-3 text-slate-700">
                        {item.poNo} - {item.colour}
                      </td>
                      <td className="p-3 text-right font-medium text-slate-700">{(item.inspectedQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-black text-emerald-800">{(item.passedQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-amber-700">{(item.reworkQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-rose-600">{(item.rejectQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-center font-extrabold text-amber-800">{(item.dhu || 0).toFixed(1)}%</td>
                      <td className="p-3 font-semibold text-slate-800">{item.inspectorName}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isPass ? 'bg-emerald-100 text-emerald-800' : isFail ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                          {item.result}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
                <tr>
                  <td colSpan={5} className="p-3 uppercase text-slate-700">Total Inspected / Passed:</td>
                  <td className="p-3 text-right">{(totalInspected || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-emerald-900">{(totalPassed || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-amber-700">{(totalRework || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-rose-700">{(totalReject || 0).toLocaleString()}</td>
                  <td className="p-3 text-center text-amber-800">{avgDHU}%</td>
                  <td colSpan={2}></td>
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
