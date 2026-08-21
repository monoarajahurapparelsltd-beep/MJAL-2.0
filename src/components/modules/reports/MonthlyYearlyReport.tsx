import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Building2,
  Filter,
  Scissors,
  Shirt,
  Waves,
  Sparkles,
  Box,
  Truck,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
  TrendingUp,
  Percent,
  Search,
  ArrowUpDown,
  Lock,
  DollarSign,
  Coins,
  FileSpreadsheet,
  BarChart3,
  Flame,
  AlertTriangle
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { useAuth } from '../../../context/AuthContext';
import {
  isGlobalUser,
  isMD,
  isManagement,
  isSuperAdmin,
  canViewExecutiveOrderSummary
} from '../../../utils/authUtils';
import {
  MONTH_NAMES,
  calculateDepartmentSummaries,
  calculateYearlyComparison,
  calculateStyleReport,
  calculatePOReport,
  calculateColourReport,
  calculateSizeReport,
  calculateDateWiseReport,
  DepartmentProductionSummary,
  MonthlyComparisonRow,
  StyleReportRow,
  POReportRow,
  ColourReportRow,
  SizeReportRow,
  DateWiseProductionRow
} from '../../../utils/monthlyYearlyReportUtils';
import { ReportPrintHeader, ReportPrintFooter } from './ReportPrintHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { StatCard } from '../../common/StatCard';
import { StatusBadge } from '../../common/StatusBadge';
import { formatBDT, USD_TO_BDT_RATE } from '../../../utils/currencyUtils';

type ReportViewTab =
  | 'summary'
  | 'detailed'
  | 'yearly_matrix'
  | 'style'
  | 'po'
  | 'colour'
  | 'size'
  | 'date';

