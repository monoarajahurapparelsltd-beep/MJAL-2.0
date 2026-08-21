import React, { useState } from 'react';
import {
  Waves,
  Search,
  ArrowUpDown,
  Calendar,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const WashingReport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWashType, setSelectedWashType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const washingList = supabaseDataService.getWashingRecords();

  const washTypes = Array.from(new Set(washingList.map(w => w.washType).filter(Boolean)));
  const statuses = Array.from(new Set(washingList.map(w => w.status).filter(Boolean)));

  const filtered = washingList.filter(item => {
    const matchSearch =
      !searchQuery ||
      item.styleNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.poNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.challanNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.vendorName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchType = selectedWashType === 'All' || item.washType === selectedWashType;
    const matchStatus = selectedStatus === 'All' || item.status === selectedStatus;

    return matchSearch && matchType && matchStatus;
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
  const totalSent = sorted.reduce((s, w) => s + (w.sentQty || 0), 0);
  const totalReceived = sorted.reduce((s, w) => s + (w.receivedQty || 0), 0);
  const totalDamage = sorted.reduce((s, w) => s + (w.damageQty || 0), 0);
  const totalReject = sorted.reduce((s, w) => s + (w.rejectQty || 0), 0);
  const totalBalance = sorted.reduce((s, w) => s + (w.balanceQty || (w.sentQty - w.receivedQty) || 0), 0);

  const exportData = sorted.map(item => ({
    ChallanNo: item.challanNo,
    Date: item.date,
    Vendor: item.vendorName,
    StyleNo: item.styleNo,
    PONo: item.poNo,
    Colour: item.colour,
    WashType: item.washType,
    SentQty: item.sentQty || 0,
    ReceivedQty: item.receivedQty || 0,
    DamageQty: item.damageQty || 0,
    RejectQty: item.rejectQty || 0,
    BalanceWIP: item.balanceQty || 0,
    Status: item.status
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="WASHING UNIT & CHEMICAL TREATMENT AUDIT REPORT"
        subtitle="Batch-Wise Wash Challan Log, Factory Gate Pass Tracking & Damage Recovery Audit"
        department="Washing Division"
        filtersSummary={[
          `Wash Type: ${selectedWashType}`,
          `Status: ${selectedStatus}`,
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
              placeholder="Search Challan, Style, PO, Vendor..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600 w-56"
            />
          </div>

          <select
            value={selectedWashType}
            onChange={e => setSelectedWashType(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Wash Types ({washTypes.length})</option>
            {washTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {(selectedWashType !== 'All' || selectedStatus !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedWashType('All');
                setSelectedStatus('All');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        <ExportPrintToolbar
          title="Washing_Report"
          filename="MJAL_Washing_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Sent to Wash</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{(totalSent || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-cyan-200 bg-cyan-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-700">Received Back</p>
          <h3 className="text-base font-black text-cyan-900 mt-1">{(totalReceived || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Wash WIP Balance</p>
          <h3 className="text-base font-black text-amber-900 mt-1">{(totalBalance || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Damage / Bleed Loss</p>
          <h3 className="text-base font-black text-rose-700 mt-1">{(totalDamage || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Wash Completion</p>
          <h3 className="text-base font-black text-purple-900 mt-1">
            {totalSent > 0 ? Math.round((totalReceived / totalSent) * 100) : 0}%
          </h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Washing Challans & Delivery Batches ({sorted.length} Batches)
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            Click column headers to sort
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th onClick={() => handleSort('challanNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Challan No <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('date')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">Vendor / Plant</th>
                <th onClick={() => handleSort('styleNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Style No <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">PO No</th>
                <th className="p-3">Wash Type</th>
                <th onClick={() => handleSort('sentQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Sent Qty <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('receivedQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Received <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-right">Damage</th>
                <th className="p-3 text-right">WIP Balance</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 font-medium">
                    No matching washing batch records found.
                  </td>
                </tr>
              ) : (
                sorted.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono font-bold text-cyan-800">{item.challanNo}</td>
                    <td className="p-3 text-slate-700 whitespace-nowrap">{item.date}</td>
                    <td className="p-3 font-semibold text-slate-800">{item.vendorName}</td>
                    <td className="p-3 font-bold text-blue-700">{item.styleNo}</td>
                    <td className="p-3 font-mono text-slate-700">{item.poNo}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-800 text-[10px] font-bold">
                        {item.washType}
                      </span>
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-700">{(item.sentQty || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-black text-cyan-900">{(item.receivedQty || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-rose-600">{(item.damageQty || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-amber-700">
                      {((item.balanceQty ?? (item.sentQty - item.receivedQty)) || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Completed' || item.status === 'Received' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
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
                  <td colSpan={6} className="p-3 uppercase text-slate-700">Total Washing Summary:</td>
                  <td className="p-3 text-right">{(totalSent || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-cyan-900">{(totalReceived || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-rose-700">{(totalDamage || 0).toLocaleString()}</td>
                  <td className="p-3 text-right text-amber-700">{(totalBalance || 0).toLocaleString()}</td>
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
