import React, { useState } from 'react';
import {
  ShoppingBag,
  Search,
  ArrowUpDown,
  Calendar,
  DollarSign,
  Tag,
  CheckCircle2
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { useAuth } from '../../../context/AuthContext';
import { filterOrdersForUser } from '../../../utils/authUtils';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const MerchandisingReport: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('All');
  const [selectedSeason, setSelectedSeason] = useState('All');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const rawOrders = supabaseDataService.getOrders();
  const orders = filterOrdersForUser(rawOrders, currentUser);

  const buyers = Array.from(new Set(orders.map(o => o.buyer).filter(Boolean)));
  const seasons = Array.from(new Set(orders.map(o => o.season).filter(Boolean)));

  const filtered = orders.filter(item => {
    const sq = (searchQuery || '').toLowerCase();
    const matchSearch =
      !sq ||
      item.styleNo?.toLowerCase().includes(sq) ||
      item.styleName?.toLowerCase().includes(sq) ||
      item.buyer?.toLowerCase().includes(sq) ||
      item.purchaseOrders?.some(p => p.poNo?.toLowerCase().includes(sq));

    const matchBuyer = selectedBuyer === 'All' || item.buyer === selectedBuyer;
    const matchSeason = selectedSeason === 'All' || item.season === selectedSeason;

    return matchSearch && matchBuyer && matchSeason;
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
  const totalStyles = sorted.length;
  const totalOrderQty = sorted.reduce((s, o) => s + (o.totalOrderQty || 0), 0);
  const totalOrderValue = sorted.reduce((s, o) => s + (o.totalOrderValue || 0), 0);
  const avgPrice = totalOrderQty > 0 ? (totalOrderValue / totalOrderQty).toFixed(2) : '0.00';

  const exportData = sorted.map(item => ({
    StyleNo: item.styleNo,
    StyleName: item.styleName,
    Buyer: item.buyer,
    Season: item.season,
    GarmentType: item.garmentType,
    TotalQty: item.totalOrderQty || 0,
    TotalValueUSD: item.totalOrderValue || 0,
    Currency: item.currency,
    POCount: item.purchaseOrders?.length || 0,
    Status: item.status,
    CreatedDate: item.createdAt
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="MERCHANDISING ORDER BOOKINGS & COMMERCIAL REGISTER"
        subtitle="Style-Wise Purchase Order Portfolio, Order Valuation Statement & Buyer Bookings Audit"
        department="Merchandising & Marketing"
        filtersSummary={[
          `Buyer: ${selectedBuyer}`,
          `Season: ${selectedSeason}`,
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
              placeholder="Search Style, Name, PO, Buyer..."
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
            value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Seasons ({seasons.length})</option>
            {seasons.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {(selectedBuyer !== 'All' || selectedSeason !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedBuyer('All');
                setSelectedSeason('All');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        <ExportPrintToolbar
          title="Merchandising_Order_Report"
          filename="MJAL_Merchandising_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Styles</p>
          <h3 className="text-base font-black text-slate-900 mt-1">{totalStyles} Styles</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Total Booked Quantity</p>
          <h3 className="text-base font-black text-blue-900 mt-1">{(totalOrderQty || 0).toLocaleString()} pcs</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Order Valuation</p>
          <h3 className="text-base font-black text-emerald-900 mt-1">${(totalOrderValue || 0).toLocaleString()}</h3>
        </div>

        <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Average FOB Price</p>
          <h3 className="text-base font-black text-purple-900 mt-1">${avgPrice} / pc</h3>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Merchandising Style Portfolios & Value Statement ({sorted.length} Styles)
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
                <th onClick={() => handleSort('styleName')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Style Name <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('buyer')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Buyer <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3">Season</th>
                <th className="p-3">Garment Item</th>
                <th className="p-3 text-center">POs</th>
                <th onClick={() => handleSort('totalOrderQty')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Order Qty <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('totalOrderValue')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Total FOB Value <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    No matching order styles found.
                  </td>
                </tr>
              ) : (
                sorted.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-bold text-blue-700">{item.styleNo}</td>
                    <td className="p-3 font-semibold text-slate-800">{item.styleName}</td>
                    <td className="p-3 font-bold text-slate-900">{item.buyer}</td>
                    <td className="p-3 text-slate-700">{item.season}</td>
                    <td className="p-3 text-slate-600">{item.garmentType}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">
                      {item.purchaseOrders?.length || 0}
                    </td>
                    <td className="p-3 text-right font-black text-slate-900">{(item.totalOrderQty || 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-black text-emerald-800">
                      ${(item.totalOrderValue || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Confirmed' || item.status === 'Running' ? 'bg-blue-100 text-blue-800' : item.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
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
                  <td colSpan={6} className="p-3 uppercase text-slate-700">Total Bookings Portfolio:</td>
                  <td className="p-3 text-right">{(totalOrderQty || 0).toLocaleString()} pcs</td>
                  <td className="p-3 text-right text-emerald-900">${(totalOrderValue || 0).toLocaleString()}</td>
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
