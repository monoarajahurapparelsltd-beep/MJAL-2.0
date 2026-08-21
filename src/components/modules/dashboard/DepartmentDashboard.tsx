import React, { useState } from 'react';
import {
  Scissors,
  Shirt,
  Warehouse,
  ShoppingBag,
  ClipboardCheck,
  Users,
  Truck,
  Waves,
  Sparkles,
  Package,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Send,
  PackageCheck,
  FileSpreadsheet,
  Clock,
  Check,
  Flame,
  FileCheck2,
  Archive,
  BarChart3,
  BadgeCheck
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { calculateCuttingEntriesSewingStats } from '../../../utils/cuttingCalculationUtils';
import { getSewingInputReceivedBreakdown, getDepartmentReceivedSizeMap } from '../../../utils/sewingCalculationUtils';
import { StatCard } from '../../common/StatCard';
import { StatusBadge } from '../../common/StatusBadge';
import { Department } from '../../../types';
import {
  filterCuttingByScope,
  filterSewingByScope,
  filterStoreByScope,
  filterOrdersForUser,
  isGlobalUser,
  canViewExecutiveOrderSummary
} from '../../../utils/authUtils';
import { formatBDT, USD_TO_BDT_RATE } from '../../../utils/currencyUtils';

export const DepartmentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [selectedDeptTab, setSelectedDeptTab] = useState<Department | 'GLOBAL'>('GLOBAL');

  const dept = currentUser?.department || 'Cutting';
  const effectiveDept = isGlobalUser(currentUser)
    ? selectedDeptTab === 'GLOBAL' ? 'ALL' : selectedDeptTab
    : dept;

  // ==========================================
  // 1. CUTTING DATA
  // ==========================================
  const rawCutting = supabaseDataService.getCuttingEntries();
  const cuttingData = filterCuttingByScope(rawCutting, currentUser);
  const totalCutQty = cuttingData.reduce((sum, c) => sum + c.cutQty, 0);
  const totalCutOrderQty = cuttingData.reduce((sum, c) => sum + c.orderQty, 0);
  const totalCutShortage = cuttingData.reduce((sum, c) => sum + c.shortageQty, 0);
  const avgMarkerEff = cuttingData.length > 0
    ? (cuttingData.reduce((sum, c) => sum + c.markerEfficiency, 0) / cuttingData.length).toFixed(1)
    : '0.0';
  const avgCutEff = totalCutOrderQty > 0
    ? Math.round((totalCutQty / totalCutOrderQty) * 100)
    : 100;
  const totalBundles = cuttingData.reduce((sum, c) => sum + c.bundleCount, 0);

  const rawTransfers = supabaseDataService.getTransfers();
  const cuttingToSewingTransfers = rawTransfers.filter(
    t => t.fromDepartment === 'Cutting' && t.toDepartment === 'Sewing'
  );
  const cuttingSewingStatsMap = calculateCuttingEntriesSewingStats(cuttingData, rawTransfers);
  const totalSewingSentFromCut = Array.from(cuttingSewingStatsMap.values()).reduce((sum, s) => sum + s.sewingSent, 0);

  const todayStr = new Date().toISOString().substring(0, 10);
  const todaySewingSentFromCut = cuttingToSewingTransfers
    .filter(t => t.transferDate === todayStr || t.transferDate === '2026-08-10')
    .reduce((sum, t) => sum + (t.quantity || 0), 0);

  const totalInputBalance = Math.max(0, totalCutQty - totalSewingSentFromCut);
  const inputBalancePercent = totalCutQty > 0
    ? Math.min(100, Math.round((totalSewingSentFromCut / totalCutQty) * 100))
    : 0;

  // ==========================================
  // 2. SEWING DATA
  // ==========================================
  const rawSewing = supabaseDataService.getSewingProduction();
  const sewingData = filterSewingByScope(rawSewing, currentUser);
  const totalSewingOutput = sewingData.reduce((sum, s) => sum + s.totalOutput, 0);
  const totalSewingTarget = sewingData.reduce((sum, s) => sum + s.dailyTarget, 0);
  const sewingAchievement = totalSewingTarget > 0 ? Math.round((totalSewingOutput / totalSewingTarget) * 100) : 0;
  const totalSewingInputQty = totalSewingSentFromCut;
  const todaySewingInputQty = todaySewingSentFromCut > 0
    ? todaySewingSentFromCut
    : sewingData
        .filter(s => s.date === todayStr || s.date === '2026-08-10')
        .reduce((sum, s) => sum + (s.inputQty || 0), 0);

  // ==========================================
  // 3. WASHING DATA
  // ==========================================
  const rawWashing = supabaseDataService.getWashingRecords();
  const washingData = rawWashing;
  const totalWashSent = washingData.reduce((sum, w) => sum + (w.sentQty || 0), 0);
  const totalWashReceived = washingData.reduce((sum, w) => sum + (w.receivedQty || 0), 0);
  const totalWashDamage = washingData.reduce((sum, w) => sum + (w.damageQty || 0), 0);
  const totalWashBalance = washingData.reduce((sum, w) => sum + (w.balanceQty || 0), 0);
  const washSuccessRate = totalWashSent > 0
    ? Math.round((totalWashReceived / totalWashSent) * 100)
    : 100;

  // ==========================================
  // 4. FINISHING DATA
  // ==========================================
  const rawFinishing = supabaseDataService.getFinishingRecords();
  const finishingTransfers = rawTransfers.filter(t => t.toDepartment === 'Finishing' && t.status !== 'Rejected');
  const allMasterOrders = supabaseDataService.getOrders();

  // Collect all unique (styleNo, poNo, colour) keys from finishing transfers and records
  const finishingGroupKeys = new Set<string>();
  finishingTransfers.forEach(t => {
    if (t.items && t.items.length > 0) {
      t.items.forEach(it => {
        const sNo = it.styleNo || t.styleNo || '';
        const pNo = it.poNo || t.poNo || '';
        const cName = it.colour || t.colour || '';
        if (sNo) finishingGroupKeys.add(`${sNo}___${pNo}___${cName}`);
      });
    } else if (t.styleNo) {
      finishingGroupKeys.add(`${t.styleNo}___${t.poNo || ''}___${t.colour || ''}`);
    }
  });
  rawFinishing.forEach(r => {
    if (r.styleNo) {
      finishingGroupKeys.add(`${r.styleNo}___${r.poNo || ''}___${r.colour || ''}`);
    }
  });

  const finishingRecordMap = new Map<string, any>();

  finishingGroupKeys.forEach(gKey => {
    const [sNo, pNo, cName] = gKey.split('___');
    
    // Find matching order size breakdown
    let colourItemSizeQuantities: Record<string, number> | undefined;
    let foundColourName = cName;
    let buyerName = '';

    for (const ord of allMasterOrders) {
      if (ord.styleNo?.trim().toUpperCase() === sNo.trim().toUpperCase()) {
        buyerName = ord.buyer || '';
        for (const po of (ord.purchaseOrders || [])) {
          if (!pNo || !po.poNo || po.poNo.trim().toUpperCase() === pNo.trim().toUpperCase()) {
            for (const col of (po.colours || [])) {
              if (!cName || col.colour.trim().toUpperCase() === cName.trim().toUpperCase()) {
                colourItemSizeQuantities = col.sizeQuantities;
                foundColourName = col.colour;
                break;
              }
            }
          }
          if (colourItemSizeQuantities) break;
        }
      }
      if (colourItemSizeQuantities) break;
    }

    // Build base size map from order
    const orderSizeMap: Record<string, number> = {};
    if (colourItemSizeQuantities && Object.keys(colourItemSizeQuantities).length > 0) {
      Object.entries(colourItemSizeQuantities).forEach(([sz, q]) => {
        orderSizeMap[sz] = Number(q) || 0;
      });
    }

    // Also include any sizes explicitly found in transfer items
    finishingTransfers.forEach(t => {
      if (t.styleNo?.trim().toUpperCase() === sNo.trim().toUpperCase()) {
        if (t.items && t.items.length > 0) {
          t.items.forEach(it => {
            if (it.size && !orderSizeMap[it.size]) {
              orderSizeMap[it.size] = Number(it.quantity) || 0;
            }
          });
        }
      }
    });

    // Also include any sizes explicitly logged in finishing records
    rawFinishing.forEach(r => {
      if (r.styleNo?.trim().toUpperCase() === sNo.trim().toUpperCase() && 
          (!pNo || !r.poNo || r.poNo.trim().toUpperCase() === pNo.trim().toUpperCase()) &&
          (!cName || !r.colour || r.colour.trim().toUpperCase() === cName.trim().toUpperCase())) {
        if (r.size && r.size !== 'All Sizes' && !orderSizeMap[r.size]) {
          orderSizeMap[r.size] = 0;
        }
      }
    });

    // Calculate distributed receive quantities per size matching Buyer, Style, PO, Colour and Size
    const receivedSizeMap = getDepartmentReceivedSizeMap('Finishing', sNo, pNo, cName, orderSizeMap, finishingTransfers, buyerName);

    // Collect all unique sizes to output (exclude multi-size combined strings if individual sizes exist)
    const allSizes = Object.keys(orderSizeMap).length > 0
      ? Object.keys(orderSizeMap)
      : (Object.keys(receivedSizeMap).length > 0 ? Object.keys(receivedSizeMap) : ['All Sizes']);

    allSizes.forEach(sz => {
      const rowKey = `${sNo}_${pNo}_${cName}_${sz}`;
      const recvQty = receivedSizeMap[sz] || 0;

      // Find matching finishing records for this specific size
      const sizeRecords = rawFinishing.filter(r => 
        r.styleNo?.trim().toUpperCase() === sNo.trim().toUpperCase() &&
        (!pNo || !r.poNo || r.poNo.trim().toUpperCase() === pNo.trim().toUpperCase()) &&
        (!cName || !r.colour || r.colour.trim().toUpperCase() === cName.trim().toUpperCase()) &&
        ((r.size && r.size.trim().toUpperCase() === sz.trim().toUpperCase()) || (!r.size && sz === 'All Sizes'))
      );

      const latestRec = sizeRecords[sizeRecords.length - 1];
      const matchingTransfers = finishingTransfers.filter(t => t.styleNo?.trim().toUpperCase() === sNo.trim().toUpperCase());
      const latestTrans = matchingTransfers[matchingTransfers.length - 1];

      const getUpQty = sizeRecords.reduce((sum, r) => sum + (r.getUpQty || 0), 0);
      const ironedQty = sizeRecords.reduce((sum, r) => sum + (r.ironedQty || 0), 0);
      const taggedQty = sizeRecords.reduce((sum, r) => sum + (r.taggedQty || r.finishedQty || 0), 0);
      const packedQty = sizeRecords.reduce((sum, r) => sum + (r.packedQty || r.polyQty || r.finishedQty || 0), 0);
      const cartonQty = sizeRecords.reduce((sum, r) => sum + (r.cartonQty || 0), 0);
      const readyShipQty = sizeRecords.reduce((sum, r) => sum + (r.readyForShipmentQty || (r.isReadyForShipment ? (r.packedQty || 0) : 0)), 0);

      // Effective receive quantity: at least what was received or what was finished
      const effectiveRecv = Math.max(recvQty, getUpQty, ironedQty, taggedQty, packedQty, cartonQty);

      // Determine date & status
      const rowDate = latestRec?.date || latestTrans?.transferDate || todayStr;
      let status = 'Inbound Received from Sewing';
      if (readyShipQty > 0 || (packedQty >= effectiveRecv && effectiveRecv > 0)) {
        status = 'Ready For Shipment';
      } else if (getUpQty > 0 || ironedQty > 0 || taggedQty > 0 || packedQty > 0 || cartonQty > 0) {
        status = 'In Finishing';
      }

      // Only add rows that have received qty > 0 OR have finishing production > 0
      if (effectiveRecv > 0 || getUpQty > 0 || ironedQty > 0 || taggedQty > 0 || packedQty > 0 || cartonQty > 0) {
        finishingRecordMap.set(rowKey, {
          id: latestRec?.id || `fin-row-${rowKey}`,
          date: rowDate,
          styleNo: sNo,
          poNo: pNo,
          colour: cName || foundColourName || 'N/A',
          size: sz,
          sewingReceiveQty: effectiveRecv,
          getUpQty,
          ironedQty,
          taggedQty,
          packedQty,
          cartonQty,
          readyForShipmentQty: readyShipQty,
          shipmentStatus: latestRec?.shipmentStatus || status
        });
      }
    });
  });

  const finishingRecords = Array.from(finishingRecordMap.values());
  let totalFinishingRecv = 0;
  let totalFinishingIron = 0;
  let totalFinishingPacking = 0;
  let totalFinishingCartons = 0;
  finishingRecords.forEach(r => {
    totalFinishingRecv += (r.sewingReceiveQty || 0);
    totalFinishingIron += (r.ironedQty || 0);
    totalFinishingPacking += (r.packedQty || 0);
    totalFinishingCartons += (r.cartonQty || 0);
  });
  const totalFinishingWIP = Math.max(0, totalFinishingRecv - totalFinishingPacking);

  // ==========================================
  // 5. QC DATA
  // ==========================================
  const qcData = supabaseDataService.getQCInspections();
  const totalQCInspected = qcData.reduce((sum, q) => sum + q.inspectedQty, 0);
  const totalQCPassed = qcData.reduce((sum, q) => sum + q.passedQty, 0);
  const totalQCReject = qcData.reduce((sum, q) => sum + (q.rejectQty || 0), 0);
  const totalQCRework = qcData.reduce((sum, q) => sum + (q.reworkQty || 0), 0);
  const qcPassRate = totalQCInspected > 0 ? Math.round((totalQCPassed / totalQCInspected) * 100) : 100;
  const avgDHU = qcData.length > 0 ? (qcData.reduce((sum, q) => sum + q.dhu, 0) / qcData.length).toFixed(1) : '0.0';

  // ==========================================
  // 6. PACKING DATA
  // ==========================================
  const rawPacking = supabaseDataService.getPackingRecords();
  const packingData = rawPacking;
  const totalPackingPackedQty = packingData.reduce((sum, p) => sum + (p.packedQty || 0), 0);
  const totalPackingCartons = packingData.reduce((sum, p) => sum + (p.cartonCount || 0), 0);
  const totalPackingOrderQty = packingData.reduce((sum, p) => sum + (p.orderQty || 0), 0);
  const totalPackingBalance = Math.max(0, totalPackingOrderQty - totalPackingPackedQty);

  // ==========================================
  // 7. STORE DATA
  // ==========================================
  const rawStore = supabaseDataService.getStoreStock();
  const storeData = filterStoreByScope(rawStore, currentUser);
  const totalStockItems = storeData.length;
  const totalStockValuation = storeData.reduce((sum, i) => sum + (i.currentStock * (i.unitPrice || 0)), 0);
  const lowStockCount = storeData.filter(i => i.currentStock <= i.minStockLevel).length;

  // ==========================================
  // 8. SHIPMENT DATA
  // ==========================================
  const shipments = supabaseDataService.getShipmentRecords();
  const totalShipped = shipments.reduce((sum, s) => sum + s.shippedQty, 0);
  const totalShipmentCartons = shipments.reduce((sum, s) => sum + (s.cartonCount || 0), 0);
  const completedShipmentsCount = shipments.filter(s => s.status === 'Shipped' || s.status === 'Completed').length;

  // ==========================================
  // 9. ORDERS & MERCHANDISING
  // ==========================================
  const rawOrders = supabaseDataService.getOrders();
  const orders = filterOrdersForUser(rawOrders, currentUser);
  const totalOrderQty = orders.reduce((sum, o) => sum + o.totalOrderQty, 0);
  const runningOrdersCount = orders.filter(o => o.status === 'Running').length;
  const totalOrderValue = orders.reduce((sum, o) => sum + (o.totalOrderValue || 0), 0);

  // ==========================================
  // 10. SAMPLE DATA
  // ==========================================
  const samples = supabaseDataService.getSamples();
  const totalSamples = samples.length;
  const approvedSamples = samples.filter(s => s.status === 'Approved').length;
  const pendingSamples = samples.filter(s => s.status === 'Pending' || s.status === 'Submitted').length;

  // ==========================================
  // 11. HR DATA
  // ==========================================
  const employees = supabaseDataService.getEmployees();
  const attendance = supabaseDataService.getAttendance();
  const todayAttendance = attendance.filter(a => a.status === 'Present').length;
  const attendanceRate = employees.length > 0 ? Math.round((todayAttendance / employees.length) * 100) : 0;
  const totalOTHours = attendance.reduce((sum, a) => sum + (a.otHours || 0), 0);

  // Department switcher tabs (Only for Super Admin / Global Admin)
  const globalDeptTabs: { id: Department | 'GLOBAL'; label: string; icon: any }[] = [
    { id: 'GLOBAL', label: 'Global Factory View', icon: Building2 },
    { id: 'Cutting', label: 'Cutting Floor', icon: Scissors },
    { id: 'Sewing', label: 'Sewing Production', icon: Shirt },
    { id: 'Washing', label: 'Washing Unit', icon: Waves },
    { id: 'Finishing', label: 'Finishing Unit', icon: Sparkles },
    { id: 'QC', label: 'QC & Inspection', icon: ClipboardCheck },
    { id: 'Packing', label: 'Packing & Cartons', icon: Package },
    { id: 'Store', label: 'Store & Inventory', icon: Warehouse },
    { id: 'Shipment', label: 'Commercial Shipment', icon: Truck },
    { id: 'Merchandising', label: 'Merchandising', icon: ShoppingBag },
    { id: 'Sample', label: 'Sample Section', icon: Layers },
    { id: 'HR & Admin', label: 'HR & Workforce', icon: Users },
  ];

  // --------------------------------------------------------------------------
  // 1. CUTTING SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderCuttingDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        <StatCard
          title="Total Cut Output"
          value={`${(totalCutQty || 0).toLocaleString()} pcs`}
          subtitle={`Order Target: ${(totalCutOrderQty || 0).toLocaleString()} pcs`}
          icon={Scissors}
          variant="blue"
        />
        <StatCard
          title="Sewing Input Sent"
          value={`${(totalSewingSentFromCut || 0).toLocaleString()} pcs`}
          subtitle={`Today Sent: ${(todaySewingSentFromCut || 0).toLocaleString()} pcs`}
          trend={`${inputBalancePercent}% Transferred`}
          trendType="positive"
          icon={Send}
          variant="purple"
        />
        <StatCard
          title="Input Balance"
          value={`${(totalInputBalance || 0).toLocaleString()} pcs`}
          subtitle="Cut Stock Awaiting Sewing Handover"
          trend={totalInputBalance === 0 ? 'Fully Sent' : `${totalInputBalance.toLocaleString()} Bal`}
          trendType={totalInputBalance === 0 ? 'positive' : 'negative'}
          icon={CheckCircle2}
          variant={totalInputBalance === 0 ? 'emerald' : 'amber'}
        />
        <StatCard
          title="Fabric Shortage"
          value={`${(totalCutShortage || 0).toLocaleString()} pcs`}
          subtitle="Recorded Fabric Shortage"
          trend={totalCutShortage === 0 ? 'Zero Shortage' : 'Shortage Found'}
          trendType={totalCutShortage === 0 ? 'positive' : 'negative'}
          icon={AlertTriangle}
          variant="amber"
        />
        <StatCard
          title="Marker Efficiency"
          value={`${avgMarkerEff}%`}
          subtitle="Benchmark Target: >= 85%"
          trend={`${avgMarkerEff}% Avg`}
          trendType={Number(avgMarkerEff) >= 85 ? 'positive' : 'negative'}
          icon={TrendingUp}
          variant="indigo"
        />
        <StatCard
          title="Bundles Created"
          value={`${(totalBundles || 0).toLocaleString()} bdls`}
          subtitle={`Cut Efficiency: ${avgCutEff}%`}
          icon={Layers}
          variant="emerald"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Cutting Section Production Ledger</h3>
            <p className="text-xs text-slate-500">Live Marker Efficiency, Lay Plies, Sewing Sent & Input Balance</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Style / PO</th>
                <th className="p-2.5">Colour</th>
                <th className="p-2.5 text-right">Order Qty</th>
                <th className="p-2.5 text-right">Cut Qty</th>
                <th className="p-2.5 text-right">Sewing Sent</th>
                <th className="p-2.5 text-center">Input Balance</th>
                <th className="p-2.5 text-right">Shortage</th>
                <th className="p-2.5 text-center">Marker Eff %</th>
                <th className="p-2.5 text-right">Bundles</th>
                <th className="p-2.5">Cutting Master</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cuttingData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-slate-400 font-semibold">
                    No cutting records found for your assigned section.
                  </td>
                </tr>
              ) : (
                cuttingData.map(c => {
                  const stats = cuttingSewingStatsMap.get(c.id);
                  const sentForItem = stats?.sewingSent || 0;
                  const balForItem = stats?.inputBalance ?? c.cutQty;
                  const isComplete = stats?.isFullyTransferred || false;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-medium text-slate-700">{c.date}</td>
                      <td className="p-2.5">
                        <span className="font-extrabold text-blue-600">{c.styleNo}</span>
                        <span className="text-slate-400 text-[10px] block">({c.poNo})</span>
                      </td>
                      <td className="p-2.5 font-medium text-slate-800">{c.colour}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">{(c.orderQty || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-right font-black text-emerald-600">{(c.cutQty || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-right font-extrabold text-indigo-600">{(sentForItem || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isComplete ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {isComplete ? '100% Sent' : `${(balForItem || 0).toLocaleString()} bal`}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-rose-600">{(c.shortageQty || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-center font-extrabold text-indigo-600">{c.markerEfficiency}%</td>
                      <td className="p-2.5 text-right font-semibold text-slate-800">{(c.bundleCount || 0).toLocaleString()}</td>
                      <td className="p-2.5 font-medium text-slate-600">{c.operator}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 2. SEWING SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderSewingDashboard = () => {
    const sewingInputStats = getSewingInputReceivedBreakdown(rawTransfers);
    const totalWIP = Math.max(0, sewingInputStats.totalInputReceived - totalSewingOutput);

    return (
      <div className="space-y-4">
        {/* Operating Schedule Banner */}
        <div className="p-3 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold">
            <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] uppercase tracking-wider rounded font-black">
              Floor Schedule
            </span>
            <span>Floor Hours: 08:00 - 23:00 BD Time</span>
            <span className="text-slate-400">|</span>
            <span className="text-amber-300 font-extrabold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">
              Break: 13:00 - 14:00 (1:00 PM - 2:00 PM)
            </span>
          </div>
          <div className="text-[11px] text-blue-200 font-semibold flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-cyan-400" />
            <span>{currentUser?.line_no ? `Assigned to ${currentUser.line_no}` : '6 Sewing Lines (Line 01 - Line 06)'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <StatCard
            title="Sewing Input Received"
            value={`${(sewingInputStats?.totalInputReceived || 0).toLocaleString()} pcs`}
            subtitle={`Inbound from Cutting Floor`}
            trend={`${sewingInputStats?.breakdown?.length || 0} Batches`}
            trendType="positive"
            icon={Shirt}
            variant="blue"
          />
          <StatCard
            title="Work In Progress (WIP)"
            value={`${(totalWIP || 0).toLocaleString()} pcs`}
            subtitle="Input Received - Finished Output"
            icon={Layers}
            variant="amber"
          />
          <StatCard
            title="Daily Output vs Target"
            value={`${(totalSewingOutput || 0).toLocaleString()} pcs`}
            subtitle={`Daily Target: ${(totalSewingTarget || 0).toLocaleString()} pcs`}
            trend={`${sewingAchievement}% Target`}
            trendType={sewingAchievement >= 90 ? 'positive' : 'negative'}
            icon={TrendingUp}
            variant="emerald"
          />
          <StatCard
            title="Quality Pass Rate"
            value={`${qcPassRate}%`}
            subtitle={`Avg DHU: ${avgDHU}%`}
            icon={ClipboardCheck}
            variant="indigo"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {currentUser?.line_no ? `Sewing Production Ledger — ${currentUser.line_no}` : 'Sewing Lines Production Ledger'}
              </h3>
              <p className="text-xs text-slate-500">Live Style, Daily Target, Actual Output & Due Qty</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Line</th>
                  <th className="p-2.5">Buyer & Style</th>
                  <th className="p-2.5">PO & Colour</th>
                  <th className="p-2.5">Size</th>
                  <th className="p-2.5 text-right">Daily Target</th>
                  <th className="p-2.5 text-right">Actual Output</th>
                  <th className="p-2.5 text-center">Due / Balance</th>
                  <th className="p-2.5 text-center">Achievement %</th>
                  <th className="p-2.5">Supervisor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sewingData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-400 font-semibold">
                      No sewing production records found for your assigned line.
                    </td>
                  </tr>
                ) : (
                  sewingData.map(s => {
                    const dueQty = Math.max(0, s.dailyTarget - s.totalOutput);
                    const eff = s.dailyTarget > 0 ? Math.round((s.totalOutput / s.dailyTarget) * 100) : 100;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 font-medium text-slate-700">{s.date}</td>
                        <td className="p-2.5 font-extrabold text-blue-700 bg-blue-50/50">{s.lineNo}</td>
                        <td className="p-2.5">
                          <span className="font-extrabold text-slate-900">{s.styleNo}</span>
                          <span className="text-slate-400 text-[10px] block">{s.buyer}</span>
                        </td>
                        <td className="p-2.5">
                          <span className="font-semibold text-slate-800">{s.poNo}</span>
                          <span className="text-slate-500 text-[10px] block">{s.colour}</span>
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200 text-[10px]">
                            {s.size || 'All Sizes'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-800">{(s.dailyTarget || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-right font-black text-indigo-700">{(s.totalOutput || 0).toLocaleString()}</td>
                        <td className="p-2.5 text-center font-black">
                          {dueQty === 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Target Completed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              {(dueQty || 0).toLocaleString()} due
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-black text-slate-900">{eff}%</td>
                        <td className="p-2.5 font-medium text-slate-600">{s.lineSupervisor || s.submittedBy}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // 3. WASHING SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderWashingDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          title="Wash Input Received"
          value={`${(totalWashSent || 0).toLocaleString()} pcs`}
          subtitle="Sent from Sewing Floor"
          icon={Waves}
          variant="blue"
        />
        <StatCard
          title="Processed Output"
          value={`${(totalWashReceived || 0).toLocaleString()} pcs`}
          subtitle="Completed Washing & Treatment"
          trend={`${washSuccessRate}% Completed`}
          trendType="positive"
          icon={CheckCircle2}
          variant="emerald"
        />
        <StatCard
          title="In Process / Balance"
          value={`${(totalWashBalance || 0).toLocaleString()} pcs`}
          subtitle="Currently in Hydro / Dryer / Washing"
          icon={Layers}
          variant="amber"
        />
        <StatCard
          title="Wash Damage / Loss"
          value={`${(totalWashDamage || 0).toLocaleString()} pcs`}
          subtitle="Shrinkage / Fabric Defect"
          trend={totalWashDamage === 0 ? 'Zero Loss' : `${totalWashDamage} Defected`}
          trendType={totalWashDamage === 0 ? 'positive' : 'negative'}
          icon={AlertTriangle}
          variant="rose"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Washing & Treatment Lot Processing Ledger</h3>
            <p className="text-xs text-slate-500">Challans, Wash Recipe Types, Input, Output & Delivery</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Challan No</th>
                <th className="p-2.5">Style / PO</th>
                <th className="p-2.5">Wash Type</th>
                <th className="p-2.5">Vendor / Plant</th>
                <th className="p-2.5 text-right">Sent Qty</th>
                <th className="p-2.5 text-right">Received Qty</th>
                <th className="p-2.5 text-right">Damage Qty</th>
                <th className="p-2.5 text-right">Balance</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {washingData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400 font-semibold">
                    No washing records found.
                  </td>
                </tr>
              ) : (
                washingData.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-medium text-slate-700">{w.date}</td>
                    <td className="p-2.5 font-mono font-bold text-blue-700">{w.challanNo}</td>
                    <td className="p-2.5">
                      <span className="font-extrabold text-slate-900">{w.styleNo}</span>
                      <span className="text-slate-400 text-[10px] block">({w.poNo})</span>
                    </td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200 text-[10px]">
                        {w.washType}
                      </span>
                    </td>
                    <td className="p-2.5 font-medium text-slate-700">{w.vendorName}</td>
                    <td className="p-2.5 text-right font-bold text-slate-800">{(w.sentQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right font-black text-emerald-700">{(w.receivedQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-rose-600">{(w.damageQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right font-black text-amber-700">{(w.balanceQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-center">
                      <StatusBadge status={w.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 4. FINISHING SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderFinishingDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          title="Finishing Input Received"
          value={`${(totalFinishingRecv || 0).toLocaleString()} pcs`}
          subtitle="Received from Wash & Sewing"
          trend={`${finishingRecords.length} Batches`}
          trendType="positive"
          icon={Shirt}
          variant="purple"
        />
        <StatCard
          title="Finishing WIP"
          value={`${(totalFinishingWIP || 0).toLocaleString()} pcs`}
          subtitle="Input Received - Poly Packed"
          icon={Layers}
          variant="amber"
        />
        <StatCard
          title="Ironing Output"
          value={`${(totalFinishingIron || 0).toLocaleString()} pcs`}
          subtitle="Steam Ironing Completed"
          icon={Flame}
          variant="blue"
        />
        <StatCard
          title="Poly Packed & Cartons"
          value={`${(totalFinishingPacking || 0).toLocaleString()} pcs`}
          subtitle={`${(totalFinishingCartons || 0).toLocaleString()} Carton Boxes Packed`}
          icon={PackageCheck}
          variant="emerald"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Finishing Section Style & Process Ledger</h3>
            <p className="text-xs text-slate-500">Live Get-Up, Ironing, Hangtag, Poly Packing & Carton Boxes</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Style / PO</th>
                <th className="p-2.5">Colour</th>
                <th className="p-2.5">Size</th>
                <th className="p-2.5 text-right">Recv Qty</th>
                <th className="p-2.5 text-right">Get Up</th>
                <th className="p-2.5 text-right">Ironing</th>
                <th className="p-2.5 text-right">Hangtag</th>
                <th className="p-2.5 text-right">Poly Pack</th>
                <th className="p-2.5 text-right">Cartons</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {finishingRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-slate-400 font-semibold">
                    No finishing records available.
                  </td>
                </tr>
              ) : (
                finishingRecords.map((r, idx) => {
                  const recv = r.sewingReceiveQty || 0;
                  const packed = r.packedQty || 0;
                  return (
                    <tr key={r.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-medium text-slate-700">{r.date}</td>
                      <td className="p-2.5">
                        <span className="font-extrabold text-purple-700">{r.styleNo}</span>
                        <span className="text-slate-400 text-[10px] block">({r.poNo})</span>
                      </td>
                      <td className="p-2.5 font-medium text-slate-800">{r.colour}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200 text-[11px]">
                          {r.size || 'All'}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-black text-blue-700">{(recv || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-right font-bold text-amber-700">{(r.getUpQty || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-right font-bold text-orange-700">{(r.ironedQty || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-right font-bold text-purple-700">{(r.taggedQty || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-right font-black text-emerald-700">{(packed || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-right font-black text-indigo-700">{(r.cartonQty || 0).toLocaleString()} ctns</td>
                      <td className="p-2.5 text-center">
                        <StatusBadge status={r.shipmentStatus || 'In Finishing'} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 5. QC & QUALITY ASSURANCE SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderQCDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          title="Total QC Inspected"
          value={`${(totalQCInspected || 0).toLocaleString()} pcs`}
          subtitle="Garments Inspected Across Lines"
          icon={ClipboardCheck}
          variant="blue"
        />
        <StatCard
          title="QC Pass Rate"
          value={`${qcPassRate}%`}
          subtitle={`Passed: ${(totalQCPassed || 0).toLocaleString()} pcs`}
          trend={`${qcPassRate}% Passed`}
          trendType={qcPassRate >= 95 ? 'positive' : 'negative'}
          icon={CheckCircle2}
          variant="emerald"
        />
        <StatCard
          title="Average Defect DHU"
          value={`${avgDHU}%`}
          subtitle="Defects per Hundred Units"
          trend={Number(avgDHU) <= 3 ? 'Within Spec' : 'Elevated DHU'}
          trendType={Number(avgDHU) <= 3 ? 'positive' : 'negative'}
          icon={AlertTriangle}
          variant="amber"
        />
        <StatCard
          title="Rejects & Rework"
          value={`${(totalQCReject + totalQCRework || 0).toLocaleString()} pcs`}
          subtitle={`Rework: ${totalQCRework.toLocaleString()} | Rejects: ${totalQCReject.toLocaleString()}`}
          icon={Flame}
          variant="rose"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">QC Section Inspection Audit Ledger</h3>
            <p className="text-xs text-slate-500">Inline, End-Line, Final & AQL Quality Inspections</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Inspection Type</th>
                <th className="p-2.5">Line / Table</th>
                <th className="p-2.5">Style / PO</th>
                <th className="p-2.5">Colour</th>
                <th className="p-2.5 text-right">Inspected</th>
                <th className="p-2.5 text-right">Passed</th>
                <th className="p-2.5 text-right">Rework</th>
                <th className="p-2.5 text-right">Reject</th>
                <th className="p-2.5 text-center">DHU %</th>
                <th className="p-2.5 text-center">Result</th>
                <th className="p-2.5">Inspector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {qcData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-slate-400 font-semibold">
                    No QC inspection records found.
                  </td>
                </tr>
              ) : (
                qcData.map(q => (
                  <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-medium text-slate-700">{q.date}</td>
                    <td className="p-2.5 font-bold text-blue-700">{q.inspectionType}</td>
                    <td className="p-2.5 font-extrabold text-slate-800 bg-slate-50">{q.lineNo}</td>
                    <td className="p-2.5">
                      <span className="font-extrabold text-slate-900">{q.styleNo}</span>
                      <span className="text-slate-400 text-[10px] block">({q.poNo})</span>
                    </td>
                    <td className="p-2.5 font-medium text-slate-700">{q.colour}</td>
                    <td className="p-2.5 text-right font-bold text-slate-900">{(q.inspectedQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right font-black text-emerald-700">{(q.passedQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-amber-700">{(q.reworkQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-rose-600">{(q.rejectQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-center font-black text-indigo-700">{q.dhu}%</td>
                    <td className="p-2.5 text-center">
                      <StatusBadge status={q.result === 'Pass' ? 'Approved' : q.result === 'Fail' ? 'Rejected' : 'Pending'} customLabel={q.result} />
                    </td>
                    <td className="p-2.5 font-medium text-slate-600">{q.inspectorName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 6. PACKING SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderPackingDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          title="Total Packed Garments"
          value={`${(totalPackingPackedQty || 0).toLocaleString()} pcs`}
          subtitle="Carton Packed & Sealed"
          icon={Package}
          variant="blue"
        />
        <StatCard
          title="Export Cartons"
          value={`${(totalPackingCartons || 0).toLocaleString()} boxes`}
          subtitle="Master Cartons Completed"
          icon={Archive}
          variant="emerald"
        />
        <StatCard
          title="Packing Target Volume"
          value={`${(totalPackingOrderQty || 0).toLocaleString()} pcs`}
          subtitle="Allocated Order Target"
          icon={TrendingUp}
          variant="indigo"
        />
        <StatCard
          title="Pending Balance"
          value={`${(totalPackingBalance || 0).toLocaleString()} pcs`}
          subtitle="Awaiting Poly & Carton Packing"
          icon={Layers}
          variant="amber"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Packing Section Master Ledger</h3>
            <p className="text-xs text-slate-500">Carton Count, Packed Quantities, Order Target & Packing Officer</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Style / PO</th>
                <th className="p-2.5">Colour</th>
                <th className="p-2.5 text-right">Order Qty</th>
                <th className="p-2.5 text-right">Packed Qty</th>
                <th className="p-2.5 text-right">Carton Count</th>
                <th className="p-2.5 text-right">Balance Qty</th>
                <th className="p-2.5">Packing Officer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {packingData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400 font-semibold">
                    No packing records available.
                  </td>
                </tr>
              ) : (
                packingData.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-medium text-slate-700">{p.date}</td>
                    <td className="p-2.5">
                      <span className="font-extrabold text-blue-700">{p.styleNo}</span>
                      <span className="text-slate-400 text-[10px] block">({p.poNo})</span>
                    </td>
                    <td className="p-2.5 font-medium text-slate-800">{p.colour}</td>
                    <td className="p-2.5 text-right font-bold text-slate-800">{(p.orderQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right font-black text-emerald-700">{(p.packedQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right font-black text-indigo-700">{(p.cartonCount || 0).toLocaleString()} ctns</td>
                    <td className="p-2.5 text-right font-bold text-amber-700">{(p.balanceQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 font-medium text-slate-600">{p.packingOfficer}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 7. STORE & INVENTORY SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderStoreDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          title="Total Store SKUs"
          value={`${(totalStockItems || 0).toLocaleString()} SKUs`}
          subtitle={`Section Scope: ${currentUser?.section || 'Store'}`}
          icon={Warehouse}
          variant="blue"
        />
        <StatCard
          title="Total Stock Valuation"
          value={`$${(totalStockValuation || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Fabric, Trims & Accessories"
          icon={TrendingUp}
          variant="emerald"
        />
        <StatCard
          title="Low Stock Alerts"
          value={`${lowStockCount} Items`}
          subtitle="Below Minimum Reorder Threshold"
          trend={lowStockCount > 0 ? 'Reorder Needed' : 'Optimal'}
          trendType={lowStockCount > 0 ? 'negative' : 'positive'}
          icon={AlertTriangle}
          variant="amber"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Store Material Inventory Ledger</h3>
            <p className="text-xs text-slate-500">Fabric, Trims, Accessories Balance & Bin Location</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <th className="p-2.5">Item Code</th>
                <th className="p-2.5">Item Name & Category</th>
                <th className="p-2.5 text-right">Current Stock</th>
                <th className="p-2.5 text-center">UOM</th>
                <th className="p-2.5 text-right">Unit Price</th>
                <th className="p-2.5 text-right">Stock Value</th>
                <th className="p-2.5">Rack / Bin Location</th>
                <th className="p-2.5 text-right">Min Level</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {storeData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 font-semibold">
                    No store items found for your section scope.
                  </td>
                </tr>
              ) : (
                storeData.map(item => {
                  const price = item.unitPrice || 0;
                  const stock = item.currentStock || 0;
                  const val = stock * price;
                  const isLow = stock <= (item.minStockLevel || 0);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-slate-800">{item.id}</td>
                      <td className="p-2.5">
                        <span className="font-extrabold text-blue-600">{item.itemName}</span>
                        <span className="text-slate-400 text-[10px] block">{item.category}</span>
                      </td>
                      <td className="p-2.5 text-right font-black text-slate-900">{(item.currentStock || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-center font-medium text-slate-600">{item.unit}</td>
                      <td className="p-2.5 text-right font-semibold text-slate-700">${price.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-700">${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-2.5 font-medium text-slate-800">{item.location}</td>
                      <td className="p-2.5 text-right font-medium text-slate-500">{(item.minStockLevel || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-center">
                        <StatusBadge
                          status={isLow ? 'Critical' : 'Active'}
                          customLabel={isLow ? 'Low Stock' : 'Sufficient'}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 8. SHIPMENT & COMMERCIAL SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderShipmentDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          title="Total Shipped Garments"
          value={`${(totalShipped || 0).toLocaleString()} pcs`}
          subtitle="Export Commercial Dispatches"
          icon={Truck}
          variant="blue"
        />
        <StatCard
          title="Cartons Shipped"
          value={`${(totalShipmentCartons || 0).toLocaleString()} boxes`}
          subtitle="Ex-Factory Export Cartons"
          icon={Archive}
          variant="emerald"
        />
        <StatCard
          title="Completed Shipments"
          value={`${completedShipmentsCount} Invoices`}
          subtitle={`Total Dispatches: ${shipments.length}`}
          trend="Gate-Out Completed"
          trendType="positive"
          icon={CheckCircle2}
          variant="indigo"
        />
        <StatCard
          title="Port of Loading"
          value="Chittagong (CGP)"
          subtitle="Bangladesh Sea / Air Cargo"
          icon={Building2}
          variant="purple"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Commercial Export Shipment Ledger</h3>
            <p className="text-xs text-slate-500">Invoice No, Container, Port of Discharge & Delivery Status</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Invoice No</th>
                <th className="p-2.5">Buyer</th>
                <th className="p-2.5">Style / PO</th>
                <th className="p-2.5 text-right">Shipped Qty</th>
                <th className="p-2.5 text-right">Cartons</th>
                <th className="p-2.5">Container / Vessel</th>
                <th className="p-2.5">Destination Port</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-400 font-semibold">
                    No shipment records found.
                  </td>
                </tr>
              ) : (
                shipments.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-medium text-slate-700">{s.shipmentDate}</td>
                    <td className="p-2.5 font-mono font-bold text-blue-700">{s.invoiceNo}</td>
                    <td className="p-2.5 font-bold text-slate-900">{s.buyer}</td>
                    <td className="p-2.5">
                      <span className="font-extrabold text-indigo-600">{s.styleNo}</span>
                      <span className="text-slate-400 text-[10px] block">({s.poNo})</span>
                    </td>
                    <td className="p-2.5 text-right font-black text-emerald-700">{(s.shippedQty || 0).toLocaleString()}</td>
                    <td className="p-2.5 text-right font-bold text-slate-800">{(s.cartonCount || 0).toLocaleString()}</td>
                    <td className="p-2.5 font-medium text-slate-700">{s.containerNo || s.vesselOrFlight || 'Direct'}</td>
                    <td className="p-2.5 font-medium text-slate-800">{s.portOfDischarge}</td>
                    <td className="p-2.5 text-center">
                      <StatusBadge status={s.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 9. MERCHANDISING SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderMerchandisingDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          title="Total Order Bookings"
          value={`${(totalOrderQty || 0).toLocaleString()} pcs`}
          subtitle={`${orders.length} Styles Booked`}
          icon={ShoppingBag}
          variant="blue"
        />
        <StatCard
          title="Running Orders"
          value={`${runningOrdersCount} Styles`}
          subtitle="In Active Production"
          icon={TrendingUp}
          variant="emerald"
        />
        <StatCard
          title="Total Order Value"
          value={`$${(totalOrderValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subtitle={`BDT: ${formatBDT((totalOrderValue || 0) * USD_TO_BDT_RATE).display}`}
          icon={BadgeCheck}
          variant="purple"
        />
        <StatCard
          title="Active Buyers"
          value={`${Array.from(new Set(orders.map(o => o.buyer))).length} Brands`}
          subtitle="Global Export Buyers"
          icon={Building2}
          variant="indigo"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Merchandising Order Booking Ledger</h3>
            <p className="text-xs text-slate-500">Style No, Buyer, Garment Type, Total Order Quantity & FOB Value</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <th className="p-2.5">Buyer</th>
                <th className="p-2.5">Style No</th>
                <th className="p-2.5">Garment Type</th>
                <th className="p-2.5">Season</th>
                <th className="p-2.5 text-right">Order Qty</th>
                <th className="p-2.5 text-right">Order Value ($)</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 font-semibold">
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-bold text-slate-900">{o.buyer}</td>
                    <td className="p-2.5 font-extrabold text-blue-700">{o.styleNo}</td>
                    <td className="p-2.5 font-medium text-slate-700">{o.garmentType}</td>
                    <td className="p-2.5 font-medium text-slate-600">{o.season}</td>
                    <td className="p-2.5 text-right font-black text-slate-900">{(o.totalOrderQty || 0).toLocaleString()} pcs</td>
                    <td className="p-2.5 text-right font-bold text-emerald-700">${(o.totalOrderValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="p-2.5 text-center">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 10. SAMPLE SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderSampleDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          title="Total Sample Requests"
          value={`${totalSamples} Samples`}
          subtitle="Proto, Fit, PP & Size Sets"
          icon={Layers}
          variant="blue"
        />
        <StatCard
          title="Approved by Buyer"
          value={`${approvedSamples} Samples`}
          subtitle="Ready for Bulk Floor Execution"
          trend={`${totalSamples > 0 ? Math.round((approvedSamples / totalSamples) * 100) : 100}% Approved`}
          trendType="positive"
          icon={CheckCircle2}
          variant="emerald"
        />
        <StatCard
          title="Pending Approval / Making"
          value={`${pendingSamples} Samples`}
          subtitle="Under Development / Review"
          icon={Clock}
          variant="amber"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Sample Section Development & Approval Ledger</h3>
            <p className="text-xs text-slate-500">Sample Type, Target Date, Submission & Buyer Approval Status</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <th className="p-2.5">Style / PO</th>
                <th className="p-2.5">Colour</th>
                <th className="p-2.5">Sample Type</th>
                <th className="p-2.5">Submission Date</th>
                <th className="p-2.5">Target Date</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5">Prepared By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {samples.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 font-semibold">
                    No sample records found.
                  </td>
                </tr>
              ) : (
                samples.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5">
                      <span className="font-extrabold text-blue-700">{s.styleNo}</span>
                      <span className="text-slate-400 text-[10px] block">({s.poNo})</span>
                    </td>
                    <td className="p-2.5 font-medium text-slate-800">{s.colour}</td>
                    <td className="p-2.5 font-bold text-slate-800">{s.sampleType}</td>
                    <td className="p-2.5 font-medium text-slate-700">{s.submissionDate}</td>
                    <td className="p-2.5 font-medium text-slate-700">{s.targetDate}</td>
                    <td className="p-2.5 text-center">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="p-2.5 font-medium text-slate-600">{s.preparedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // 11. HR & ADMIN SECTION DASHBOARD
  // --------------------------------------------------------------------------
  const renderHRDashboard = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          title="Total Workforce"
          value={`${employees.length} Personnel`}
          subtitle="Floor Operators, Helpers & Staff"
          icon={Users}
          variant="blue"
        />
        <StatCard
          title="Today's Attendance"
          value={`${todayAttendance} Present`}
          subtitle={`Attendance Rate: ${attendanceRate}%`}
          trend={`${attendanceRate}% Present`}
          trendType={attendanceRate >= 90 ? 'positive' : 'negative'}
          icon={CheckCircle2}
          variant="emerald"
        />
        <StatCard
          title="Overtime (OT) Hours"
          value={`${totalOTHours.toFixed(1)} hrs`}
          subtitle="Cumulative Shift Overtime"
          icon={Clock}
          variant="indigo"
        />
        <StatCard
          title="Active Departments"
          value="12 Units"
          subtitle="Cutting, Sewing, Wash, Fin, QC, Store"
          icon={Building2}
          variant="purple"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Department Workforce Roster</h3>
            <p className="text-xs text-slate-500">Employee ID, Name, Designation, Department & Section Allocation</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                <th className="p-2.5">Emp ID</th>
                <th className="p-2.5">Employee Name</th>
                <th className="p-2.5">Designation</th>
                <th className="p-2.5">Department</th>
                <th className="p-2.5">Section / Line</th>
                <th className="p-2.5">Shift</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400 font-semibold">
                    No employees registered.
                  </td>
                </tr>
              ) : (
                employees.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 font-mono font-bold text-blue-700">{e.empId}</td>
                    <td className="p-2.5 font-extrabold text-slate-900">{e.name}</td>
                    <td className="p-2.5 font-medium text-slate-700">{e.designation}</td>
                    <td className="p-2.5 font-bold text-slate-800">{e.department}</td>
                    <td className="p-2.5 font-medium text-slate-600">{e.section || 'General'}</td>
                    <td className="p-2.5 font-medium text-slate-600">{e.shift}</td>
                    <td className="p-2.5 text-center">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // --------------------------------------------------------------------------
  // GLOBAL DASHBOARD (For Global Super Admins only)
  // --------------------------------------------------------------------------
  const renderGlobalDashboard = () => {
    const totalOrderValueBDT = (totalOrderValue || 0) * USD_TO_BDT_RATE;
    const bdtResult = formatBDT(totalOrderValueBDT);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <StatCard
            title="Total Order Volume"
            value={`${(totalOrderQty || 0).toLocaleString()} pcs`}
            subtitle={`${orders.length} Active Styles | ${runningOrdersCount} Running`}
            icon={ShoppingBag}
            variant="blue"
          />
          <StatCard
            title="Order Value (BDT)"
            value={bdtResult.display}
            subtitle={bdtResult.isCrore ? `Full: ${bdtResult.fullAmount}` : `$${(totalOrderValue || 0).toLocaleString()} USD (@ ৳120)`}
            trend={bdtResult.isCrore ? `$${((totalOrderValue || 0) / 1000).toFixed(0)}k USD` : `@ ৳120 Rate`}
            trendType="neutral"
            icon={Building2}
            variant="amber"
          />
          <StatCard
            title="Daily Sewing Production"
            value={`${(totalSewingOutput || 0).toLocaleString()} pcs`}
            subtitle={`Target: ${(totalSewingTarget || 0).toLocaleString()} pcs (${sewingAchievement}%)`}
            trend={`${sewingAchievement}% Target`}
            trendType={sewingAchievement >= 90 ? 'positive' : 'negative'}
            icon={Shirt}
            variant="indigo"
          />
          <StatCard
            title="QC Inspection Pass Rate"
            value={`${qcPassRate}%`}
            subtitle={`Inspected: ${(totalQCInspected || 0).toLocaleString()} pcs`}
            icon={ClipboardCheck}
            variant="emerald"
          />
          <StatCard
            title="Shipped Volume"
            value={`${(totalShipped || 0).toLocaleString()} pcs`}
            subtitle="Total Completed Shipments"
            icon={Truck}
            variant="cyan"
          />
        </div>

      {canViewExecutiveOrderSummary(currentUser) && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Factory Order & Production Progress Engine</h3>
              <p className="text-xs text-slate-500">Live Department-wise Balance for Active Styles & POs</p>
            </div>
          </div>

          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.styleNo} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <span className="font-black text-sm text-blue-700">{order.styleNo}</span>
                    <span className="text-xs text-slate-600 font-semibold ml-2">({order.buyer})</span>
                    <p className="text-xs text-slate-500">{order.styleName} — Order Qty: <strong className="text-slate-900">{(order.totalOrderQty || 0).toLocaleString()} pcs</strong></p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {order.purchaseOrders.map(po => (
                    <div key={po.poNo} className="p-2 rounded-lg bg-white border border-slate-200 space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                        <span>{po.poNo}</span>
                        <span className="text-indigo-600">{(po.totalPoQty || 0).toLocaleString()} pcs</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Del: {po.shipmentDate}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white shadow-md border border-slate-800">
        <div>
          <div className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Monoara Jahur Apparels Ltd.</span>
          </div>
          <h1 className="text-xl font-black tracking-tight mt-0.5">
            {effectiveDept === 'ALL'
              ? 'Factory Operational Overview'
              : `${effectiveDept} Section Dashboard`}
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            User: {currentUser?.name} ({currentUser?.role}) — {currentUser?.department || 'Department'}{' '}
            {currentUser?.line_no ? `• Line ${currentUser.line_no}` : currentUser?.section ? `• Section: ${currentUser.section}` : ''}
          </p>
        </div>

        {/* User Scope Badge */}
        <div className="px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 text-right space-y-0.5">
          <span className="text-[10px] font-bold text-blue-200 uppercase block">Isolated Section Scope</span>
          <span className="text-xs font-black text-white">{effectiveDept === 'ALL' ? 'Global Admin' : effectiveDept}</span>
        </div>
      </div>

      {/* Global Role Department Switcher Tabs (Only for Global Admins) */}
      {isGlobalUser(currentUser) && (
        <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
          {globalDeptTabs.map(tab => {
            const Icon = tab.icon;
            const active = selectedDeptTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedDeptTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Render Department Dashboard view based strictly on effective scope */}
      {effectiveDept === 'Cutting' && renderCuttingDashboard()}
      {effectiveDept === 'Sewing' && renderSewingDashboard()}
      {effectiveDept === 'Production Planning' && renderSewingDashboard()}
      {effectiveDept === 'Washing' && renderWashingDashboard()}
      {effectiveDept === 'Finishing' && renderFinishingDashboard()}
      {effectiveDept === 'QC' && renderQCDashboard()}
      {effectiveDept === 'Packing' && renderPackingDashboard()}
      {effectiveDept === 'Store' && renderStoreDashboard()}
      {effectiveDept === 'Shipment' && renderShipmentDashboard()}
      {effectiveDept === 'Merchandising' && renderMerchandisingDashboard()}
      {effectiveDept === 'Order Management' && renderMerchandisingDashboard()}
      {effectiveDept === 'Sample' && renderSampleDashboard()}
      {effectiveDept === 'HR & Admin' && renderHRDashboard()}
      {effectiveDept === 'ALL' && renderGlobalDashboard()}
    </div>
  );
};
