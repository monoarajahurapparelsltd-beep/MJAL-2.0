import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  Search,
  ArrowUpDown,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const FinishingReport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('All');
  const [selectedDate, setSelectedDate] = useState('');
  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const finishingList = supabaseDataService.getFinishingRecords();
  const orders = supabaseDataService.getOrders();
  const buyers = Array.from(new Set(orders.map(o => o.buyer).filter(Boolean)));

  const filtered = finishingList.filter(f => {
    const q = (searchQuery || '').trim().toLowerCase();
    const matchSearch =
      !q ||
      (f.styleNo || '').toLowerCase().includes(q) ||
      (f.poNo || '').toLowerCase().includes(q) ||
      (f.colour || '').toLowerCase().includes(q);

    let matchBuyer = true;
    if (selectedBuyer !== 'All') {
      const ord = orders.find(o => o.styleNo === f.styleNo);
      matchBuyer = ord?.buyer === selectedBuyer;
    }
    const matchDate = !selectedDate || f.date === selectedDate;

    return matchSearch && matchBuyer && matchDate;
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
  const totalReceived = sorted.reduce((s, f) => s + (f.sewingReceiveQty || f.finishingInputQty || 0), 0);
  const totalIroned = sorted.reduce((s, f) => s + (f.ironedQty || 0), 0);
  const totalPolyPacked = sorted.reduce((s, f) => s + (f.packedQty || 0), 0);
  const totalFinished = sorted.reduce((s, f) => s + (f.finishedQty || 0), 0);
  const totalWIP = Math.max(0, totalReceived - totalFinished);

  const exportData = sorted.map(f => ({
    Date: f.date,
    StyleNo: f.styleNo,
    PONo: f.poNo,
    Colour: f.colour,
    QtyReceived: f.sewingReceiveQty || f.finishingInputQty || 0,
    IronedQty: f.ironedQty || 0,
    PolyPackedQty: f.packedQty || 0,
    FinishedOutput: f.finishedQty || 0,
    FinishingWIP: Math.max(0, (f.sewingReceiveQty || f.finishingInputQty || 0) - (f.finishedQty || 0)),
    Status: f.shipmentStatus || 'Ready for Pack'
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="FINISHING FLOOR & POLY PACKING REPORT"
        subtitle="Official Finishing Output, Ironing, Tagging & Ready to Pack Statement"
        department="Finishing"
        filtersSummary={[
          `Buyer: ${selectedBuyer}`,
          selectedDate ? `Date: ${selectedDate}` : 'All Dates',
          searchQuery ? `Search: "${searchQuery}"` : ''
        ].filter(Boolean)}
      />

      {/* Control Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Style, PO, Colour..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600 w-56"
            />
          </div>

          <select
            value={selectedBuyer}
            onChange={e => setSelectedBuyer(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Buyers ({buyers.length})</option>
            {buyers.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
          />

          {(selectedBuyer !== 'All' || selectedDate || searchQuery) && (
            <button
              onClick={() => {
                setSelectedBuyer('All');
                setSelectedDate('');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        <ExportPrintToolbar
          title="Finishing_Report"
          filename="MJAL_Finishing_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Received</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{(totalReceived || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Ironed Total</p>
          <h3 className="text-base font-black text-blue-900 mt-1">{(totalIroned || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Poly Packed</p>
          <h3 className="text-base font-black text-indigo-900 mt-1">{(totalPolyPacked || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Finished Output</p>
          <h3 className="text-base font-black text-emerald-900 mt-1">{(totalFinished || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Finishing Floor WIP</p>
          <h3 className="text-base font-black text-amber-900 mt-1">{(totalWIP || 0).toLocaleString()} pcs</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Finishing Floor & Packing Log ({sorted.length} Entries)
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
                <th onClick={() => handleSort('styleNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Style No <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">PO No</th>
                <th className="p-3">Colour</th>
                <th onClick={() => handleSort('sewingReceiveQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Received <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('ironedQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Ironed <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('packedQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Poly Packed <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('finishedQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Finished Out <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-right">Floor WIP</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    No matching finishing records found.
                  </td>
                </tr>
              ) : (
                sorted.map(f => {
                  const rec = f.sewingReceiveQty || f.finishingInputQty || 0;
                  const fin = f.finishedQty || 0;
                  const wip = Math.max(0, rec - fin);
                  return (
                    <tr key={f.id} className="hover:bg-sky-50/30 transition">
                      <td className="p-3 font-medium text-slate-600">{f.date}</td>
                      <td className="p-3 font-black text-sky-800">{f.styleNo}</td>
                      <td className="p-3 font-semibold text-slate-700">{f.poNo}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-800 text-[10px]">
                          {f.colour}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-blue-700">{(rec || 0).toLocaleString()} pcs</td>
                      <td className="p-3 text-right font-medium text-slate-700">{(f.ironedQty || 0).toLocaleString()} pcs</td>
                      <td className="p-3 text-right font-bold text-indigo-700">{(f.packedQty || 0).toLocaleString()} pcs</td>
                      <td className="p-3 text-right font-black text-emerald-700">{(fin || 0).toLocaleString()} pcs</td>
                      <td className="p-3 text-right font-bold text-amber-700">{(wip || 0).toLocaleString()} pcs</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {f.shipmentStatus || 'Ready for Pack'}
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
                  <td colSpan={4} className="p-3 uppercase text-slate-700">Report Summary Totals:</td>
                  <td className="p-3 text-right text-blue-800">{(totalReceived || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-right">{(totalIroned || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-right text-indigo-800">{(totalPolyPacked || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-right text-emerald-800">{(totalFinished || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-right text-amber-800">{(totalWIP || 0).toLocaleString()} pcs</td>
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
