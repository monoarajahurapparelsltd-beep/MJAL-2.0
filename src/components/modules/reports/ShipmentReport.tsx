import React, { useState } from 'react';
import {
  Truck,
  Search,
  ArrowUpDown,
  Calendar,
  DollarSign,
  Box,
  CheckCircle2
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const ShipmentReport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortField, setSortField] = useState<string>('shipmentDate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const shipmentList = supabaseDataService.getShipmentRecords();

  const buyers = Array.from(new Set(shipmentList.map(s => s.buyer).filter(Boolean)));
  const statuses = Array.from(new Set(shipmentList.map(s => s.status).filter(Boolean)));

  const filtered = shipmentList.filter(item => {
    const matchSearch =
      !searchQuery ||
      item.invoiceNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.styleNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.poNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.containerNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.buyer?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchBuyer = selectedBuyer === 'All' || item.buyer === selectedBuyer;
    const matchStatus = selectedStatus === 'All' || item.status === selectedStatus;

    return matchSearch && matchBuyer && matchStatus;
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
  const totalShippedQty = sorted.reduce((s, sh) => s + (sh.shippedQty || 0), 0);
  const totalOrderQty = sorted.reduce((s, sh) => s + (sh.orderQty || 0), 0);
  const totalCartons = sorted.reduce((s, sh) => s + (sh.cartonCount || 0), 0);
  const totalBalance = sorted.reduce((s, sh) => s + (sh.balanceQty || 0), 0);

  const exportData = sorted.map(item => ({
    InvoiceNo: item.invoiceNo,
    PackingListNo: item.packingListNo,
    ShipmentDate: item.shipmentDate,
    Buyer: item.buyer,
    StyleNo: item.styleNo,
    PONo: item.poNo,
    Colour: item.colour,
    ShippedQty: item.shippedQty || 0,
    OrderQty: item.orderQty || 0,
    CartonCount: item.cartonCount || 0,
    PortOfLoading: item.portOfLoading,
    PortOfDischarge: item.portOfDischarge,
    ContainerNo: item.containerNo,
    VesselFlight: item.vesselOrFlight,
    Status: item.status
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="COMMERCIAL EXPORT & SHIPMENT INVOICE REPORT"
        subtitle="Official Factory Commercial Dispatch Statement, Bill of Lading (BL) & Export Clearance Log"
        department="Commercial & Export"
        filtersSummary={[
          `Buyer: ${selectedBuyer}`,
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
              placeholder="Search Invoice, Style, PO, Container..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600 w-60"
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
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Shipment Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {(selectedBuyer !== 'All' || selectedStatus !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedBuyer('All');
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
          title="Shipment_Report"
          filename="MJAL_Shipment_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Booked Order</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{(totalOrderQty || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Total Shipped Quantity</p>
          <h3 className="text-base font-black text-purple-900 mt-1">{(totalShippedQty || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Export Cartons Handed Over</p>
          <h3 className="text-base font-black text-emerald-900 mt-1">{(totalCartons || 0).toLocaleString()} Cartons</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Pending Balance to Ship</p>
          <h3 className="text-base font-black text-blue-900 mt-1">{(totalBalance || 0).toLocaleString()} pcs</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Commercial Export Shipments & Invoices ({sorted.length} Invoices)
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            Click column headers to sort
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th onClick={() => handleSort('invoiceNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Invoice No <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('shipmentDate')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('buyer')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Buyer <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('styleNo')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Style No <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">PO No</th>
                <th onClick={() => handleSort('shippedQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Shipped Qty <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-right">Cartons</th>
                <th className="p-3">Ports (Load / Discharge)</th>
                <th className="p-3">Container / Carrier</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    No matching shipment invoice records found.
                  </td>
                </tr>
              ) : (
                sorted.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono font-bold text-purple-900">{item.invoiceNo}</td>
                    <td className="p-3 text-slate-700 whitespace-nowrap">{item.shipmentDate}</td>
                    <td className="p-3 font-bold text-slate-900">{item.buyer}</td>
                    <td className="p-3 font-bold text-blue-700">{item.styleNo}</td>
                    <td className="p-3 font-mono text-slate-700">{item.poNo}</td>
                    <td className="p-3 text-right font-black text-purple-900">{(item.shippedQty || 0).toLocaleString()} pcs</td>
                    <td className="p-3 text-right font-bold text-emerald-800">{(item.cartonCount || 0).toLocaleString()}</td>
                    <td className="p-3 text-slate-700 text-[11px]">
                      {item.portOfLoading || 'Chattogram'} &rarr; {item.portOfDischarge || 'Destination'}
                    </td>
                    <td className="p-3 text-slate-700 font-mono text-[11px]">
                      {item.containerNo || item.vesselOrFlight || 'Direct'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Shipped' || item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
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
                  <td colSpan={5} className="p-3 uppercase text-slate-700">Total Shipped Summary:</td>
                  <td className="p-3 text-right text-purple-900">{(totalShippedQty || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-right text-emerald-900">{(totalCartons || 0).toLocaleString()} ctn</td>
                  <td colSpan={3}></td>
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