export const MonthlyYearlyReport: React.FC = () => {
  const { currentUser } = useAuth();

  // Current calendar defaults
  const currentYear = 2026;
  const currentMonthIndex = 8; // August 2026

  // 1. FILTER STATES
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(currentMonthIndex);
  
  // Department filter based on RBAC
  const userDept = currentUser?.department || 'Cutting';
  const defaultDept = isGlobalUser(currentUser) ? 'All' : userDept;
  const [selectedDept, setSelectedDept] = useState<string>(defaultDept);
  
  // View mode
  const [activeTab, setActiveTab] = useState<ReportViewTab>('summary');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string>('orderQty');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Sync with live Supabase cache
  const [dataVersion, setDataVersion] = useState<number>(0);

  useEffect(() => {
    const unsub = supabaseDataService.subscribe(() => {
      setDataVersion(prev => prev + 1);
    });
    return unsub;
  }, []);

  // Enforce department lockdown for non-global department users
  useEffect(() => {
    if (!isGlobalUser(currentUser) && currentUser?.department) {
      setSelectedDept(currentUser.department);
    }
  }, [currentUser]);

  // Pull raw live datasets from Supabase service
  const orders = useMemo(() => supabaseDataService.getOrders(), [dataVersion]);
  const cuttingEntries = useMemo(() => supabaseDataService.getRawCuttingEntries(), [dataVersion]);
  const sewingProduction = useMemo(() => supabaseDataService.getRawSewingProduction(), [dataVersion]);
  const washingRecords = useMemo(() => supabaseDataService.getRawWashingRecords(), [dataVersion]);
  const finishingRecords = useMemo(() => supabaseDataService.getRawFinishingRecords(), [dataVersion]);
  const packingRecords = useMemo(() => supabaseDataService.getRawPackingRecords(), [dataVersion]);
  const shipmentRecords = useMemo(() => supabaseDataService.getShipmentRecords(), [dataVersion]);
  const transfers = useMemo(() => supabaseDataService.getTransfers(), [dataVersion]);

  // 2. CALCULATED PRODUCTION SUMMARIES (DYNAMIC FROM SUPABASE)
  const departmentSummaries: DepartmentProductionSummary[] = useMemo(() => {
    return calculateDepartmentSummaries({
      year: selectedYear,
      month: selectedMonth,
      orders,
      cuttingEntries,
      sewingProduction,
      washingRecords,
      finishingRecords,
      packingRecords,
      shipmentRecords,
      transfers
    });
  }, [
    selectedYear,
    selectedMonth,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    packingRecords,
    shipmentRecords,
    transfers
  ]);

  // Filter department summaries if specific department selected
  const filteredDeptSummaries = useMemo(() => {
    if (!selectedDept || selectedDept === 'All') return departmentSummaries;
    const target = selectedDept.toLowerCase();
    return departmentSummaries.filter(d =>
      d.department.toLowerCase().includes(target) || target.includes(d.department.toLowerCase())
    );
  }, [departmentSummaries, selectedDept]);

  // Overall consolidated metrics for this selected period
  const totalOrderQty = useMemo(() => {
    return departmentSummaries.length > 0 ? departmentSummaries[0].orderQty : 0;
  }, [departmentSummaries]);

  const totalProducedQty = useMemo(() => {
    // Sewing output is factory primary core throughput
    const sewDept = departmentSummaries.find(d => d.department === 'Sewing');
    const cutDept = departmentSummaries.find(d => d.department === 'Cutting');
    return sewDept?.producedQty || cutDept?.producedQty || 0;
  }, [departmentSummaries]);

  const totalReceivedQty = useMemo(() => {
    return departmentSummaries.reduce((sum, d) => sum + d.receivedQty, 0);
  }, [departmentSummaries]);

  const totalTransferQty = useMemo(() => {
    return departmentSummaries.reduce((sum, d) => sum + d.transferQty, 0);
  }, [departmentSummaries]);

  const totalRemainingQty = useMemo(() => {
    return Math.max(0, totalOrderQty - totalProducedQty);
  }, [totalOrderQty, totalProducedQty]);

  const totalPendingTransferQty = useMemo(() => {
    return departmentSummaries.reduce((sum, d) => sum + d.pendingQty, 0);
  }, [departmentSummaries]);

  const overallAchievement = useMemo(() => {
    return totalOrderQty > 0 ? Math.min(100, Math.round((totalProducedQty / totalOrderQty) * 100)) : 100;
  }, [totalProducedQty, totalOrderQty]);

  // Financial calculations for MD / Admin / GM
  const totalOrderValueUSD = useMemo(() => {
    return orders.reduce((sum, o) => sum + (o.totalOrderValue || 0), 0);
  }, [orders]);
  const totalOrderValueBDT = totalOrderValueUSD * USD_TO_BDT_RATE;
  const bdtFormatted = formatBDT(totalOrderValueBDT);

  // 3. YEARLY COMPARISON MATRIX
  const yearlyComparison: MonthlyComparisonRow[] = useMemo(() => {
    return calculateYearlyComparison({
      year: selectedYear,
      orders,
      cuttingEntries,
      sewingProduction,
      washingRecords,
      finishingRecords,
      packingRecords,
      shipmentRecords,
      transfers
    });
  }, [
    selectedYear,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    packingRecords,
    shipmentRecords,
    transfers
  ]);

  // 4. STYLE-WISE REPORT
  const styleReport: StyleReportRow[] = useMemo(() => {
    return calculateStyleReport({
      year: selectedYear,
      month: selectedMonth,
      department: selectedDept,
      orders,
      cuttingEntries,
      sewingProduction,
      washingRecords,
      finishingRecords,
      packingRecords,
      shipmentRecords
    });
  }, [
    selectedYear,
    selectedMonth,
    selectedDept,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    packingRecords,
    shipmentRecords
  ]);

  // 5. PO-WISE REPORT
  const poReport: POReportRow[] = useMemo(() => {
    return calculatePOReport({
      year: selectedYear,
      month: selectedMonth,
      orders,
      cuttingEntries,
      sewingProduction,
      washingRecords,
      finishingRecords,
      shipmentRecords
    });
  }, [
    selectedYear,
    selectedMonth,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    shipmentRecords
  ]);

  // 6. COLOUR-WISE REPORT
  const colourReport: ColourReportRow[] = useMemo(() => {
    return calculateColourReport({
      year: selectedYear,
      month: selectedMonth,
      orders,
      cuttingEntries,
      sewingProduction,
      washingRecords,
      finishingRecords,
      shipmentRecords
    });
  }, [
    selectedYear,
    selectedMonth,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    shipmentRecords
  ]);

  // 7. SIZE-WISE REPORT
  const sizeReport: SizeReportRow[] = useMemo(() => {
    return calculateSizeReport({
      year: selectedYear,
      month: selectedMonth,
      orders,
      cuttingEntries,
      sewingProduction,
      washingRecords,
      finishingRecords,
      shipmentRecords
    });
  }, [
    selectedYear,
    selectedMonth,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    shipmentRecords
  ]);

  // 8. DATE-WISE DAILY PRODUCTION REPORT
  const dateWiseReport: DateWiseProductionRow[] = useMemo(() => {
    return calculateDateWiseReport({
      year: selectedYear,
      month: selectedMonth,
      cuttingEntries,
      sewingProduction,
      washingRecords,
      finishingRecords,
      packingRecords,
      shipmentRecords
    });
  }, [
    selectedYear,
    selectedMonth,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    packingRecords,
    shipmentRecords
  ]);

  // Filter & Search Helper
  const filterAndSort = <T extends Record<string, any>>(list: T[], searchFields: string[]) => {
    const q = (searchQuery || '').trim().toLowerCase();
    const filtered = list.filter(item => {
      if (!q) return true;
      return searchFields.some(f => String(item[f] || '').toLowerCase().includes(q));
    });

    return [...filtered].sort((a, b) => {
      const valA = a[sortField] ?? '';
      const valB = b[sortField] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Month label
  const activeMonthLabel = selectedMonth === 'all'
    ? 'All Year (12-Months Overview)'
    : MONTH_NAMES.find(m => m.index === selectedMonth)?.full || `Month ${selectedMonth}`;

  // Export Data generator based on active view tab
  const getExportData = () => {
    switch (activeTab) {
      case 'summary':
      case 'detailed':
        return filteredDeptSummaries.map(d => ({
          Department: d.department,
          'Order Qty': d.orderQty,
          'Produced Qty': d.producedQty,
          'Remaining Qty': d.remainingQty,
          'Achievement %': `${d.achievementPct}%`,
          Remarks: d.remarks || ''
        }));
      case 'yearly_matrix':
        return yearlyComparison.map(y => ({
          Month: y.monthFull,
          'Order Qty': y.orderQty,
          'Produced Qty': y.producedQty,
          'Remaining Qty': y.remainingQty,
          'Achievement %': `${y.achievementPct}%`,
          Cutting: y.cuttingQty,
          Sewing: y.sewingQty,
          Washing: y.washingQty,
          Finishing: y.finishingQty,
          Packing: y.packingQty,
          Shipment: y.shippedQty,
          Status: y.status
        }));
      case 'style':
        return styleReport.map(s => ({
          'Style No': s.styleNo,
          'Style Name': s.styleName,
          Buyer: s.buyer,
          'Garment Type': s.garmentType,
          'Order Qty': s.orderQty,
          'Cut Qty': s.cutQty,
          'Sew Qty': s.sewQty,
          'Wash Qty': s.washQty,
          'Finish Qty': s.finQty,
          'Packed Qty': s.packQty,
          'Shipped Qty': s.shippedQty,
          'Balance Qty': s.balanceQty,
          'Achievement %': `${s.achievementPct}%`,
          Status: s.status
        }));
      case 'po':
        return poReport.map(p => ({
          'PO No': p.poNo,
          'Style No': p.styleNo,
          Buyer: p.buyer,
          'Delivery Date': p.deliveryDate,
          'PO Qty': p.poQty,
          'Cut Qty': p.cutQty,
          'Sew Qty': p.sewQty,
          'Wash Qty': p.washQty,
          'Fin Qty': p.finQty,
          'Shipped Qty': p.shippedQty,
          'Balance Qty': p.balanceQty,
          Status: p.status
        }));
      case 'colour':
        return colourReport.map(c => ({
          'Style No': c.styleNo,
          'PO No': c.poNo,
          Colour: c.colour,
          'Planned Qty': c.plannedQty,
          'Cut Qty': c.cutQty,
          'Sew Output': c.sewQty,
          'Wash Qty': c.washQty,
          'Finished Qty': c.finQty,
          'Shipped Qty': c.shippedQty,
          'Pending Qty': c.pendingQty
        }));
      case 'size':
        return sizeReport.map(sz => ({
          'Style No': sz.styleNo,
          'PO No': sz.poNo,
          Colour: sz.colour,
          Size: sz.size,
          'Order Qty': sz.orderQty,
          'Cut Qty': sz.cutQty,
          'Sew Output': sz.sewQty,
          'Wash Qty': sz.washQty,
          'Finished Qty': sz.finQty,
          'Shipped Qty': sz.shippedQty,
          'Balance Qty': sz.balanceQty
        }));
      case 'date':
        return dateWiseReport.map(d => ({
          Date: d.date,
          Day: d.dayOfWeek,
          Cutting: d.cuttingQty,
          Sewing: d.sewingQty,
          Washing: d.washingQty,
          Finishing: d.finishingQty,
          Packing: d.packingQty,
          Shipment: d.shippedQty,
          'Total Output': d.totalOutput,
          Remarks: d.remarks
        }));
      default:
        return [];
    }
  };

  const getDepartmentIcon = (deptName: string) => {
    switch (deptName) {
      case 'Cutting':
        return <Scissors className="h-4 w-4 text-blue-600" />;
      case 'Sewing':
        return <Shirt className="h-4 w-4 text-indigo-600" />;
      case 'Washing':
        return <Waves className="h-4 w-4 text-cyan-600" />;
      case 'Third Party Washing':
        return <Truck className="h-4 w-4 text-purple-600" />;
      case 'Finishing':
        return <Sparkles className="h-4 w-4 text-sky-600" />;
      case 'Packing':
        return <Box className="h-4 w-4 text-emerald-600" />;
      case 'Shipment':
        return <Truck className="h-4 w-4 text-rose-600" />;
      default:
        return <Layers className="h-4 w-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      {/* Official Factory Printable Header */}
      <ReportPrintHeader
        title={`MONTHLY & YEARLY PRODUCTION & PERFORMANCE AUDIT REPORT`}
        subtitle={`Monoara Jahur Apparels Ltd. • Dynamic Live Supabase Synchronization`}
        department={selectedDept === 'All' ? 'Consolidated Factory' : selectedDept}
        filtersSummary={[
          `Year: ${selectedYear}`,
          `Month: ${activeMonthLabel}`,
          `Scope: ${selectedDept === 'All' ? 'Full Plant' : `${selectedDept} Department`}`,
          `User Role: ${currentUser?.role}`
        ]}
      />

      {/* 1. TOP INTERACTIVE FILTER BAR */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Year:</label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-transparent font-bold text-slate-900 text-xs focus:outline-hidden cursor-pointer"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
                <option value={2028}>2028</option>
              </select>
            </div>

            {/* Month Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Month:</label>
              <select
                value={selectedMonth}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedMonth(val === 'all' ? 'all' : Number(val));
                }}
                className="bg-transparent font-bold text-slate-900 text-xs focus:outline-hidden cursor-pointer"
              >
                <option value="all">★ All Year (Full 12 Months)</option>
                {MONTH_NAMES.map(m => (
                  <option key={m.index} value={m.index}>
                    {m.index < 10 ? `0${m.index}` : m.index} - {m.full}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter (Role Based) */}
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
              <Building2 className="h-3.5 w-3.5 text-slate-700" />
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Dept:</label>
              {isGlobalUser(currentUser) ? (
                <select
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 text-xs focus:outline-hidden cursor-pointer"
                >
                  <option value="All">
                    {isMD(currentUser)
                      ? '★ All Departments (MD Factory Consolidated)'
                      : isManagement(currentUser)
                      ? '★ All Departments (GM Factory Consolidated)'
                      : '★ All Factory Departments'}
                  </option>
                  <option value="Cutting">Cutting Floor</option>
                  <option value="Sewing">Sewing Lines</option>
                  <option value="Washing">Washing Unit</option>
                  <option value="Third Party Washing">Third Party Washing (Outsourced)</option>
                  <option value="Finishing">Finishing & Ironing</option>
                  <option value="Packing">Packing & Carton</option>
                  <option value="Shipment">Commercial Shipment</option>
                  <option value="Store">Store & Inventory</option>
                  <option value="QC">QC & Quality Audit</option>
                  <option value="Merchandising">Merchandising</option>
                  <option value="HR & Admin">HR & Admin</option>
                </select>
              ) : (
                <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
                  <span>{currentUser?.department}</span>
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded border border-amber-200">
                    <Lock className="h-2.5 w-2.5" /> Department Locked
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions & Print/Excel */}
          <div className="flex items-center gap-2">
            <ExportPrintToolbar
              title={`MJAL_${selectedYear}_${selectedMonth}_${selectedDept}_Report`}
              data={getExportData()}
              filename={`MJAL_Report_${selectedYear}_M${selectedMonth}`}
            />
          </div>
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📊 Monthly Summary
          </button>
          <button
            onClick={() => setActiveTab('yearly_matrix')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'yearly_matrix'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📅 Yearly 12-Month Matrix
          </button>
          <button
            onClick={() => setActiveTab('detailed')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'detailed'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📋 Detailed Department Report
          </button>
          <button
            onClick={() => setActiveTab('style')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'style'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            👔 Style-wise
          </button>
          <button
            onClick={() => setActiveTab('po')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'po'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📦 PO-wise
          </button>
          <button
            onClick={() => setActiveTab('colour')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'colour'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🎨 Colour-wise
          </button>
          <button
            onClick={() => setActiveTab('size')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'size'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            📏 Size-wise
          </button>
          <button
            onClick={() => setActiveTab('date')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'date'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            🗓️ Date-wise Daily Trend
          </button>
        </div>
      </div>

      {/* 2. EXECUTIVE & HIGH-LEVEL PERIOD SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Order Qty"
          value={totalOrderQty}
          subtitle={`${selectedYear} • ${activeMonthLabel}`}
          icon={Layers}
          color="blue"
        />
        <StatCard
          title="Produced Qty"
          value={totalProducedQty}
          subtitle="Sewn / Finished Output"
          icon={Shirt}
          color="indigo"
        />
        <StatCard
          title="Remaining Qty"
          value={totalRemainingQty}
          subtitle="Order Balance"
          icon={AlertTriangle}
          color={totalRemainingQty > 0 ? 'amber' : 'emerald'}
        />
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Achievement
            </span>
            <Percent className="h-3.5 w-3.5 text-emerald-700" />
          </div>
          <div className="my-1">
            <p className="text-xl font-black text-emerald-950">{overallAchievement}%</p>
            <div className="w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, overallAchievement)}%` }}
              />
            </div>
          </div>
          <p className="text-[10px] text-emerald-700 font-semibold">
            {overallAchievement >= 90 ? 'Target Exceeded' : 'Running Production'}
          </p>
        </div>
      </div>

      {/* MD / Executive Financial Bar (Visible to MD, Director, GM, Super Admin) */}
      {canViewExecutiveOrderSummary(currentUser) && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                {isMD(currentUser) ? 'Executive Financial Consolidated Summary' : 'Executive Factory Value Matrix'}
              </span>
              <p className="text-xs font-medium text-slate-300">
                Live Valuations calculated directly from confirmed Purchase Orders & Shipments
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-right">
            <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Order Value (USD)</span>
              <span className="text-sm font-black text-emerald-400">${totalOrderValueUSD.toLocaleString()}</span>
            </div>
            <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-[9px] uppercase font-bold text-slate-400 block">BDT Equivalent</span>
              <span className="text-sm font-black text-amber-300" title={bdtFormatted.fullAmount}>
                {bdtFormatted.display}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB CONTENT RENDERING */}

      {/* VIEW A: SUMMARY & DETAILED DEPARTMENT REPORT */}
      {(activeTab === 'summary' || activeTab === 'detailed') && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <span>Department Production Summary Matrix</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                    {selectedYear} • {activeMonthLabel}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Dynamic Department Flow: Order Qty → Received Qty → Produced Qty → Transfer Qty → Remaining Qty → Achievement %
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200">
                    <th className="p-2.5">Department</th>
                    <th className="p-2.5 text-right">Order Qty</th>
                    <th className="p-2.5 text-right">Produced Qty</th>
                    <th className="p-2.5 text-right">Remaining Qty</th>
                    <th className="p-2.5 text-center">Achievement %</th>
                    <th className="p-2.5">Process Note / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDeptSummaries.map((dept, index) => {
                    return (
                      <tr key={index} className="hover:bg-blue-50/40 transition-colors">
                        <td className="p-2.5 font-bold text-slate-900 flex items-center gap-2">
                          {getDepartmentIcon(dept.department)}
                          <span>{dept.department}</span>
                        </td>
                        <td className="p-2.5 text-right font-semibold text-slate-800">
                          {dept.orderQty.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-bold text-blue-900">
                          {dept.producedQty.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-slate-700">
                          {dept.remainingQty > 0 ? (
                            <span className="text-amber-700 font-bold">{dept.remainingQty.toLocaleString()}</span>
                          ) : (
                            <span className="text-emerald-700 font-bold">0 (Complete)</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              dept.achievementPct >= 95
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : dept.achievementPct >= 75
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {dept.achievementPct}%
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-600 font-medium">
                          {dept.remarks || 'Standard Processing'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td className="p-2.5 uppercase tracking-wider text-[11px]">Factory Total Output</td>
                    <td className="p-2.5 text-right">{totalOrderQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-blue-900">{totalProducedQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-amber-800">{totalRemainingQty.toLocaleString()}</td>
                    <td className="p-2.5 text-center text-emerald-800">{overallAchievement}%</td>
                    <td className="p-2.5 text-[10px] text-slate-500 font-medium">Consolidated Factory Summary</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Department Detail Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {filteredDeptSummaries.map((d, i) => (
              <div key={i} className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {getDepartmentIcon(d.department)}
                    <span className="font-black text-slate-900 text-xs">{d.department}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    d.achievementPct >= 90 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {d.achievementPct}% Eff.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Produced:</span>
                    <strong className="text-slate-800 text-sm">{d.producedQty.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Remaining:</span>
                    <strong className="text-amber-700 text-sm">{d.remainingQty.toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW B: YEARLY 12-MONTH COMPARISON MATRIX */}
      {activeTab === 'yearly_matrix' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="p-3.5 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <span>Year {selectedYear} Month-Wise Production Comparison Grid</span>
                </h2>
                <p className="text-[11px] text-slate-600 font-medium">
                  Month-by-month factory order volume, floor throughput, transfers, remaining balances and achievement rate
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200">
                    <th className="p-2.5">Month</th>
                    <th className="p-2.5 text-right">Order Qty</th>
                    <th className="p-2.5 text-right">Production</th>
                    <th className="p-2.5 text-right">Remaining</th>
                    <th className="p-2.5 text-center">Achievement %</th>
                    <th className="p-2.5 text-center">Cutting</th>
                    <th className="p-2.5 text-center">Sewing</th>
                    <th className="p-2.5 text-center">Washing</th>
                    <th className="p-2.5 text-center">Finishing</th>
                    <th className="p-2.5 text-center">Shipped</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yearlyComparison.map((m, idx) => {
                    const isSelected = selectedMonth === m.monthIndex;
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedMonth(m.monthIndex)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-100/60 font-medium'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-2.5 font-black text-slate-900 flex items-center gap-2">
                          <span className="w-6 text-center text-[10px] font-bold text-slate-400 bg-slate-100 rounded py-0.5">
                            {m.monthIndex < 10 ? `0${m.monthIndex}` : m.monthIndex}
                          </span>
                          <span>{m.monthFull}</span>
                        </td>
                        <td className="p-2.5 text-right font-semibold text-slate-800">
                          {m.orderQty > 0 ? m.orderQty.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5 text-right font-black text-blue-900">
                          {m.producedQty > 0 ? m.producedQty.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-amber-800">
                          {m.remainingQty > 0 ? m.remainingQty.toLocaleString() : (m.orderQty > 0 ? '0' : '—')}
                        </td>
                        <td className="p-2.5 text-center">
                          {m.producedQty > 0 || m.orderQty > 0 ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.achievementPct >= 100
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.achievementPct >= 80
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {m.achievementPct}%
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center text-slate-700">
                          {m.cuttingQty > 0 ? m.cuttingQty.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5 text-center text-indigo-900 font-semibold">
                          {m.sewingQty > 0 ? m.sewingQty.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5 text-center text-cyan-900">
                          {m.washingQty > 0 ? m.washingQty.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5 text-center text-sky-900">
                          {m.finishingQty > 0 ? m.finishingQty.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5 text-center text-rose-900 font-bold">
                          {m.shippedQty > 0 ? m.shippedQty.toLocaleString() : '—'}
                        </td>
                        <td className="p-2.5">
                          <StatusBadge status={m.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td className="p-2.5 uppercase tracking-wider text-[11px]">Full Year Total</td>
                    <td className="p-2.5 text-right">
                      {yearlyComparison.reduce((s, y) => s + y.orderQty, 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right text-blue-900">
                      {yearlyComparison.reduce((s, y) => s + y.producedQty, 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right text-amber-800">
                      {yearlyComparison.reduce((s, y) => s + y.remainingQty, 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-center text-emerald-800">
                      {overallAchievement}%
                    </td>
                    <td className="p-2.5 text-center">
                      {yearlyComparison.reduce((s, y) => s + y.cuttingQty, 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-center text-indigo-900">
                      {yearlyComparison.reduce((s, y) => s + y.sewingQty, 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-center text-cyan-900">
                      {yearlyComparison.reduce((s, y) => s + y.washingQty, 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-center text-sky-900">
                      {yearlyComparison.reduce((s, y) => s + y.finishingQty, 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-center text-rose-900">
                      {yearlyComparison.reduce((s, y) => s + y.shippedQty, 0).toLocaleString()}
                    </td>
                    <td className="p-2.5 text-[10px] text-slate-500 font-medium">12 Months Summary</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Visual Trend Bars */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <span>Monthly Production Throughput Curve ({selectedYear})</span>
            </h3>
            <div className="grid grid-cols-12 gap-1.5 items-end h-32 pt-4 border-b border-slate-200">
              {yearlyComparison.map((m, idx) => {
                const maxVal = Math.max(...yearlyComparison.map(x => x.producedQty), 1000);
                const heightPct = m.producedQty > 0 ? Math.max(10, Math.round((m.producedQty / maxVal) * 100)) : 4;
                const isCurrent = selectedMonth === m.monthIndex;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedMonth(m.monthIndex)}
                    className="flex flex-col items-center gap-1 h-full justify-end cursor-pointer group"
                  >
                    <span className="text-[9px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.producedQty > 0 ? `${Math.round(m.producedQty / 1000)}k` : '0'}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all ${
                        isCurrent
                          ? 'bg-blue-600 shadow-sm'
                          : m.producedQty > 0
                          ? 'bg-blue-300 hover:bg-blue-400'
                          : 'bg-slate-200'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className={`text-[10px] font-bold mt-1 ${isCurrent ? 'text-blue-900 font-black' : 'text-slate-600'}`}>
                      {m.monthShort}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW C: STYLE-WISE REPORT */}
      {activeTab === 'style' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs space-y-2">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Style-Wise Monthly & Yearly Production Ledger
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Breakdown by Buyer, Style No, Cutting, Sewing, Washing, Finishing, Packed & Shipped Quantities
              </p>
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search style, buyer, item..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500 w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200">
                  <th className="p-2.5">Buyer</th>
                  <th className="p-2.5 cursor-pointer" onClick={() => handleSort('styleNo')}>
                    <span className="flex items-center gap-1">Style No <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="p-2.5">Style Name</th>
                  <th className="p-2.5 text-right cursor-pointer" onClick={() => handleSort('orderQty')}>
                    <span className="flex items-center justify-end gap-1">Order Qty <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                  <th className="p-2.5 text-right">Cut Qty</th>
                  <th className="p-2.5 text-right">Sew Qty</th>
                  <th className="p-2.5 text-right">Wash Qty</th>
                  <th className="p-2.5 text-right">Fin Qty</th>
                  <th className="p-2.5 text-right">Packed Qty</th>
                  <th className="p-2.5 text-right">Shipped Qty</th>
                  <th className="p-2.5 text-right">Balance Qty</th>
                  <th className="p-2.5 text-center">Achievement</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filterAndSort(styleReport, ['styleNo', 'styleName', 'buyer', 'garmentType']).map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-700">{s.buyer}</td>
                    <td className="p-2.5 font-black text-blue-900">{s.styleNo}</td>
                    <td className="p-2.5 text-slate-600">{s.styleName}</td>
                    <td className="p-2.5 text-right font-black text-slate-900">{s.orderQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-blue-800">{s.cutQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-indigo-900">{s.sewQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-cyan-900">{s.washQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-sky-900">{s.finQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-emerald-900">{s.packQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-rose-900">{s.shippedQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-amber-800">{s.balanceQty.toLocaleString()}</td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        s.achievementPct >= 100
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.achievementPct >= 75
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {s.achievementPct}%
                      </span>
                    </td>
                    <td className="p-2.5">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW D: PO-WISE REPORT */}
      {activeTab === 'po' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs space-y-2">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Purchase Order (PO-Wise) Production & Shipment Audit
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Tracking PO delivery schedules, cut, sew, wash, finish, and export fulfillment
              </p>
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search PO, style, buyer..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500 w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200">
                  <th className="p-2.5">PO Number</th>
                  <th className="p-2.5">Style No</th>
                  <th className="p-2.5">Buyer</th>
                  <th className="p-2.5">Delivery Date</th>
                  <th className="p-2.5 text-right">PO Qty</th>
                  <th className="p-2.5 text-right">Cut Qty</th>
                  <th className="p-2.5 text-right">Sew Qty</th>
                  <th className="p-2.5 text-right">Wash Qty</th>
                  <th className="p-2.5 text-right">Fin Qty</th>
                  <th className="p-2.5 text-right">Shipped Qty</th>
                  <th className="p-2.5 text-right">Balance Qty</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filterAndSort(poReport, ['poNo', 'styleNo', 'buyer']).map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2.5 font-black text-indigo-900">{p.poNo}</td>
                    <td className="p-2.5 font-bold text-slate-900">{p.styleNo}</td>
                    <td className="p-2.5 text-slate-600">{p.buyer}</td>
                    <td className="p-2.5 font-medium text-slate-600">{p.deliveryDate}</td>
                    <td className="p-2.5 text-right font-black text-slate-900">{p.poQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-blue-800">{p.cutQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-indigo-900">{p.sewQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-cyan-900">{p.washQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-sky-900">{p.finQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-rose-900">{p.shippedQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-amber-800">{p.balanceQty.toLocaleString()}</td>
                    <td className="p-2.5">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW E: COLOUR-WISE REPORT */}
      {activeTab === 'colour' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs space-y-2">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Colour-Wise Production & Floor Input Matrix
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Detailed colourway analysis across Cutting, Sewing, Washing, Finishing & Export
              </p>
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search colour, style, PO..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500 w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200">
                  <th className="p-2.5">Style No</th>
                  <th className="p-2.5">PO No</th>
                  <th className="p-2.5">Colour</th>
                  <th className="p-2.5 text-right">Planned Qty</th>
                  <th className="p-2.5 text-right">Cut Qty</th>
                  <th className="p-2.5 text-right">Sew Qty</th>
                  <th className="p-2.5 text-right">Wash Qty</th>
                  <th className="p-2.5 text-right">Finished Qty</th>
                  <th className="p-2.5 text-right">Shipped Qty</th>
                  <th className="p-2.5 text-right">Pending Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filterAndSort(colourReport, ['colour', 'styleNo', 'poNo']).map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-blue-900">{c.styleNo}</td>
                    <td className="p-2.5 font-medium text-slate-700">{c.poNo}</td>
                    <td className="p-2.5 font-black text-slate-900 flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-400 inline-block border border-slate-300" />
                      <span>{c.colour}</span>
                    </td>
                    <td className="p-2.5 text-right font-black text-slate-900">{c.plannedQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-blue-800">{c.cutQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-indigo-900">{c.sewQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-cyan-900">{c.washQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-sky-900">{c.finQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-rose-900">{c.shippedQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-amber-800">{c.pendingQty.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW F: SIZE-WISE REPORT */}
      {activeTab === 'size' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs space-y-2">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Size-Wise Ratio & Production Breakdown Matrix
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Tracking exact garment sizes across all operations and shipment packing lists
              </p>
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search size, colour, style..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:border-blue-500 w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200">
                  <th className="p-2.5">Style No</th>
                  <th className="p-2.5">PO No</th>
                  <th className="p-2.5">Colour</th>
                  <th className="p-2.5 text-center">Size</th>
                  <th className="p-2.5 text-right">Order Qty</th>
                  <th className="p-2.5 text-right">Cut Qty</th>
                  <th className="p-2.5 text-right">Sew Qty</th>
                  <th className="p-2.5 text-right">Wash Qty</th>
                  <th className="p-2.5 text-right">Finished Qty</th>
                  <th className="p-2.5 text-right">Shipped Qty</th>
                  <th className="p-2.5 text-right">Balance Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filterAndSort(sizeReport, ['size', 'colour', 'styleNo', 'poNo']).map((sz, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-blue-900">{sz.styleNo}</td>
                    <td className="p-2.5 font-medium text-slate-700">{sz.poNo}</td>
                    <td className="p-2.5 text-slate-800">{sz.colour}</td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 rounded font-black text-slate-900 border border-slate-200">
                        {sz.size}
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-black text-slate-900">{sz.orderQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-blue-800">{sz.cutQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-indigo-900">{sz.sewQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-cyan-900">{sz.washQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right text-sky-900">{sz.finQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-rose-900">{sz.shippedQty.toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-amber-800">{sz.balanceQty.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW G: DATE-WISE DAILY BREAKDOWN */}
      {activeTab === 'date' && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs space-y-2">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Day-by-Day Daily Production Timeline ({activeMonthLabel} {selectedYear})
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Day 1 to Day 31 calendar log showing daily output per operation across the entire factory
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200">
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5 text-center">Day</th>
                  <th className="p-2.5 text-right">Cutting</th>
                  <th className="p-2.5 text-right">Sewing</th>
                  <th className="p-2.5 text-right">Washing</th>
                  <th className="p-2.5 text-right">Finishing</th>
                  <th className="p-2.5 text-right">Packing</th>
                  <th className="p-2.5 text-right">Shipped</th>
                  <th className="p-2.5 text-right font-black">Total Output</th>
                  <th className="p-2.5">Daily Floor Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dateWiseReport.map((d, i) => (
                  <tr key={i} className={`hover:bg-slate-50 ${d.dayOfWeek === 'Fri' ? 'bg-slate-50/70 text-slate-400' : ''}`}>
                    <td className="p-2.5 font-bold text-slate-900">{d.date}</td>
                    <td className="p-2.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        d.dayOfWeek === 'Fri' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {d.dayOfWeek}
                      </span>
                    </td>
                    <td className="p-2.5 text-right text-blue-800">{d.cuttingQty > 0 ? d.cuttingQty.toLocaleString() : '—'}</td>
                    <td className="p-2.5 text-right font-bold text-indigo-900">{d.sewingQty > 0 ? d.sewingQty.toLocaleString() : '—'}</td>
                    <td className="p-2.5 text-right text-cyan-900">{d.washingQty > 0 ? d.washingQty.toLocaleString() : '—'}</td>
                    <td className="p-2.5 text-right text-sky-900">{d.finishingQty > 0 ? d.finishingQty.toLocaleString() : '—'}</td>
                    <td className="p-2.5 text-right text-emerald-900">{d.packingQty > 0 ? d.packingQty.toLocaleString() : '—'}</td>
                    <td className="p-2.5 text-right font-bold text-rose-900">{d.shippedQty > 0 ? d.shippedQty.toLocaleString() : '—'}</td>
                    <td className="p-2.5 text-right font-black text-slate-900 bg-slate-50/50">
                      {d.totalOutput > 0 ? d.totalOutput.toLocaleString() : '—'}
                    </td>
                    <td className="p-2.5 text-[11px] text-slate-600 font-medium">{d.remarks || 'Standard Operation'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Official Factory Printable Footer */}
      <ReportPrintFooter />
    </div>
  );
};
