import React, { useState } from 'react';
import {
  Box,
  Search,
  ArrowUpDown,
  Calendar,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const PackingReport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const packingList = supabaseDataService.getPackingRecords();

  const filtered = packingList.filter(item => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    return (
      (item.styleNo || '').toLowerCase().includes(q) ||
      (item.poNo || '').toLowerCase().includes(q) ||
      (item.colour || '').toLowerCase().includes(q) ||
      (item.packingOfficer || '').toLowerCase().includes(q)
    );
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
  const totalCartons = sorted.reduce((s, p) => s + (p.cartonCount || 0), 0);
  const totalPackedPcs = sorted.reduce((s, p) => s + (p.packedQty || 0), 0);
  const totalOrderQty = sorted.reduce((s, p) => s + (p.orderQty || 0), 0);
  const totalBalance = sorted.reduce((s, p) => s + (p.balanceQty || 0), 0);

  const exportData = sorted.map(item => ({
    Date: item.date,
    StyleNo: item.styleNo,
    PONo: item.poNo,
    Colour: item.colour,
    Size: item.size || 'ALL',
    CartonCount: item.cartonCount || 0,
    PackedQty: item.packedQty || 0,
    OrderQty: item.orderQty || 0,
    BalanceQty: item.balanceQty || 0,
    PackingOfficer: item.packingOfficer || 'Packing In-charge'
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="PACKING & MASTER CARTON PRODUCTION REPORT"
        subtitle="Style-Wise Packing Progress, Export Carton Assortment Log & Balance to Pack Audit"
        department="Packing & Finishing"
        filtersSummary={[
          `Total Records: ${sorted.length}`,
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
              placeholder="Search Style, PO, Officer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600 w-56"
            />
          </div>

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
            >
              Clear Search
            </button>
          )}
        </div>

        <ExportPrintToolbar
          title="Packing_Report"
          filename="MJAL_Packing_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Order Qty</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{(totalOrderQty || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Packed Garments</p>
          <h3 className="text-base font-black text-emerald-900 mt-1">{(totalPackedPcs || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Master Cartons Produced</p>
          <h3 className="text-base font-black text-blue-900 mt-1">{(totalCartons || 0).toLocaleString()} Cartons</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Packing Balance Remaining</p>
          <h3 className="text-base font-black text-amber-900 mt-1">{(totalBalance || 0).toLocaleString()} pcs</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Export Packing Lists & Carton Records ({sorted.length} Entries)
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
                <th className="p-3">Colour / Size</th>
                <th onClick={() => handleSort('cartonCount')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Cartons <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('packedQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Packed Qty <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('orderQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Order Qty <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-right">Balance to Pack</th>
                <th className="p-3">Officer</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    No matching packing records found.
                  </td>
                </tr>
              ) : (
                sorted.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-slate-700 whitespace-nowrap">{item.date}</td>
                    <td className="p-3 font-bold text-blue-700">{item.styleNo}</td>
                    <td className="p-3 font-mono text-slate-700">{item.poNo}</td>
                    <td className="p-3 text-slate-700">
                      {item.colour} {item.size ? `(${item.size})` : ''}
                    </td>
                    <td className="p-3 text-right font-black text-blue-800">{(item.cartonCount || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-black text-emerald-800">{(item.packedQty || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold text-slate-700">{(item.orderQty || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-amber-700">{(item.balanceQty || 0).toLocaleString()}</td>
                    <td className="p-3 text-slate-800 font-medium">{item.packingOfficer}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.balanceQty <= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                        {item.balanceQty <= 0 ? 'Complete' : 'In Progress'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
                <tr>
                  <td colSpan={4} className="p-3 uppercase text-slate-700">Total Packing Summary:</td>
                  <td className="p-3 text-right text-blue-900">{(totalCartons || 0).toLocaleString()} ctn</td>
                  <td className="p-3 text-right text-emerald-900">{(totalPackedPcs || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-right">{(totalOrderQty || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-right text-amber-700">{(totalBalance || 0).toLocaleString()} pcs</td>
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
