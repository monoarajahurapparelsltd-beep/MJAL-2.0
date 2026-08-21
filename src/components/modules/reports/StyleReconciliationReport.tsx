import React, { useState } from 'react';
import {
  Layers,
  Search,
  ArrowUpDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Percent
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const StyleReconciliationReport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('styleNo');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const orders = supabaseDataService.getOrders();
  const cuttingList = supabaseDataService.getCuttingEntries();
  const sewingList = supabaseDataService.getSewingProduction();
  const washingList = supabaseDataService.getWashingRecords();
  const finishingList = supabaseDataService.getFinishingRecords();
  const packingList = supabaseDataService.getPackingRecords();
  const shipmentList = supabaseDataService.getShipmentRecords();

  // Compute multi-department reconciliation for each style
  const reconciledStyles = orders.map(order => {
    const sNo = order.styleNo;
    const orderQty = order.totalOrderQty || 0;

    const cutQty = cuttingList
      .filter(c => c.styleNo === sNo)
      .reduce((s, c) => s + (c.cutQty || 0), 0);

    const sewOutput = sewingList
      .filter(x => x.styleNo === sNo)
      .reduce((s, x) => s + (x.totalOutput || 0), 0);

    const washReceived = washingList
      .filter(w => w.styleNo === sNo)
      .reduce((s, w) => s + (w.receivedQty || 0), 0);

    const finQty = finishingList
      .filter(f => f.styleNo === sNo)
      .reduce((s, f) => s + (f.finishedQty || 0), 0);

    const packedQty = packingList
      .filter(p => p.styleNo === sNo)
      .reduce((s, p) => s + (p.packedQty || 0), 0);

    const shippedQty = shipmentList
      .filter(sh => sh.styleNo === sNo)
      .reduce((s, sh) => s + (sh.shippedQty || 0), 0);

    // Variance between Cut and Shipped
    const cutToShipVariance = cutQty - shippedQty;
    const processLossPct = cutQty > 0 ? (((cutQty - shippedQty) / cutQty) * 100).toFixed(1) : '0.0';

    return {
      id: order.id,
      styleNo: sNo,
      styleName: order.styleName,
      buyer: order.buyer,
      orderQty,
      cutQty,
      sewOutput,
      washReceived,
      finQty,
      packedQty,
      shippedQty,
      cutToShipVariance,
      processLossPct,
      status: order.status
    };
  });

  const filtered = reconciledStyles.filter(item => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    return (
      (item.styleNo || '').toLowerCase().includes(q) ||
      (item.styleName || '').toLowerCase().includes(q) ||
      (item.buyer || '').toLowerCase().includes(q)
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
  const totalOrderQty = sorted.reduce((s, x) => s + x.orderQty, 0);
  const totalCutQty = sorted.reduce((s, x) => s + x.cutQty, 0);
  const totalSewQty = sorted.reduce((s, x) => s + x.sewOutput, 0);
  const totalShippedQty = sorted.reduce((s, x) => s + x.shippedQty, 0);
  const overallLossPct = totalCutQty > 0 ? (((totalCutQty - totalShippedQty) / totalCutQty) * 100).toFixed(1) : '0.0';

  const exportData = sorted.map(item => ({
    StyleNo: item.styleNo,
    StyleName: item.styleName,
    Buyer: item.buyer,
    OrderQty: item.orderQty,
    CutQty: item.cutQty,
    SewOutput: item.sewOutput,
    WashReceived: item.washReceived,
    FinishingQty: item.finQty,
    PackedQty: item.packedQty,
    ShippedQty: item.shippedQty,
    ProcessLossPcs: item.cutToShipVariance,
    ProcessLossPct: `${item.processLossPct}%`,
    Status: item.status
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="END-TO-END STYLE PIPELINE RECONCILIATION & PROCESS LOSS REPORT"
        subtitle="Full Garment Lifecycle Audit • Order vs Cut vs Sew vs Finish vs Pack vs Shipped & Material Yield"
        department="Industrial Engineering & Central Audit"
        filtersSummary={[
          `Reconciled Styles: ${sorted.length}`,
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
              placeholder="Search Style, Name, Buyer..."
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
          title="Style_Reconciliation_Report"
          filename="MJAL_Style_Reconciliation_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Booked Order</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{(totalOrderQty || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Total Cutting Output</p>
          <h3 className="text-base font-black text-blue-900 mt-1">{(totalCutQty || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Total Sewing Output</p>
          <h3 className="text-base font-black text-indigo-900 mt-1">{(totalSewQty || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Total Commercial Shipped</p>
          <h3 className="text-base font-black text-purple-900 mt-1">{(totalShippedQty || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Overall Process Loss</p>
          <h3 className="text-base font-black text-amber-900 mt-1">{overallLossPct}%</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Style-Wise Cross-Departmental Reconciliation ({sorted.length} Styles)
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            Click column headers to sort
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th onClick={() => handleSort('styleNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Style No <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('buyer')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Buyer <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('orderQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Order Qty <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('cutQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Cut Qty <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-right">Sew Out</th>
                <th className="p-3 text-right">Wash Out</th>
                <th className="p-3 text-right">Fin Out</th>
                <th className="p-3 text-right">Packed</th>
                <th onClick={() => handleSort('shippedQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Shipped <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-center">Process Loss %</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 font-medium">
                    No style reconciliation records found.
                  </td>
                </tr>
              ) : (
                sorted.map(item => {
                  const loss = Number(item.processLossPct);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="font-bold text-blue-700">{item.styleNo}</div>
                        <div className="text-[10px] text-slate-500">{item.styleName}</div>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{item.buyer}</td>
                      <td className="p-3 text-right font-semibold text-slate-700">{(item.orderQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-blue-800">{(item.cutQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-700">{(item.sewOutput || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-700">{(item.washReceived || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-700">{(item.finQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-700">{(item.packedQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-black text-purple-900">{(item.shippedQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${loss <= 3 ? 'bg-emerald-100 text-emerald-800' : loss <= 6 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                          {item.processLossPct}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Completed' || item.status === 'Shipped' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                          {item.status}
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
                  <td colSpan={2} className="p-3 uppercase text-slate-700">Total Factory Pipeline:</td>
                  <td className="p-3 text-right">{(totalOrderQty || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-blue-900">{(totalCutQty || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-indigo-900">{(totalSewQty || 0).toLocaleString()}</td>
                  <td colSpan={3}></td>
                  <td className="p-3 text-right text-purple-900">{(totalShippedQty || 0).toLocaleString()}</td>
                  <td className="p-3 text-center text-amber-800">{overallLossPct}%</td>
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
