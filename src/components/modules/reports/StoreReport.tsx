import React, { useState } from 'react';
import {
  Warehouse,
  TrendingUp,
  Search,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Package
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';

export const StoreReport: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortField, setSortField] = useState<string>('itemName');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const storeStock = supabaseDataService.getStoreStock();
  const categories = Array.from(new Set(storeStock.map(s => s.category).filter(Boolean)));

  const filtered = storeStock.filter(item => {
    const q = (searchQuery || '').trim().toLowerCase();
    const matchSearch =
      !q ||
      (item.id || '').toLowerCase().includes(q) ||
      (item.itemName || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.location || '').toLowerCase().includes(q);

    const matchCategory = selectedCategory === 'All' || item.category === selectedCategory;

    const isLow = (item.currentStock || 0) <= (item.minStockLevel || 0);
    const matchStatus =
      selectedStatus === 'All' ||
      (selectedStatus === 'LOW' && isLow) ||
      (selectedStatus === 'HEALTHY' && !isLow);

    return matchSearch && matchCategory && matchStatus;
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
  const totalSKUs = sorted.length;
  const totalValuation = sorted.reduce(
    (s, i) => s + (i.currentStock || 0) * (i.unitPrice || 0),
    0
  );
  const lowStockCount = sorted.filter(
    i => (i.currentStock || 0) <= (i.minStockLevel || 0)
  ).length;

  const exportData = sorted.map(i => ({
    ItemCode: i.id,
    ItemName: i.itemName,
    Category: i.category,
    CurrentStock: i.currentStock || 0,
    UnitOfMeasure: i.unit,
    UnitPriceUSD: `$${(i.unitPrice || 0).toFixed(2)}`,
    TotalValueUSD: `$${((i.currentStock || 0) * (i.unitPrice || 0)).toFixed(2)}`,
    MinStockLevel: i.minStockLevel || 0,
    BinLocation: i.location || 'General Rack',
    Status: (i.currentStock || 0) <= (i.minStockLevel || 0) ? 'LOW STOCK ALERT' : 'HEALTHY'
  }));

  return (
    <div className="space-y-6">
      <ReportPrintHeader
        title="STORE INVENTORY & RAW MATERIAL VALUATION STATEMENT"
        subtitle="Official Stock Ledger, Warehouse Valuation & Reorder Alert Log"
        department="Store"
        filtersSummary={[
          `Category: ${selectedCategory}`,
          `Status: ${selectedStatus}`,
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
              placeholder="Search SKU, Item Name, Bin Rack..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-blue-600 w-56"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Categories ({categories.length})</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
          >
            <option value="All">All Stock Health</option>
            <option value="HEALTHY">Healthy Stock Only</option>
            <option value="LOW">Low Stock Alerts Only</option>
          </select>

          {(selectedCategory !== 'All' || selectedStatus !== 'All' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory('All');
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
          title="Store_Inventory_Report"
          filename="MJAL_Store_Report"
          data={exportData}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-3 sm:p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex items-center justify-between min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 truncate">Active Material SKUs</p>
            <h3 className="text-base sm:text-xl font-black text-slate-900 mt-0.5 sm:mt-1 truncate">{totalSKUs} Items</h3>
          </div>
          <Warehouse className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 opacity-80 shrink-0 ml-2" />
        </div>

        <div className="p-3 sm:p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-xs flex items-center justify-between min-w-0">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800 truncate">Total Stock Valuation</p>
            <h3 className="text-base sm:text-xl font-black text-emerald-900 mt-0.5 sm:mt-1 truncate">
              ${(totalValuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600 opacity-80 shrink-0 ml-2" />
        </div>

        <div className={`col-span-2 sm:col-span-1 p-3 sm:p-4 rounded-xl border shadow-xs flex items-center justify-between min-w-0 ${lowStockCount > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 truncate">Reorder Alert Items</p>
            <h3 className={`text-base sm:text-xl font-black mt-0.5 sm:mt-1 truncate ${lowStockCount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
              {lowStockCount} SKUs Low
            </h3>
          </div>
          <AlertTriangle className={`h-6 w-6 sm:h-8 sm:w-8 shrink-0 ml-2 ${lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Material Inventory & Storage Ledger ({sorted.length} SKUs)
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            Click column headers to sort
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                <th onClick={() => handleSort('id')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Item Code <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('itemName')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Item Description <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('category')} className="p-3 cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center gap-1">Category <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th onClick={() => handleSort('currentStock')} className="p-3 text-right cursor-pointer hover:bg-slate-200">
                  <div className="flex items-center justify-end gap-1">Current Stock <ArrowUpDown className="h-3 w-3" /></div>
                </th>
                <th className="p-3 text-right">Min Level</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-right">Stock Valuation</th>
                <th className="p-3">Bin Location</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    No matching store stock items found.
                  </td>
                </tr>
              ) : (
                sorted.map(i => {
                  const stock = i.currentStock || 0;
                  const price = i.unitPrice || 0;
                  const val = stock * price;
                  const isLow = stock <= (i.minStockLevel || 0);
                  return (
                    <tr key={i.id} className={`hover:bg-slate-50 transition ${isLow ? 'bg-amber-50/30' : ''}`}>
                      <td className="p-3 font-mono font-bold text-slate-800">{i.id}</td>
                      <td className="p-3 font-bold text-blue-700">{i.itemName}</td>
                      <td className="p-3 text-slate-700">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold">
                          {i.category}
                        </span>
                      </td>
                      <td className="p-3 text-right font-black text-slate-900">
                        {stock.toLocaleString()} {i.unit}
                      </td>
                      <td className="p-3 text-right text-slate-500 font-medium">{(i.minStockLevel || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-slate-700">${price.toFixed(2)}</td>
                      <td className="p-3 text-right font-black text-emerald-800">
                        ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-slate-600 font-medium">{i.location}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isLow ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800'}`}>
                          {isLow ? 'Low Alert' : 'Healthy'}
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
                  <td colSpan={6} className="p-3 uppercase text-slate-700">Total Store Valuation:</td>
                  <td className="p-3 text-right text-emerald-900 font-black">
                    ${(totalValuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
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
