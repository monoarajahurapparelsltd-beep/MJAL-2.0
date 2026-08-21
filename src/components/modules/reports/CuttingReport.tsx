import React, { useState } from 'react';
import {
  Scissors,
  TrendingDown,
  Percent,
  Layers,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const CuttingReport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('All');
  const [selectedStyle, setSelectedStyle] = useState('All');
  const [selectedDate, setSelectedDate] = useState('');
  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const cuttingEntries = supabaseDataService.getCuttingEntries();
  const orders = supabaseDataService.getOrders();
  const orderMap = new Map(orders.map(o => [o.styleNo, o.buyer]));

  const buyers = Array.from(new Set(orders.map(o => o.buyer).filter(Boolean)));
  const styles = Array.from(new Set(cuttingEntries.map(c => c.styleNo).filter(Boolean)));

  // Filter
  const filtered = cuttingEntries.filter(item => {
    const itemBuyer = orderMap.get(item.styleNo) || 'MJAL';
    const matchSearch =
      !searchQuery ||
      item.styleNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.poNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.colour?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.operator?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchBuyer = selectedBuyer === 'All' || itemBuyer === selectedBuyer;
    const matchStyle = selectedStyle === 'All' || item.styleNo === selectedStyle;
    const matchDate = !selectedDate || item.date === selectedDate;

    return matchSearch && matchBuyer && matchStyle && matchDate;
  });

  // Sort
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

  // Aggregated KPIs
  const totalOrderQty = sorted.reduce((s, c) => s + (c.orderQty || 0), 0);
  const totalCutQty = sorted.reduce((s, c) => s + (c.cutQty || 0), 0);
  const totalShortage = sorted.reduce((s, c) => s + (c.shortageQty || 0), 0);
  const totalBundles = sorted.reduce((s, c) => s + (c.bundleCount || 0), 0);
  const avgMarkerEff =
    sorted.length > 0
      ? (sorted.reduce((s, c) => s + (Number(c.markerEfficiency) || 0), 0) / sorted.length).toFixed(1)
      : '0.0';
  const avgCutEff =
    sorted.length > 0
      ? (sorted.reduce((s, c) => s + (Number(c.cutEfficiency) || 0), 0) / sorted.length).toFixed(1)
      : '0.0';

  const exportData = sorted.map(c => ({
    Date: c.date,
    Buyer: orderMap.get(c.styleNo) || 'MJAL Buyer',
    StyleNo: c.styleNo,
    PONo: c.poNo,
    Colour: c.colour,
    OrderQty: c.orderQty || 0,
    CutQty: c.cutQty || 0,
    ShortageQty: c.shortageQty || 0,
    MarkerEffPct: `${c.markerEfficiency || 0}%`,
    BundleCount: c.bundleCount || 0,
    CutEffPct: `${c.cutEfficiency || 0}%`,
    CuttingMaster: c.operator || 'Master In-charge'
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="CUTTING FLOOR PRODUCTION & FABRIC SHORTAGE REPORT"
        subtitle="Detailed Cutting Log, Marker Efficiency Ratios, Bundle Generation & Variance Analysis"
        department="Cutting & Spreading"
        filtersSummary={[
          `Buyer: ${selectedBuyer}`,
          `Style: ${selectedStyle}`,
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
              placeholder="Search Style, PO, Colour, Master..."
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

          <select
            value={selectedStyle}
            onChange={e => setSelectedStyle(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Styles ({styles.length})</option>
            {styles.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
          />

          {(selectedBuyer !== 'All' || selectedStyle !== 'All' || selectedDate || searchQuery) && (
            <button
              onClick={() => {
                setSelectedBuyer('All');
                setSelectedStyle('All');
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
          title="Cutting_Report"
          filename="MJAL_Cutting_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Booked Order</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{(totalOrderQty || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Total Pieces Cut</p>
          <h3 className="text-base font-black text-blue-900 mt-1">{(totalCutQty || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Total Bundles Made</p>
          <h3 className="text-base font-black text-indigo-900 mt-1">{(totalBundles || 0).toLocaleString()} Bundles</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Avg Marker Efficiency</p>
          <h3 className="text-base font-black text-emerald-900 mt-1">{avgMarkerEff}%</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Cutting Floor Output Log ({sorted.length} Entries)
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
                <th className="p-3">Buyer</th>
                <th onClick={() => handleSort('styleNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Style No <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">PO No</th>
                <th className="p-3">Colour</th>
                <th onClick={() => handleSort('orderQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Order Qty <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('cutQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Cut Qty <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-right">Shortage</th>
                <th className="p-3 text-center">Marker Eff</th>
                <th className="p-3 text-right">Bundles</th>
                <th className="p-3 text-center">Cut Eff</th>
                <th className="p-3">Master In-Charge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400 font-medium">
                    No matching cutting records found.
                  </td>
                </tr>
              ) : (
                sorted.map(c => (
                  <tr key={c.id} className="hover:bg-blue-50/30 transition">
                    <td className="p-3 font-semibold text-slate-700">{c.date}</td>
                    <td className="p-3 font-bold text-slate-800">{orderMap.get(c.styleNo) || 'MJAL'}</td>
                    <td className="p-3 font-black text-blue-700">{c.styleNo}</td>
                    <td className="p-3 font-medium text-slate-700">{c.poNo}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-800 text-[10px]">
                        {c.colour}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-800">{(c.orderQty || 0).toLocaleString()} pcs</td>
                    <td className="p-3 text-right font-black text-blue-700">{(c.cutQty || 0).toLocaleString()} pcs</td>
                    <td className={`p-3 text-right font-bold ${(c.shortageQty || 0) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {(c.shortageQty || 0) > 0 ? `-${c.shortageQty.toLocaleString()}` : '0'} pcs
                    </td>
                    <td className="p-3 text-center font-bold text-indigo-700">{c.markerEfficiency}%</td>
                    <td className="p-3 text-right font-medium text-slate-700">{(c.bundleCount || 0).toLocaleString()}</td>
                    <td className="p-3 text-center font-extrabold text-emerald-700">{c.cutEfficiency}%</td>
                    <td className="p-3 text-slate-600 font-medium">{c.operator}</td>
                  </tr>
                ))
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
                <tr>
                  <td colSpan={5} className="p-3 uppercase text-slate-700">Totals:</td>
                  <td className="p-3 text-right">{(totalOrderQty || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-right text-blue-800">{(totalCutQty || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-right text-rose-700">{(totalShortage || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-center text-indigo-800">{avgMarkerEff}%</td>
                  <td className="p-3 text-right">{(totalBundles || 0).toLocaleString()}</td>
                  <td className="p-3 text-center text-emerald-800">{avgCutEff}%</td>
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
