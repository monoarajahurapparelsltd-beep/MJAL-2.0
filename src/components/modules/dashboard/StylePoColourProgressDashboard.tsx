import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Search,
  Filter,
  Scissors,
  Shirt,
  Waves,
  Sparkles,
  ClipboardCheck,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  X,
  Building2,
  TrendingUp,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Info,
  Send,
  ArrowRight
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { StatusBadge } from '../../common/StatusBadge';
import { Modal } from '../../common/Modal';
import { ProductionPipelineVisualizer } from '../../common/ProductionPipelineVisualizer';
import { DepartmentTransferQueue } from '../../common/DepartmentTransferQueue';
import { TransferChallanModal } from '../../common/TransferChallanModal';

interface Props {
  embedded?: boolean;
  title?: string;
  subtitle?: string;
  readOnly?: boolean;
}

export const StylePoColourProgressDashboard: React.FC<Props> = ({
  embedded = false,
  title = 'Master Style / PO / Colour WIP & Production Dashboard',
  subtitle = 'Live End-to-End Departmental Pipeline Tracking & Handover Routing',
  readOnly = false
}) => {
  const [progressList, setProgressList] = useState(supabaseDataService.getAllMasterProgress());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('All');
  const [selectedStyle, setSelectedStyle] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWashRoute, setSelectedWashRoute] = useState<'All' | 'Wash' | 'Non-Wash'>('All');
  const [selectedStage, setSelectedStage] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [viewMode, setViewMode] = useState<'table' | 'transfers'>('table');
  const [detailItem, setDetailItem] = useState<ReturnType<typeof supabaseDataService.getStylePoColourProgress> | null>(null);

  // Quick Transfer Modal State from Table row
  const [transferModalData, setTransferModalData] = useState<{
    isOpen: boolean;
    fromDept: 'Cutting' | 'Sewing' | 'Washing' | 'Finishing' | 'Packing';
    toDept: 'Sewing' | 'Washing' | 'Finishing' | 'Packing' | 'Shipment';
    styleNo: string;
    poNo: string;
    colour: string;
    maxQty: number;
  }>({
    isOpen: false,
    fromDept: 'Cutting',
    toDept: 'Sewing',
    styleNo: '',
    poNo: '',
    colour: '',
    maxQty: 0
  });

  const refreshData = () => {
    setProgressList([...supabaseDataService.getAllMasterProgress()]);
  };

  useEffect(() => {
    refreshData();
    const unsub = supabaseDataService.subscribe(refreshData);
    return unsub;
  }, []);

  // Filter options
  const uniqueBuyers = useMemo(() => {
    return Array.from(new Set(progressList.map(p => p.buyer).filter(Boolean)));
  }, [progressList]);

  const uniqueStyles = useMemo(() => {
    return Array.from(new Set(progressList.map(p => p.styleNo).filter(Boolean)));
  }, [progressList]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(progressList.map(p => p.garmentType).filter(Boolean)));
  }, [progressList]);

  // Filtered list
  const filteredList = useMemo(() => {
    return progressList.filter(item => {
      if (selectedBuyer !== 'All' && item.buyer !== selectedBuyer) return false;
      if (selectedStyle !== 'All' && item.styleNo !== selectedStyle) return false;
      if (selectedCategory !== 'All' && item.garmentType !== selectedCategory) return false;
      if (selectedStatus !== 'All' && item.orderStatus !== selectedStatus) return false;

      if (selectedWashRoute === 'Wash' && !item.isWashGarment) return false;
      if (selectedWashRoute === 'Non-Wash' && item.isWashGarment) return false;

      if (selectedStage !== 'All') {
        if (selectedStage === 'Cutting' && (item.cutQty === 0 || item.cutBalance > 0)) return true;
        if (selectedStage === 'ReadyForSew' && (item.readyForSewingQty > 0)) return true;
        if (selectedStage === 'Sewing' && (item.sewOutput < item.orderQty && item.sewOutput > 0)) return true;
        if (selectedStage === 'ReadyForWash' && (item.readyForWashQty > 0)) return true;
        if (selectedStage === 'Washing' && item.washWip > 0) return true;
        if (selectedStage === 'ReadyForFinishing' && (item.readyForDirectFinishingQty > 0 || item.readyFromWashForFinishingQty > 0)) return true;
        if (selectedStage === 'Finishing' && (item.finQty < item.orderQty && item.finQty > 0)) return true;
        if (selectedStage === 'QC' && item.qcPassedQty < item.orderQty) return true;
        if (selectedStage === 'Packing' && item.packBalance > 0) return true;
        if (selectedStage === 'ReadyToShip' && item.readyForShipmentQty > 0) return true;
        if (selectedStage === 'Shipped' && item.shippedQty >= item.orderQty && item.orderQty > 0) return true;
        return false;
      }

      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const match =
          (item.styleNo || '').toLowerCase().includes(q) ||
          (item.poNo || '').toLowerCase().includes(q) ||
          (item.colour || '').toLowerCase().includes(q) ||
          (item.buyer || '').toLowerCase().includes(q) ||
          (item.garmentType && item.garmentType.toLowerCase().includes(q)) ||
          (item.styleName || '').toLowerCase().includes(q) ||
          (item.currentStage || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [progressList, selectedBuyer, selectedStyle, selectedCategory, selectedWashRoute, selectedStage, selectedStatus, searchQuery]);

  // Totals calculations
  const totalOrderQty = filteredList.reduce((s, i) => s + (i.orderQty || 0), 0);
  const totalCutQty = filteredList.reduce((s, i) => s + (i.cutQty || 0), 0);
  const totalReadyForSew = filteredList.reduce((s, i) => s + (i.readyForSewingQty || 0), 0);
  const totalSewOutput = filteredList.reduce((s, i) => s + (i.sewOutput || 0), 0);
  const totalReadyForWash = filteredList.reduce((s, i) => s + (i.readyForWashQty || 0), 0);
  const totalReadyForFinDirect = filteredList.reduce((s, i) => s + (i.readyForDirectFinishingQty || 0), 0);
  const totalWashOutput = filteredList.reduce((s, i) => s + (i.washReceivedQty || 0), 0);
  const totalReadyFromWash = filteredList.reduce((s, i) => s + (i.readyFromWashForFinishingQty || 0), 0);
  const totalFinOutput = filteredList.reduce((s, i) => s + (i.finQty || 0), 0);
  const totalQCPassed = filteredList.reduce((s, i) => s + (i.qcPassedQty || 0), 0);
  const totalReadyForPack = filteredList.reduce((s, i) => s + (i.readyForPackingQty || 0), 0);
  const totalPacked = filteredList.reduce((s, i) => s + (i.packedQty || 0), 0);
  const totalReadyToShip = filteredList.reduce((s, i) => s + (i.readyForShipmentQty || 0), 0);
  const totalShipped = filteredList.reduce((s, i) => s + (i.shippedQty || 0), 0);
  const totalBalanceToShip = Math.max(0, totalOrderQty - totalShipped);
  const overallShipmentPercent = totalOrderQty > 0 ? Math.round((totalShipped / totalOrderQty) * 100) : 0;

  const handleOpenTransfer = (item: typeof progressList[0]) => {
    let fromDept: 'Cutting' | 'Sewing' | 'Washing' | 'Finishing' | 'Packing' = 'Cutting';
    let toDept: 'Sewing' | 'Washing' | 'Finishing' | 'Packing' | 'Shipment' = 'Sewing';
    let maxQty = item.readyForSewingQty || 0;

    if (item.readyForSewingQty > 0) {
      fromDept = 'Cutting';
      toDept = 'Sewing';
      maxQty = item.readyForSewingQty;
    } else if (item.isWashGarment && item.readyForWashQty > 0) {
      fromDept = 'Sewing';
      toDept = 'Washing';
      maxQty = item.readyForWashQty;
    } else if (!item.isWashGarment && item.readyForDirectFinishingQty > 0) {
      fromDept = 'Sewing';
      toDept = 'Finishing';
      maxQty = item.readyForDirectFinishingQty;
    } else if (item.isWashGarment && item.readyFromWashForFinishingQty > 0) {
      fromDept = 'Washing';
      toDept = 'Finishing';
      maxQty = item.readyFromWashForFinishingQty;
    } else if (item.readyForPackingQty > 0) {
      fromDept = 'Finishing';
      toDept = 'Packing';
      maxQty = item.readyForPackingQty;
    } else if (item.readyForShipmentQty > 0) {
      fromDept = 'Packing';
      toDept = 'Shipment';
      maxQty = item.readyForShipmentQty;
    }

    setTransferModalData({
      isOpen: true,
      fromDept,
      toDept,
      styleNo: item.styleNo,
      poNo: item.poNo,
      colour: item.colour,
      maxQty: maxQty > 0 ? maxQty : item.orderQty
    });
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-sm border border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Executive Production Monitor</span>
            </div>
            <h1 className="text-lg font-black tracking-tight mt-0.5">{title}</h1>
            <p className="text-[11px] text-slate-300 mt-0.5">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTransferModalData({
                  isOpen: true,
                  fromDept: 'Cutting',
                  toDept: 'Sewing',
                  styleNo: '',
                  poNo: '',
                  colour: '',
                  maxQty: 0
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-xs transition"
            >
              <Send className="h-3.5 w-3.5" />
              <span>+ Issue Challan</span>
            </button>
            <button
              onClick={refreshData}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
              title="Refresh Live Data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
            <ExportPrintToolbar title="Style PO Colour Master WIP Report" data={filteredList} filename="Master_Style_PO_Colour_Status" />
          </div>
        </div>
      )}

      {/* Aggregate KPI Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Order</span>
          <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">{(totalOrderQty || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">pcs</span></p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{filteredList.length} Active Lines</span>
        </div>

        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-400">1. Cutting</span>
            <Scissors className="h-3 w-3 text-blue-500 dark:text-blue-400" />
          </div>
          <p className="text-sm font-black text-blue-700 dark:text-blue-300 mt-0.5">{(totalCutQty || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">pcs</span></p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{totalOrderQty > 0 ? Math.round((totalCutQty / totalOrderQty) * 100) : 0}% Cut</span>
        </div>

        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-indigo-600 dark:text-indigo-400">2. Sewing</span>
            <Shirt className="h-3 w-3 text-indigo-500 dark:text-indigo-400" />
          </div>
          <p className="text-sm font-black text-indigo-700 dark:text-indigo-300 mt-0.5">{(totalSewOutput || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">pcs</span></p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{totalOrderQty > 0 ? Math.round((totalSewOutput / totalOrderQty) * 100) : 0}% Sewed</span>
        </div>

        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-cyan-600 dark:text-cyan-400">3. Washing</span>
            <Waves className="h-3 w-3 text-cyan-500 dark:text-cyan-400" />
          </div>
          <p className="text-sm font-black text-cyan-800 dark:text-cyan-300 mt-0.5">{(totalWashOutput || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">pcs</span></p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Wash Rec: {(totalWashOutput || 0).toLocaleString()}</span>
        </div>

        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-sky-600 dark:text-sky-400">4. Finishing</span>
            <Sparkles className="h-3 w-3 text-sky-500 dark:text-sky-400" />
          </div>
          <p className="text-sm font-black text-sky-800 dark:text-sky-300 mt-0.5">{(totalFinOutput || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">pcs</span></p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{totalOrderQty > 0 ? Math.round((totalFinOutput / totalOrderQty) * 100) : 0}% Finished</span>
        </div>

        <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400">5. Packed</span>
            <Package className="h-3 w-3 text-amber-500 dark:text-amber-400" />
          </div>
          <p className="text-sm font-black text-amber-700 dark:text-amber-300 mt-0.5">{(totalPacked || 0).toLocaleString()} <span className="text-[10px] font-normal text-slate-500">pcs</span></p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{totalOrderQty > 0 ? Math.round((totalPacked / totalOrderQty) * 100) : 0}% Packed</span>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold text-emerald-800 dark:text-emerald-300">6. Shipped</span>
            <Truck className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-black text-emerald-900 dark:text-emerald-200 mt-0.5">{(totalShipped || 0).toLocaleString()} <span className="text-[10px] font-normal text-emerald-700 dark:text-emerald-400">pcs</span></p>
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{overallShipmentPercent}% Shipped</span>
        </div>

        <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 shadow-xs">
          <span className="text-[9px] uppercase font-bold text-rose-800 dark:text-rose-300 block">Balance to Ship</span>
          <p className="text-sm font-black text-rose-900 dark:text-rose-200 mt-0.5">{(totalBalanceToShip || 0).toLocaleString()} <span className="text-[10px] font-normal text-rose-700 dark:text-rose-400">pcs</span></p>
          <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Pending Delivery</span>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Style No, PO No, Colour, Buyer, Garment Type..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Buyer Filter */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Buyer:</span>
              <select
                value={selectedBuyer}
                onChange={e => setSelectedBuyer(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="All" className="dark:bg-slate-800">All Buyers</option>
                {uniqueBuyers.map(b => (
                  <option key={b} value={b} className="dark:bg-slate-800">{b}</option>
                ))}
              </select>
            </div>

            {/* Style Filter */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Style:</span>
              <select
                value={selectedStyle}
                onChange={e => setSelectedStyle(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="All" className="dark:bg-slate-800">All Styles</option>
                {uniqueStyles.map(s => (
                  <option key={s} value={s} className="dark:bg-slate-800">{s}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Item:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="All" className="dark:bg-slate-800">All Categories</option>
                {uniqueCategories.map(c => (
                  <option key={c} value={c} className="dark:bg-slate-800">{c}</option>
                ))}
              </select>
            </div>

            {/* Wash Route Filter */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Route:</span>
              <select
                value={selectedWashRoute}
                onChange={e => setSelectedWashRoute(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="All" className="dark:bg-slate-800">All Pipelines</option>
                <option value="Wash" className="dark:bg-slate-800">Wash Garments (Requires Washing)</option>
                <option value="Non-Wash" className="dark:bg-slate-800">Non-Wash (Direct Sewing → Finishing)</option>
              </select>
            </div>

            {/* Department Stage Filter */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Stage:</span>
              <select
                value={selectedStage}
                onChange={e => setSelectedStage(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="All" className="dark:bg-slate-800">All Stages</option>
                <option value="Cutting" className="dark:bg-slate-800">Cutting Pending</option>
                <option value="ReadyForSew" className="dark:bg-slate-800">Ready For Sewing (Cut Available)</option>
                <option value="Sewing" className="dark:bg-slate-800">Sewing in Progress</option>
                <option value="ReadyForWash" className="dark:bg-slate-800">Ready For Wash Handover</option>
                <option value="Washing" className="dark:bg-slate-800">Washing WIP</option>
                <option value="ReadyForFinishing" className="dark:bg-slate-800">Ready For Finishing</option>
                <option value="Finishing" className="dark:bg-slate-800">Finishing WIP</option>
                <option value="QC" className="dark:bg-slate-800">QC Inspection</option>
                <option value="Packing" className="dark:bg-slate-800">Packing Pending</option>
                <option value="ReadyToShip" className="dark:bg-slate-800">Ready to Ship</option>
                <option value="Shipped" className="dark:bg-slate-800">Fully Shipped</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                Table View
              </button>
              <button
                onClick={() => setViewMode('transfers')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition flex items-center gap-1 ${viewMode === 'transfers' ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                <Send className="h-3 w-3" />
                <span>Handover & Gate Passes</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Table View */}
      {viewMode === 'table' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                  <th className="p-3">Buyer & Style</th>
                  <th className="p-3">PO & Colour</th>
                  <th className="p-3">Garment / Routing</th>
                  <th className="p-3 text-right">Order Qty</th>
                  <th className="p-3 text-center">1. Cutting</th>
                  <th className="p-3 text-center">2. Sewing</th>
                  <th className="p-3 text-center">3. Washing</th>
                  <th className="p-3 text-center">4. Finishing</th>
                  <th className="p-3 text-center">5. Packing</th>
                  <th className="p-3 text-center">6. Shipment</th>
                  <th className="p-3">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-200">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 text-xs font-medium">
                      No matching Style / PO / Colour records found.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item, idx) => {
                    const isCompleted = item.shippedQty >= item.orderQty && item.orderQty > 0;
                    const isPending = item.cutQty === 0 && item.sewOutput === 0;

                    return (
                      <tr
                        key={`${item.styleNo}-${item.poNo}-${item.colour}-${idx}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        {/* Buyer & Style */}
                        <td className="p-3">
                          <div className="font-extrabold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                            {item.styleNo}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">{item.buyer}</div>
                          <div className="text-[10px] text-slate-400">{item.styleName}</div>
                        </td>

                        {/* PO & Colour */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">PO: {item.poNo}</div>
                          <div className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-800 dark:text-slate-200">
                            {item.colour}
                          </div>
                          {item.deliveryDate && (
                            <div className="text-[9px] text-slate-400 mt-0.5">Del: {item.deliveryDate}</div>
                          )}
                        </td>

                        {/* Garment / Routing */}
                        <td className="p-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{item.garmentType || 'Garment'}</div>
                          {item.isWashGarment ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-0.5 rounded bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-[9px] font-bold text-cyan-800 dark:text-cyan-300">
                              <Waves className="h-2.5 w-2.5" />
                              Wash Garment
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                              <Sparkles className="h-2.5 w-2.5" />
                              Direct Non-Wash
                            </span>
                          )}
                        </td>

                        {/* Order Qty */}
                        <td className="p-3 text-right">
                          <span className="font-black text-slate-900 dark:text-slate-100">{(item.orderQty || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400 block">pcs</span>
                        </td>

                        {/* Cutting */}
                        <td className="p-3 text-center">
                          <div className="font-bold text-blue-700 dark:text-blue-400">{(item.cutQty || 0).toLocaleString()}</div>
                          <div className="text-[10px]">
                            {item.readyForSewingQty > 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold block" title="Ready to hand over to Sewing">
                                Ready: {item.readyForSewingQty}
                              </span>
                            ) : item.cutBalance > 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium block">Bal: {item.cutBalance}</span>
                            ) : (
                              <span className="text-slate-400 block">Done</span>
                            )}
                          </div>
                        </td>

                        {/* Sewing */}
                        <td className="p-3 text-center">
                          <div className="font-bold text-indigo-700 dark:text-indigo-400">{(item.sewOutput || 0).toLocaleString()}</div>
                          <div className="text-[10px]">
                            {item.isWashGarment ? (
                              item.readyForWashQty > 0 ? (
                                <span className="text-cyan-700 dark:text-cyan-400 font-bold block" title="Sewed and ready for Wash handover">
                                  For Wash: {item.readyForWashQty}
                                </span>
                              ) : (
                                <span className="text-slate-400 block">WIP: {item.sewWip}</span>
                              )
                            ) : item.readyForDirectFinishingQty > 0 ? (
                              <span className="text-sky-700 dark:text-sky-400 font-bold block" title="Direct to Finishing ready">
                                For Fin: {item.readyForDirectFinishingQty}
                              </span>
                            ) : (
                              <span className="text-slate-400 block">WIP: {item.sewWip}</span>
                            )}
                          </div>
                        </td>

                        {/* Washing */}
                        <td className="p-3 text-center">
                          {item.isWashGarment ? (
                            <>
                              <div className="font-bold text-cyan-800 dark:text-cyan-300">{(item.washReceivedQty || 0).toLocaleString()}</div>
                              <div className="text-[10px]">
                                {item.readyFromWashForFinishingQty > 0 ? (
                                  <span className="text-emerald-700 dark:text-emerald-400 font-bold block" title="Washed and ready for Finishing">
                                    For Fin: {item.readyFromWashForFinishingQty}
                                  </span>
                                ) : item.washWip > 0 ? (
                                  <span className="text-cyan-600 dark:text-cyan-400 font-medium block">In Wash: {item.washWip}</span>
                                ) : (
                                  <span className="text-slate-400 block">Sent: {item.washSentQty}</span>
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Bypassed (Non-Wash)</span>
                          )}
                        </td>

                        {/* Finishing */}
                        <td className="p-3 text-center">
                          <div className="font-bold text-sky-800 dark:text-sky-300">{(item.finQty || 0).toLocaleString()}</div>
                          <div className="text-[10px]">
                            {item.readyForPackingQty > 0 ? (
                              <span className="text-amber-700 dark:text-amber-400 font-bold block" title="Finished & ready for Packing">
                                For Pack: {item.readyForPackingQty}
                              </span>
                            ) : item.finWip > 0 ? (
                              <span className="text-sky-600 dark:text-sky-400 font-medium block">WIP: {item.finWip}</span>
                            ) : (
                              <span className="text-slate-400 block">Bal: {item.finBalance}</span>
                            )}
                          </div>
                        </td>

                        {/* Packing */}
                        <td className="p-3 text-center">
                          <div className="font-bold text-amber-700 dark:text-amber-400">{(item.packedQty || 0).toLocaleString()}</div>
                          <div className="text-[10px]">
                            {item.readyForShipmentQty > 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold block" title="Cartoned & ready to ship">
                                Ready: {item.readyForShipmentQty}
                              </span>
                            ) : (
                              <span className="text-slate-400 block">{item.cartonCount} ctn</span>
                            )}
                          </div>
                        </td>

                        {/* Shipment */}
                        <td className="p-3 text-center">
                          <div className="font-black text-emerald-700 dark:text-emerald-400">{(item.shippedQty || 0).toLocaleString()}</div>
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{item.shipmentPercentage}%</div>
                        </td>

                        {/* Current Status Badge */}
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : isPending
                              ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-750'
                              : item.shippedQty > 0
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : item.packedQty >= item.orderQty && item.orderQty > 0
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          }`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                            {item.currentStage}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Handover & Gate Pass Queue View */}
      {viewMode === 'transfers' && (
        <DepartmentTransferQueue
          department="All"
          title="Factory-Wide Inter-Departmental Delivery & Gate Pass Hub"
        />
      )}

      {/* Drill-down Detail Modal with Pipeline Visualizer */}
      {detailItem && (
        <Modal
          isOpen={Boolean(detailItem)}
          onClose={() => setDetailItem(null)}
          title={`End-to-End Pipeline Tracking: ${detailItem.styleNo} (PO: ${detailItem.poNo} - ${detailItem.colour})`}
          size="xl"
        >
          <div className="space-y-4 text-xs">
            {/* Header info */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Order Routing Profile</span>
                  {detailItem.isWashGarment ? (
                    <span className="px-2 py-0.5 rounded bg-cyan-900/60 border border-cyan-500/50 text-[10px] text-cyan-300 font-bold">
                      Requires Washing (Sewing → Wash → Finishing)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-500/50 text-[10px] text-amber-300 font-bold">
                      Direct Non-Wash (Sewing → Finishing)
                    </span>
                  )}
                </div>
                <h3 className="text-base font-black mt-1">{detailItem.styleNo} — {detailItem.buyer}</h3>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  PO: {detailItem.poNo} | Colour: <strong className="text-white">{detailItem.colour}</strong> | Total Order Qty: <strong className="text-emerald-400">{(detailItem.orderQty || 0).toLocaleString()} pcs</strong>
                </p>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 text-right">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Shipment Status</span>
                  <span className="text-sm font-black text-emerald-400">{detailItem.shipmentPercentage}% Shipped</span>
                  <span className="text-[10px] text-slate-300 block">{(detailItem.shippedQty || 0).toLocaleString()} / {(detailItem.orderQty || 0).toLocaleString()} pcs</span>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => handleOpenTransfer(detailItem)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition shadow-xs"
                  >
                    <Send className="h-3 w-3" />
                    <span>Issue Handover Challan</span>
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Visual Pipeline with Live Balance Nodes */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Interactive Production Flow & Handover Gateways</span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Live Stage Routing</span>
              </h4>
              <ProductionPipelineVisualizer
                styleNo={detailItem.styleNo}
                poNo={detailItem.poNo}
                colour={detailItem.colour}
                onTransferRequested={(from, to, maxQ) => {
                  setTransferModalData({
                    isOpen: true,
                    fromDept: from as any,
                    toDept: to as any,
                    styleNo: detailItem.styleNo,
                    poNo: detailItem.poNo,
                    colour: detailItem.colour,
                    maxQty: maxQ
                  });
                }}
              />
            </div>

            {/* Department Milestone Balances */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase block">1. Cutting Status</span>
                <p className="text-sm font-black text-blue-900 dark:text-blue-200 mt-1">{(detailItem.cutQty || 0).toLocaleString()} pcs</p>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 space-y-0.5">
                  <div>Ready for Sewing: <strong className="text-emerald-700 dark:text-emerald-400">{detailItem.readyForSewingQty} pcs</strong></div>
                  <div>Shortage/Bal: <strong>{detailItem.cutBalance} pcs</strong></div>
                  <div>Bundles: <strong>{detailItem.bundleCount}</strong></div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase block">2. Sewing Status</span>
                <p className="text-sm font-black text-indigo-900 dark:text-indigo-200 mt-1">{(detailItem.sewOutput || 0).toLocaleString()} pcs</p>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 space-y-0.5">
                  <div>Input Received: <strong>{detailItem.sewInputs} pcs</strong></div>
                  <div>Sewing WIP: <strong>{detailItem.sewWip} pcs</strong></div>
                  {detailItem.isWashGarment ? (
                    <div>Ready for Wash: <strong className="text-cyan-700 dark:text-cyan-400">{detailItem.readyForWashQty} pcs</strong></div>
                  ) : (
                    <div>Ready for Finishing: <strong className="text-sky-700 dark:text-sky-400">{detailItem.readyForDirectFinishingQty} pcs</strong></div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800">
                <span className="text-[10px] font-bold text-cyan-800 dark:text-cyan-300 uppercase block">3. Washing & Finishing</span>
                <p className="text-sm font-black text-cyan-900 dark:text-cyan-200 mt-1">{(detailItem.finQty || 0).toLocaleString()} pcs</p>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 space-y-0.5">
                  {detailItem.isWashGarment ? (
                    <>
                      <div>Wash Received: <strong>{detailItem.washReceivedQty} pcs</strong></div>
                      <div>Ready from Wash: <strong className="text-emerald-700 dark:text-emerald-400">{detailItem.readyFromWashForFinishingQty} pcs</strong></div>
                    </>
                  ) : (
                    <div className="text-slate-500 dark:text-slate-400 italic">Wash Bypassed (Non-Wash)</div>
                  )}
                  <div>Finishing WIP: <strong>{detailItem.finWip} pcs</strong></div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">4. QC, Packing & Shipping</span>
                <p className="text-sm font-black text-emerald-900 dark:text-emerald-200 mt-1">{(detailItem.shippedQty || 0).toLocaleString()} pcs</p>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 space-y-0.5">
                  <div>QC Pass Rate: <strong>{detailItem.qcPassRate}%</strong></div>
                  <div>Packed: <strong>{detailItem.packedQty} pcs ({detailItem.cartonCount} ctn)</strong></div>
                  <div>Balance to Ship: <strong className="text-rose-600 dark:text-rose-400">{detailItem.shipBalance} pcs</strong></div>
                </div>
              </div>
            </div>

            {/* Department Logs Breakdown */}
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">Associated Department Logs</h4>

              {/* Cutting Logs */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between text-xs">
                  <span>Cutting Batches ({detailItem.records.cuts.length})</span>
                  <span>Total Cut: {detailItem.cutQty} pcs</span>
                </div>
                <div className="p-2 max-h-28 overflow-y-auto space-y-1 bg-white dark:bg-slate-900">
                  {detailItem.records.cuts.length === 0 ? (
                    <p className="text-slate-400 text-xs italic">No cutting records entered yet.</p>
                  ) : (
                    detailItem.records.cuts.map(c => (
                      <div key={c.id} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="text-slate-600 dark:text-slate-400">{c.date} • Operator: {c.operator}</span>
                        <span className="font-bold text-blue-700 dark:text-blue-400">{(c.cutQty || 0).toLocaleString()} pcs ({c.bundleCount} bundles)</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sewing Logs */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between text-xs">
                  <span>Sewing Line Productions ({detailItem.records.sews.length})</span>
                  <span>Total Output: {detailItem.sewOutput} pcs</span>
                </div>
                <div className="p-2 max-h-28 overflow-y-auto space-y-1 bg-white dark:bg-slate-900">
                  {detailItem.records.sews.length === 0 ? (
                    <p className="text-slate-400 text-xs italic">No sewing records entered yet.</p>
                  ) : (
                    detailItem.records.sews.map(s => (
                      <div key={s.id} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="text-slate-600 dark:text-slate-400">{s.date} • {s.lineNo}</span>
                        <span className="font-bold text-indigo-700 dark:text-indigo-400">Output: {(s.totalOutput || 0).toLocaleString()} pcs | Target: {s.dailyTarget}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailItem(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Transfer & Gate Pass Challan Modal */}
      {transferModalData.isOpen && (
        <TransferChallanModal
          isOpen={transferModalData.isOpen}
          onClose={() => setTransferModalData(prev => ({ ...prev, isOpen: false }))}
          fromDepartment={transferModalData.fromDept}
          toDepartment={transferModalData.toDept}
          initialStyleNo={transferModalData.styleNo}
          initialPoNo={transferModalData.poNo}
          initialColour={transferModalData.colour}
          maxAvailableQty={transferModalData.maxQty}
          onTransferComplete={() => {
            refreshData();
            if (detailItem) {
              setDetailItem(supabaseDataService.getStylePoColourProgress(detailItem.styleNo, detailItem.poNo, detailItem.colour));
            }
          }}
        />
      )}
    </div>
  );
};
