import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Shirt,
  Truck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Scissors,
  ClipboardCheck,
  Building2,
  Factory,
  Filter,
  DollarSign,
  Coins,
  Percent,
  Calculator,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { useAuth } from '../../../context/AuthContext';
import { canViewExecutiveOrderSummary } from '../../../utils/authUtils';
import { StatCard } from '../../common/StatCard';
import { StatusBadge } from '../../common/StatusBadge';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { StylePoColourProgressDashboard } from './StylePoColourProgressDashboard';
import { formatBDT, USD_TO_BDT_RATE } from '../../../utils/currencyUtils';
import { calculateOrdersAllowanceSummary, calculateSingleOrderAllowance } from '../../../utils/allowanceUtils';

export const MainDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState(supabaseDataService.getOrders());
  const [sewing, setSewing] = useState(supabaseDataService.getSewingProduction());
  const [cutting, setCutting] = useState(supabaseDataService.getCuttingEntries());
  const [shipments, setShipments] = useState(supabaseDataService.getShipmentRecords());
  const [qc, setQc] = useState(supabaseDataService.getQCInspections());

  const [selectedBuyer, setSelectedBuyer] = useState('All');
  const [selectedStyle, setSelectedStyle] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  useEffect(() => {
    const updateState = () => {
      setOrders([...supabaseDataService.getOrders()]);
      setSewing([...supabaseDataService.getSewingProduction()]);
      setCutting([...supabaseDataService.getCuttingEntries()]);
      setShipments([...supabaseDataService.getShipmentRecords()]);
      setQc([...supabaseDataService.getQCInspections()]);
    };

    updateState();
    const unsub = supabaseDataService.subscribe(updateState);
    return unsub;
  }, []);

  // Metrics with Full Allowance & Valuation Calculations
  const allowanceSummary = useMemo(() => calculateOrdersAllowanceSummary(orders), [orders]);
  const {
    totalOrderQty,
    totalAllowanceQty,
    totalFactoryQty,
    totalOrderValueUSD,
    totalFactoryValueUSD,
    totalAllowanceValueUSD,
    totalOrderValueBDT,
    totalFactoryValueBDT,
    totalAllowanceValueBDT,
    overallAllowancePct,
    baseBdtFormatted,
    factoryBdtFormatted,
    allowanceBdtFormatted
  } = allowanceSummary;

  const totalRunningOrders = orders.filter(o => o.status === 'Running').length;

  // Total sewing output today
  const todaySewingOutput = sewing.reduce((sum, s) => sum + (s.totalOutput || 0), 0);
  const todaySewingTarget = sewing.reduce((sum, s) => sum + (s.dailyTarget || 0), 0);
  const sewingAchievement = todaySewingTarget > 0 ? Math.round((todaySewingOutput / todaySewingTarget) * 100) : 0;

  const totalShippedQty = shipments.reduce((sum, s) => sum + (s.shippedQty || 0), 0);
  const shipmentRate = totalOrderQty > 0 ? Math.round((totalShippedQty / totalOrderQty) * 100) : 0;

  // Average QC Pass rate
  const totalQCInspected = qc.reduce((sum, q) => sum + (q.inspectedQty || 0), 0);
  const totalQCPassed = qc.reduce((sum, q) => sum + (q.passedQty || 0), 0);
  const qcPassRate = totalQCInspected > 0 ? Math.round((totalQCPassed / totalQCInspected) * 100) : 100;

  // Filter options
  const uniqueBuyers = Array.from(new Set(orders.map(o => o.buyer))).filter(Boolean);
  const uniqueStyles = Array.from(new Set(orders.map(o => o.styleNo))).filter(Boolean);

  const filteredOrders = orders.filter(o => {
    if (selectedBuyer !== 'All' && o.buyer !== selectedBuyer) return false;
    if (selectedStyle !== 'All' && o.styleNo !== selectedStyle) return false;
    if (selectedStatus !== 'All' && o.status !== selectedStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-md border border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600/30 border border-blue-400/30 text-blue-400">
              <Factory className="h-3.5 w-3.5" />
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-300">Monoara Jahur Apparels Ltd.</span>
            <span className="rounded bg-blue-500/20 px-1.5 py-0.2 text-[8px] font-bold text-blue-300 border border-blue-400/30">MJAL ERP</span>
          </div>
          <h1 className="text-xl font-black tracking-tight mt-1 font-sans">Factory Operational Dashboard</h1>
          <p className="text-xs text-slate-300 mt-0.5 font-medium">Live Database Synchronized Order, Production & Progress Tracking</p>
        </div>
        <ExportPrintToolbar
          title="Main Factory Report"
          data={orders.map(o => {
            const single = calculateSingleOrderAllowance(o);
            return {
              StyleNo: o.styleNo,
              Buyer: o.buyer,
              GarmentType: o.garmentType,
              OrderQty: single.baseOrderQty,
              AllowanceQty: single.allowanceQty,
              AllowancePct: `${single.allowancePct}%`,
              FactoryOrderQty: single.factoryQty,
              BaseValueUSD: single.baseValueUSD,
              FactoryValueUSD: single.factoryValueUSD,
              AllowanceValueUSD: single.allowanceValueUSD,
              BaseValueBDT: single.baseValueBDT,
              FactoryValueBDT: single.factoryValueBDT,
              AllowanceValueBDT: single.allowanceValueBDT,
              Status: o.status
            };
          })}
          filename="factory_summary"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <StatCard
          title="Total Order Volume"
          value={`${totalOrderQty.toLocaleString()} pcs`}
          subtitle={`With Allowance: ${totalFactoryQty.toLocaleString()} pcs (+${totalAllowanceQty.toLocaleString()} pcs)`}
          trend={`+${overallAllowancePct}% Allw`}
          trendType="positive"
          icon={ShoppingBag}
          variant="blue"
        />
        <StatCard
          title="Order Value (BDT)"
          value={baseBdtFormatted.display}
          subtitle={`With Allw: ${factoryBdtFormatted.display} ($${totalFactoryValueUSD.toLocaleString()} USD)`}
          trend={`+${allowanceBdtFormatted.display} Allw`}
          trendType="neutral"
          icon={Coins}
          variant="amber"
        />
        <StatCard
          title="Daily Sewing Production"
          value={`${todaySewingOutput.toLocaleString()} pcs`}
          subtitle={`Target: ${todaySewingTarget.toLocaleString()} pcs (${sewingAchievement}%)`}
          trend={`${sewingAchievement}%`}
          trendType={sewingAchievement >= 90 ? 'positive' : 'negative'}
          icon={Shirt}
          variant="indigo"
        />
        <StatCard
          title="QC Inspection Pass Rate"
          value={`${qcPassRate}%`}
          subtitle={`Inspected: ${totalQCInspected} pcs | Passed: ${totalQCPassed} pcs`}
          trend={qcPassRate >= 95 ? 'High Quality' : 'Needs Rework'}
          trendType={qcPassRate >= 95 ? 'positive' : 'negative'}
          icon={ClipboardCheck}
          variant="emerald"
        />
        <StatCard
          title="Shipped Volume"
          value={`${totalShippedQty.toLocaleString()} pcs`}
          subtitle={`Shipment Rate: ${shipmentRate}%`}
          trend={`${shipmentRate}% Completed`}
          trendType="neutral"
          icon={Truck}
          variant="cyan"
        />
      </div>

      {/* Compact Allowance & Financial Breakdown Strip (ছোট করে Allowance সহ বিস্তারিত ভ্যালু) */}
      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 sm:p-3.5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
              <Coins className="h-3 w-3" />
            </div>
            <div>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Order Allowance & Commercial Valuation Breakdown
              </span>
              <span className="ml-2 text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                (Buyer Base vs. Factory Allowance vs. Total with Allowance)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60 w-fit">
            <span>Benchmark Rate: 1 USD = ৳{USD_TO_BDT_RATE} BDT</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 pt-2.5">
          {/* Box 1: Base Buyer Order */}
          <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/50">
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
              <span>1. Base Buyer Order</span>
              <span className="text-blue-600 dark:text-blue-400 font-extrabold">{orders.length} Styles</span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                {totalOrderQty.toLocaleString()} <span className="text-[9px] font-normal text-slate-500">pcs</span>
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                ${totalOrderValueUSD.toLocaleString()} <span className="text-[9px] font-normal text-slate-500">USD</span>
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-amber-700 dark:text-amber-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/40">
              <span>BDT Value:</span>
              <span title={baseBdtFormatted.fullAmount}>{baseBdtFormatted.display} ({baseBdtFormatted.fullAmount})</span>
            </div>
          </div>

          {/* Box 2: Factory Allowance */}
          <div className="p-2 sm:p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">
              <span>2. Factory Allowance</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-extrabold text-[8px]">
                +{overallAllowancePct}% Avg
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200">
                +{totalAllowanceQty.toLocaleString()} <span className="text-[9px] font-normal text-amber-700 dark:text-amber-400">pcs</span>
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-400">
                +${totalAllowanceValueUSD.toLocaleString()} <span className="text-[9px] font-normal text-slate-500">USD</span>
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-amber-800 dark:text-amber-300 pt-1 border-t border-amber-200/60 dark:border-amber-900/40">
              <span>Allowance BDT:</span>
              <span title={allowanceBdtFormatted.fullAmount}>+{allowanceBdtFormatted.display} ({allowanceBdtFormatted.fullAmount})</span>
            </div>
          </div>

          {/* Box 3: Total With Allowance */}
          <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40">
            <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-1">
              <span>3. Total With Allowance (সহ মোট)</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-extrabold text-[8px]">
                Grand Total
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-1 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-100">
                {totalFactoryQty.toLocaleString()} <span className="text-[9px] font-normal text-slate-500">pcs</span>
              </span>
              <span className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-300">
                ${totalFactoryValueUSD.toLocaleString()} <span className="text-[9px] font-normal text-slate-500">USD</span>
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] sm:text-[10px] font-black text-amber-800 dark:text-amber-300 pt-1 border-t border-emerald-200/60 dark:border-emerald-900/40">
              <span>Total BDT (Allowance সহ):</span>
              <span title={factoryBdtFormatted.fullAmount}>{factoryBdtFormatted.display} ({factoryBdtFormatted.fullAmount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Production Pipeline Progress per Style & PO (Management / Global Users Only) */}
      {canViewExecutiveOrderSummary(currentUser) && (
        <StylePoColourProgressDashboard
          embedded={true}
          title="Order & Production Progress Engine"
          subtitle="Live Department-wise Balance & Pipeline for Active Styles, POs & Colours"
        />
      )}
    </div>
  );
};


