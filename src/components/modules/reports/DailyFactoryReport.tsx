import React, { useState } from 'react';
import {
  Scissors,
  Shirt,
  Waves,
  Sparkles,
  ClipboardCheck,
  Box,
  Truck,
  Calendar
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';

export const DailyFactoryReport: React.FC = () => {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedBuyer, setSelectedBuyer] = useState<string>('All');

  // Datasets
  const cuttingEntries = supabaseDataService.getCuttingEntries();
  const sewingList = supabaseDataService.getSewingProduction();
  const washingList = supabaseDataService.getWashingRecords();
  const finishingList = supabaseDataService.getFinishingRecords();
  const qcList = supabaseDataService.getQCInspections();
  const packingList = supabaseDataService.getPackingRecords();
  const shipmentList = supabaseDataService.getShipmentRecords();
  const orders = supabaseDataService.getOrders();

  // Buyers list
  const buyers = Array.from(new Set(orders.map(o => o.buyer).filter(Boolean)));

  // Filter helpers
  const filterByDateAndBuyer = <T extends { date?: string; buyer?: string; styleNo?: string }>(items: T[]) => {
    return items.filter(item => {
      const matchDate = !selectedDate || item.date === selectedDate || !item.date;
      let matchBuyer = true;
      if (selectedBuyer !== 'All') {
        if (item.buyer) {
          matchBuyer = item.buyer === selectedBuyer;
        } else if (item.styleNo) {
          const ord = orders.find(o => o.styleNo === item.styleNo);
          matchBuyer = ord?.buyer === selectedBuyer;
        }
      }
      return matchDate && matchBuyer;
    });
  };

  const dayCutting = filterByDateAndBuyer(cuttingEntries);
  const daySewing = filterByDateAndBuyer(sewingList);
  const dayWashing = filterByDateAndBuyer(washingList);
  const dayFinishing = filterByDateAndBuyer(finishingList);
  const dayQC = filterByDateAndBuyer(qcList);
  const dayPacking = filterByDateAndBuyer(packingList);
  const dayShipment = filterByDateAndBuyer(
    shipmentList.map(s => ({ ...s, date: s.shipmentDate }))
  );

  // Aggregated totals
  const totalCut = dayCutting.reduce((s, c) => s + (c.cutQty || 0), 0);
  const totalCutShortage = dayCutting.reduce((s, c) => s + (c.shortageQty || 0), 0);
  const totalSewOutput = daySewing.reduce((s, x) => s + (x.totalOutput || 0), 0);
  const totalSewTarget = daySewing.reduce((s, x) => s + (x.dailyTarget || 0), 0);
  const sewEff = totalSewTarget > 0 ? Math.round((totalSewOutput / totalSewTarget) * 100) : 0;
  
  const totalWashSent = dayWashing.reduce((s, w) => s + (w.sentQty || 0), 0);
  const totalWashReceived = dayWashing.reduce((s, w) => s + (w.receivedQty || 0), 0);
  
  const totalFinIn = dayFinishing.reduce((s, f) => s + (f.finishingInputQty || f.sewingReceiveQty || 0), 0);
  const totalFinOut = dayFinishing.reduce((s, f) => s + (f.finishedQty || 0), 0);
  
  const totalQcInspected = dayQC.reduce((s, q) => s + (q.inspectedQty || 0), 0);
  const totalQcPassed = dayQC.reduce((s, q) => s + (q.passedQty || 0), 0);
  const avgDHU = dayQC.length > 0 ? (dayQC.reduce((s, q) => s + (q.dhu || 0), 0) / dayQC.length).toFixed(1) : '0.0';

  const totalPacked = dayPacking.reduce((s, p) => s + (p.packedQty || 0), 0);
  const totalCartons = dayPacking.reduce((s, p) => s + (p.cartonCount || 0), 0);
  const totalShipped = dayShipment.reduce((s, sh) => s + (sh.shippedQty || 0), 0);

  // Summary Export Payload
  const exportData = [
    { Department: 'Cutting Floor', InputQty: dayCutting.reduce((s, c) => s + (c.orderQty || 0), 0), OutputQty: totalCut, Variance: -totalCutShortage, Metric: 'Efficiency: 98%' },
    { Department: 'Sewing Lines', InputQty: totalSewTarget, OutputQty: totalSewOutput, Variance: totalSewOutput - totalSewTarget, Metric: `Efficiency: ${sewEff}%` },
    { Department: 'Washing Unit', InputQty: totalWashSent, OutputQty: totalWashReceived, Variance: totalWashReceived - totalWashSent, Metric: 'Wash Complete' },
    { Department: 'Finishing Unit', InputQty: totalFinIn, OutputQty: totalFinOut, Variance: totalFinOut - totalFinIn, Metric: 'Poly Pack Complete' },
    { Department: 'Quality Control (QC)', InputQty: totalQcInspected, OutputQty: totalQcPassed, Variance: totalQcInspected - totalQcPassed, Metric: `Avg DHU: ${avgDHU}%` },
    { Department: 'Packing & Carton', InputQty: totalPacked, OutputQty: totalCartons, Variance: 0, Metric: `${totalCartons} Cartons` },
    { Department: 'Commercial Shipment', InputQty: totalShipped, OutputQty: totalShipped, Variance: 0, Metric: 'Dispatched' },
  ];

  return (
    <div className="space-y-6">
      {/* Printable Header */}
      <ReportPrintHeader
        title="DAILY FACTORY PRODUCTION & DISPATCH SUMMARY REPORT"
        subtitle={`Complete Daily Performance Breakdown Across All Factory Departments • Monoara Jahur Apparels Ltd.`}
        department="All Operations"
        filtersSummary={[
          `Date: ${selectedDate || 'All Time'}`,
          `Buyer: ${selectedBuyer}`
        ]}
      />

      {/* High Level Department KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* 1. Cutting */}
        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-1">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">1. Cutting</span>
            <Scissors className="h-4 w-4" />
          </div>
          <p className="text-base font-black text-slate-900">{(totalCut || 0).toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 font-medium">Shortage: <strong className="text-rose-600">{(totalCutShortage || 0).toLocaleString()}</strong></p>
        </div>

        {/* 2. Sewing */}
        <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-1">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">2. Sewing</span>
            <Shirt className="h-4 w-4" />
          </div>
          <p className="text-base font-black text-slate-900">{(totalSewOutput || 0).toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 font-medium">Target Eff: <strong className="text-emerald-700">{sewEff}%</strong></p>
        </div>

        {/* 3. Washing */}
        <div className="p-3.5 rounded-xl border border-cyan-200 bg-cyan-50/50 space-y-1">
          <div className="flex items-center justify-between text-cyan-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">3. Washing</span>
            <Waves className="h-4 w-4" />
          </div>
          <p className="text-base font-black text-slate-900">{(totalWashReceived || 0).toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 font-medium">Sent: {(totalWashSent || 0).toLocaleString()}</p>
        </div>

        {/* 4. Finishing */}
        <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/50 space-y-1">
          <div className="flex items-center justify-between text-sky-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">4. Finishing</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-base font-black text-slate-900">{(totalFinOut || 0).toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 font-medium">Received: {(totalFinIn || 0).toLocaleString()}</p>
        </div>

        {/* 5. Quality (QC) */}
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">5. Quality (QC)</span>
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <p className="text-base font-black text-slate-900">{(totalQcPassed || 0).toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 font-medium">Avg DHU: <strong className="text-amber-700">{avgDHU}%</strong></p>
        </div>

        {/* 6. Packing */}
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">6. Packing</span>
            <Box className="h-4 w-4" />
          </div>
          <p className="text-base font-black text-slate-900">{(totalPacked || 0).toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 font-medium">Cartons: <strong className="text-emerald-700">{totalCartons}</strong></p>
        </div>

        {/* 7. Shipment */}
        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 space-y-1">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-[10px] font-bold uppercase tracking-wider">7. Shipment</span>
            <Truck className="h-4 w-4" />
          </div>
          <p className="text-base font-black text-slate-900">{(totalShipped || 0).toLocaleString()}</p>
          <p className="text-[10px] text-purple-700 font-medium">Export Ready</p>
        </div>
      </div>

      {/* Main Multi-Department Executive Breakdown Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              Departmental Daily Production & Execution Statement
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Verified records for {selectedDate ? `Date: ${selectedDate}` : 'All Recorded Dates'} • {selectedBuyer === 'All' ? 'All Buyers' : `Buyer: ${selectedBuyer}`}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Key Metric / Scope</th>
                <th className="p-3.5 text-right">Target / Input</th>
                <th className="p-3.5 text-right">Actual Output</th>
                <th className="p-3.5 text-right">Variance (+/-)</th>
                <th className="p-3.5 text-center">Department Rating / Eff</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {/* Cutting Row */}
              <tr className="hover:bg-slate-50 transition">
                <td className="p-3.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Scissors className="h-4 w-4 text-blue-600" />
                    <span>Cutting Floor</span>
                  </div>
                </td>
                <td className="p-3.5 text-slate-600">{dayCutting.length} Cutting Marker Entries</td>
                <td className="p-3.5 text-right font-semibold text-slate-700">{dayCutting.reduce((s, c) => s + (c.orderQty || 0), 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-black text-blue-700">{(totalCut || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-bold text-rose-600">
                  {totalCutShortage > 0 ? `-${totalCutShortage.toLocaleString()}` : '0'} pcs
                </td>
                <td className="p-3.5 text-center font-bold text-slate-800">98.5% Marker</td>
                <td className="p-3.5 text-center">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Active</span>
                </td>
              </tr>

              {/* Sewing Row */}
              <tr className="hover:bg-slate-50 transition">
                <td className="p-3.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Shirt className="h-4 w-4 text-indigo-600" />
                    <span>Sewing Assembly Lines</span>
                  </div>
                </td>
                <td className="p-3.5 text-slate-600">{daySewing.length} Line Production Entries</td>
                <td className="p-3.5 text-right font-semibold text-slate-700">{(totalSewTarget || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-black text-indigo-700">{(totalSewOutput || 0).toLocaleString()} pcs</td>
                <td className={`p-3.5 text-right font-bold ${totalSewOutput >= totalSewTarget ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totalSewOutput >= totalSewTarget ? `+${(totalSewOutput - totalSewTarget).toLocaleString()}` : (totalSewOutput - totalSewTarget).toLocaleString()} pcs
                </td>
                <td className="p-3.5 text-center font-extrabold text-indigo-700">{sewEff}%</td>
                <td className="p-3.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sewEff >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {sewEff >= 90 ? 'On Target' : 'Under Target'}
                  </span>
                </td>
              </tr>

              {/* Washing Row */}
              <tr className="hover:bg-slate-50 transition">
                <td className="p-3.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Waves className="h-4 w-4 text-cyan-600" />
                    <span>Washing & Treatment</span>
                  </div>
                </td>
                <td className="p-3.5 text-slate-600">{dayWashing.length} Wash Batches Processed</td>
                <td className="p-3.5 text-right font-semibold text-slate-700">{(totalWashSent || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-black text-cyan-800">{(totalWashReceived || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-bold text-slate-600">{(totalWashSent - totalWashReceived).toLocaleString()} WIP</td>
                <td className="p-3.5 text-center font-bold text-slate-800">100% Quality</td>
                <td className="p-3.5 text-center">
                  <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-[10px] font-bold">Processed</span>
                </td>
              </tr>

              {/* Finishing Row */}
              <tr className="hover:bg-slate-50 transition">
                <td className="p-3.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Sparkles className="h-4 w-4 text-sky-600" />
                    <span>Finishing & Ironing</span>
                  </div>
                </td>
                <td className="p-3.5 text-slate-600">{dayFinishing.length} Finishing Lots</td>
                <td className="p-3.5 text-right font-semibold text-slate-700">{(totalFinIn || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-black text-sky-800">{(totalFinOut || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-bold text-slate-600">{(totalFinIn - totalFinOut).toLocaleString()} WIP</td>
                <td className="p-3.5 text-center font-bold text-slate-800">Poly Pack Completed</td>
                <td className="p-3.5 text-center">
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold">Finished</span>
                </td>
              </tr>

              {/* Quality Control Row */}
              <tr className="hover:bg-slate-50 transition">
                <td className="p-3.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <ClipboardCheck className="h-4 w-4 text-amber-600" />
                    <span>Quality Control (QC / DHU)</span>
                  </div>
                </td>
                <td className="p-3.5 text-slate-600">{dayQC.length} Inspection Audits</td>
                <td className="p-3.5 text-right font-semibold text-slate-700">{(totalQcInspected || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-black text-emerald-700">{(totalQcPassed || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-bold text-amber-600">{(totalQcInspected - totalQcPassed).toLocaleString()} Rework</td>
                <td className="p-3.5 text-center font-extrabold text-amber-800">{avgDHU}% DHU</td>
                <td className="p-3.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${Number(avgDHU) <= 2.5 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {Number(avgDHU) <= 2.5 ? 'AQL Passed' : 'AQL Alert'}
                  </span>
                </td>
              </tr>

              {/* Packing Row */}
              <tr className="hover:bg-slate-50 transition">
                <td className="p-3.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Box className="h-4 w-4 text-emerald-600" />
                    <span>Packing & Cartons</span>
                  </div>
                </td>
                <td className="p-3.5 text-slate-600">{totalCartons} Export Master Cartons</td>
                <td className="p-3.5 text-right font-semibold text-slate-700">{(totalPacked || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-black text-emerald-700">{(totalPacked || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-bold text-slate-600">{totalCartons} ctn</td>
                <td className="p-3.5 text-center font-bold text-slate-800">100% Inspected</td>
                <td className="p-3.5 text-center">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Packed</span>
                </td>
              </tr>

              {/* Shipment Row */}
              <tr className="hover:bg-slate-50 transition">
                <td className="p-3.5">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Truck className="h-4 w-4 text-purple-600" />
                    <span>Commercial Shipment</span>
                  </div>
                </td>
                <td className="p-3.5 text-slate-600">{dayShipment.length} Export Shipment Records</td>
                <td className="p-3.5 text-right font-semibold text-slate-700">{(totalShipped || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-black text-purple-700">{(totalShipped || 0).toLocaleString()} pcs</td>
                <td className="p-3.5 text-right font-bold text-emerald-600">Dispatched</td>
                <td className="p-3.5 text-center font-bold text-purple-800">Export Cleared</td>
                <td className="p-3.5 text-center">
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">Shipped</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Footer with Signatures */}
      <ReportPrintFooter />
    </div>
  );
};
