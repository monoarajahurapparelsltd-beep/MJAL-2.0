import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Scissors, Flame, ShieldCheck, Tag, Box, Archive, 
  PackageCheck, Layers, ChevronRight, ChevronDown, CheckCircle2, 
  AlertCircle, History, Truck, RotateCcw, Send, Trash2, Edit2, 
  ArrowRightLeft, Sparkles, Filter, Calendar, X, Eye
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { FinishingRecord, InterDeptTransfer } from '../../../types';
import { getDepartmentReceivedSizeMap } from '../../../utils/sewingCalculationUtils';
import { PageHeader } from '../../common/PageHeader';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { useAuth } from '../../../context/AuthContext';
import { useERP } from '../../../context/ERPContext';
import { PermissionGuard } from '../../common/PermissionGuard';
import { DepartmentTransferQueue } from '../../common/DepartmentTransferQueue';
import { TransferChallanModal } from '../../common/TransferChallanModal';
import { FinishingProductionModal, FinishingProcessType } from './FinishingProductionModal';

export interface ProcessBatchSummary {
  key: string;
  orderId: string;
  buyer: string;
  styleNo: string;
  poNo: string;
  colour: string;
  orderTarget: number;
  finRecv: number;
  threadCut: number;
  iron: number;
  getUp: number;
  hangtag: number;
  poly: number;
  carton: number;
  readyShip: number;
  progressPercent: number;
  isCompleted: boolean;
  sizeBreakdown: {
    size: string;
    orderQty: number;
    finRecv: number;
    threadCut: number;
    iron: number;
    getUp: number;
    hangtag: number;
    poly: number;
    carton: number;
    readyShip: number;
    progressPercent: number;
  }[];
}

export const FinishingModule: React.FC = () => {
  const { currentUser, canOperate } = useAuth();
  const { activeModule } = useERP();

  // Core Data States
  const [finishingRecords, setFinishingRecords] = useState<FinishingRecord[]>(supabaseDataService.getFinishingRecords());
  const [transfers, setTransfers] = useState<InterDeptTransfer[]>(supabaseDataService.getTransfersByDepartment('Finishing'));

  // Active View Tab
  const [activeTab, setActiveTab] = useState<
    'all_matrix' | 'thread_cut' | 'iron' | 'get_up' | 'hangtag' | 'poly' | 'carton' | 'history' | 'incoming_transfers'
  >('all_matrix');

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState('ALL');
  const [selectedStyleFilter, setSelectedStyleFilter] = useState('ALL');
  const [selectedPoFilter, setSelectedPoFilter] = useState('ALL');
  const [selectedColourFilter, setSelectedColourFilter] = useState('ALL');
  const [selectedProcessFilter, setSelectedProcessFilter] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');

  // Expanded Batch row keys for size-wise breakdown view
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Modal States
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [productionModalInitial, setProductionModalInitial] = useState<{
    styleNo?: string;
    poNo?: string;
    colour?: string;
    size?: string;
    process?: FinishingProcessType;
  } | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferModalType, setTransferModalType] = useState<'Transfer' | 'Return'>('Transfer');
  const [transferDefaultToDept, setTransferDefaultToDept] = useState<'Sewing' | 'Shipment'>('Shipment');
  const [transferTargetItem, setTransferTargetItem] = useState<{ styleNo: string; poNo: string; colour: string; size: string; qty: number } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<FinishingRecord | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync with active module navigation
  useEffect(() => {
    if (activeModule === 'finishing' || activeModule === 'finishing_matrix') {
      setActiveTab('all_matrix');
    } else if (activeModule === 'finishing_thread_cut') {
      setActiveTab('thread_cut');
    } else if (activeModule === 'finishing_iron') {
      setActiveTab('iron');
    } else if (activeModule === 'finishing_get_up') {
      setActiveTab('get_up');
    } else if (activeModule === 'finishing_hangtag') {
      setActiveTab('hangtag');
    } else if (activeModule === 'finishing_poly') {
      setActiveTab('poly');
    } else if (activeModule === 'finishing_carton') {
      setActiveTab('carton');
    } else if (activeModule === 'finishing_transfers' || activeModule === 'finishing_receive' || activeModule === 'finishing_handover') {
      setActiveTab('incoming_transfers');
    }
  }, [activeModule]);

  // Subscribe to real-time data changes
  useEffect(() => {
    const handleUpdate = () => {
      setFinishingRecords([...supabaseDataService.getFinishingRecords()]);
      setTransfers([...supabaseDataService.getTransfersByDepartment('Finishing')]);
    };
    const unsubscribe = supabaseDataService.subscribe(handleUpdate);
    return () => unsubscribe();
  }, []);

  // Compute all unique Order Batches across Orders, Transfers, and Finishing Records
  const processBatches: ProcessBatchSummary[] = useMemo(() => {
    const orders = supabaseDataService.getOrders();
    const batchMap = new Map<string, ProcessBatchSummary>();

    // 1. Seed from Master Orders to capture every defined Style, PO, Colour
    orders.forEach(order => {
      const buyerName = order.buyer || 'Unknown Buyer';
      const sNo = order.styleNo;
      const orderId = order.id ? order.id.substring(0, 6).toUpperCase() : sNo;
      const styleAllowancePct = Number(order.allowancePct || 0);

      (order.purchaseOrders || []).forEach(po => {
        const pNo = po.poNo;
        const poAllowancePct = Number(po.allowancePct ?? styleAllowancePct);
        (po.colours || []).forEach(colItem => {
          const cName = colItem.colour;
          const key = `${sNo}___${pNo}___${cName}`;
          const colAllowancePct = Number(colItem.allowancePct ?? poAllowancePct);

          let colFactoryQty = Number(colItem.factoryQty) || 0;
          if (!colFactoryQty) {
            if (colItem.factorySizeQuantities && Object.keys(colItem.factorySizeQuantities).length > 0) {
              colFactoryQty = Object.values(colItem.factorySizeQuantities).reduce<number>((sum, q) => sum + (Number(q) || 0), 0);
            } else if (colAllowancePct > 0) {
              colFactoryQty = Math.round((colItem.totalQty || 0) * (1 + colAllowancePct / 100));
            } else {
              colFactoryQty = colItem.totalQty || 0;
            }
          }

          const sizeBreakdown = Object.entries(colItem.sizeQuantities || {}).map(([szName, qty]) => {
            const realQty = Number(qty) || 0;
            let szAllowance = 0;
            if (colItem.allowanceSizeQuantities && colItem.allowanceSizeQuantities[szName] !== undefined) {
              szAllowance = Number(colItem.allowanceSizeQuantities[szName]) || 0;
            } else if (colAllowancePct > 0) {
              szAllowance = Math.round(realQty * (colAllowancePct / 100));
            }
            let szFactoryQty = realQty + szAllowance;
            if (colItem.factorySizeQuantities && colItem.factorySizeQuantities[szName] !== undefined) {
              szFactoryQty = Number(colItem.factorySizeQuantities[szName]) || szFactoryQty;
            }

            return {
              size: szName,
              orderQty: szFactoryQty > 0 ? szFactoryQty : realQty,
              finRecv: 0,
              threadCut: 0,
              iron: 0,
              getUp: 0,
              hangtag: 0,
              poly: 0,
              carton: 0,
              readyShip: 0,
              progressPercent: 0
            };
          });

          // If no specific size quantities were defined, provide a default 'All Sizes'
          if (sizeBreakdown.length === 0) {
            sizeBreakdown.push({
              size: 'All Sizes',
              orderQty: colFactoryQty > 0 ? colFactoryQty : (colItem.totalQty || 0),
              finRecv: 0,
              threadCut: 0,
              iron: 0,
              getUp: 0,
              hangtag: 0,
              poly: 0,
              carton: 0,
              readyShip: 0,
              progressPercent: 0
            });
          }

          batchMap.set(key, {
            key,
            orderId,
            buyer: buyerName,
            styleNo: sNo,
            poNo: pNo,
            colour: cName,
            orderTarget: colFactoryQty > 0 ? colFactoryQty : (colItem.totalQty || 0),
            finRecv: 0,
            threadCut: 0,
            iron: 0,
            getUp: 0,
            hangtag: 0,
            poly: 0,
            carton: 0,
            readyShip: 0,
            progressPercent: 0,
            isCompleted: false,
            sizeBreakdown
          });
        });
      });
    });

    // 2. Incorporate Transfers received into Finishing (exact size-wise matching)
    const finishingTransfers = transfers.filter(t => t.toDepartment === 'Finishing' && t.status !== 'Rejected');
    
    batchMap.forEach(batch => {
      const orderSizeMap: Record<string, number> = {};
      batch.sizeBreakdown.forEach(s => {
        orderSizeMap[s.size] = s.orderQty || 0;
      });
      const finRecvMap = getDepartmentReceivedSizeMap('Finishing', batch.styleNo, batch.poNo, batch.colour, orderSizeMap, finishingTransfers, batch.buyer);
      const totalRecv = Object.values(finRecvMap).reduce((a, b) => a + b, 0);
      batch.finRecv = totalRecv;
      batch.sizeBreakdown.forEach(s => {
        s.finRecv = finRecvMap[s.size] || 0;
      });
    });

    // Also handle any transfers for styles not yet in master orders
    finishingTransfers.forEach(t => {
      const sNo = (t.styleNo || 'N/A').trim();
      const pNo = (t.poNo || 'N/A').trim();
      const cName = (t.colour || 'N/A').trim();
      const key = `${sNo}___${pNo}___${cName}`;

      // Check if this style is already handled by batches initialized from master orders
      const hasMatchingStyleBatch = Array.from(batchMap.values()).some(b => 
        (b.styleNo || '').trim().toUpperCase() === sNo.toUpperCase()
      );
      if (hasMatchingStyleBatch) {
        return;
      }

      if (!batchMap.has(key)) {
        const orderSizeMap: Record<string, number> = {};
        if (t.items && t.items.length > 0) {
          t.items.forEach(it => { orderSizeMap[it.size] = it.quantity || 0; });
        } else {
          orderSizeMap[t.size || 'All Sizes'] = t.quantity || 0;
        }
        const finRecvMap = getDepartmentReceivedSizeMap('Finishing', sNo, pNo, cName, orderSizeMap, finishingTransfers, t.buyer);
        const totalRecv = Object.values(finRecvMap).reduce((a, b) => a + b, 0);
        const sizeBreakdown = Object.entries(finRecvMap).map(([sz, q]) => ({
          size: sz,
          orderQty: q,
          finRecv: q,
          threadCut: 0,
          iron: 0,
          getUp: 0,
          hangtag: 0,
          poly: 0,
          carton: 0,
          readyShip: 0,
          progressPercent: 0
        }));
        batchMap.set(key, {
          key,
          orderId: sNo,
          buyer: t.buyer || 'Unknown Buyer',
          styleNo: sNo,
          poNo: pNo,
          colour: cName,
          orderTarget: totalRecv,
          finRecv: totalRecv,
          threadCut: 0,
          iron: 0,
          getUp: 0,
          hangtag: 0,
          poly: 0,
          carton: 0,
          readyShip: 0,
          progressPercent: 0,
          isCompleted: false,
          sizeBreakdown
        });
      }
    });

    // 3. Incorporate Finishing Records (Thread Cutting, Iron, Get Up, Hangtag, Poly, Carton, Ready for Ship)
    // First ensure any orphan finishing records for unmodeled styles create a batch
    finishingRecords.forEach(rec => {
      const sNo = (rec.styleNo || 'N/A').trim();
      const pNo = (rec.poNo || 'N/A').trim();
      const cName = (rec.colour || 'N/A').trim();
      const key = `${sNo}___${pNo}___${cName}`;

      const hasMatchingStyleBatch = Array.from(batchMap.values()).some(b => 
        (b.styleNo || '').trim().toUpperCase() === sNo.toUpperCase()
      );
      if (hasMatchingStyleBatch) {
        return;
      }

      if (!batchMap.has(key)) {
        batchMap.set(key, {
          key,
          orderId: sNo,
          buyer: rec.buyer || 'Unknown Buyer',
          styleNo: sNo,
          poNo: pNo,
          colour: cName,
          orderTarget: rec.sewingReceiveQty || rec.finishingInputQty || 0,
          finRecv: rec.sewingReceiveQty || rec.finishingInputQty || 0,
          threadCut: 0,
          iron: 0,
          getUp: 0,
          hangtag: 0,
          poly: 0,
          carton: 0,
          readyShip: 0,
          progressPercent: 0,
          isCompleted: false,
          sizeBreakdown: [{
            size: rec.size || 'All Sizes',
            orderQty: rec.sewingReceiveQty || 0,
            finRecv: rec.sewingReceiveQty || 0,
            threadCut: 0,
            iron: 0,
            getUp: 0,
            hangtag: 0,
            poly: 0,
            carton: 0,
            readyShip: 0,
            progressPercent: 0
          }]
        });
      }
    });

    // Compute exact metrics for each batch by calculating per size and summing
    batchMap.forEach(batch => {
      const matchingRecords = finishingRecords.filter(r => 
        r.styleNo?.trim().toUpperCase() === batch.styleNo.trim().toUpperCase() &&
        (!batch.poNo || !r.poNo || r.poNo.trim().toUpperCase() === batch.poNo.trim().toUpperCase()) &&
        (!batch.colour || !r.colour || r.colour.trim().toUpperCase() === batch.colour.trim().toUpperCase())
      );

      batch.threadCut = 0;
      batch.iron = 0;
      batch.getUp = 0;
      batch.hangtag = 0;
      batch.poly = 0;
      batch.carton = 0;
      batch.readyShip = 0;

      batch.sizeBreakdown.forEach(s => {
        const sizeRecords = matchingRecords.filter(r => 
          (r.size && r.size.trim().toUpperCase() === s.size.trim().toUpperCase()) || 
          (!r.size && s.size === 'All Sizes') ||
          (r.size === 'All Sizes' && batch.sizeBreakdown.length === 1)
        );

        s.threadCut = sizeRecords.reduce((max, r) => Math.max(max, (r.threadCutQty ?? r.sewingReceiveQty ?? 0)), 0);
        s.iron = sizeRecords.reduce((max, r) => Math.max(max, (r.ironedQty || 0)), 0);
        s.getUp = sizeRecords.reduce((max, r) => Math.max(max, (r.getUpQty || 0)), 0);
        s.hangtag = sizeRecords.reduce((max, r) => Math.max(max, (r.taggedQty || r.finishedQty || 0)), 0);
        s.poly = sizeRecords.reduce((max, r) => Math.max(max, (r.packedQty || r.polyQty || r.finishedQty || 0)), 0);
        s.carton = sizeRecords.reduce((max, r) => Math.max(max, (r.cartonQty || 0)), 0);
        s.readyShip = sizeRecords.reduce((max, r) => Math.max(max, (r.readyForShipmentQty || (r.isReadyForShipment ? (r.packedQty || 0) : 0))), 0);

        batch.threadCut += s.threadCut;
        batch.iron += s.iron;
        batch.getUp += s.getUp;
        batch.hangtag += s.hangtag;
        batch.poly += s.poly;
        batch.carton += s.carton;
        batch.readyShip += s.readyShip;
      });
    });

    // 4. Calculate progress percentages for batches and individual sizes
    const list = Array.from(batchMap.values()).map(batch => {
      // Progress calculation: Based on Ready for Ship or Poly completed vs Order Target
      const target = batch.orderTarget > 0 ? batch.orderTarget : (batch.finRecv > 0 ? batch.finRecv : 1);
      const done = batch.readyShip > 0 ? batch.readyShip : batch.poly;
      batch.progressPercent = Math.min(100, Math.round((done / target) * 100));
      batch.isCompleted = batch.progressPercent >= 100;

      // Size progress calculations
      batch.sizeBreakdown.forEach(s => {
        const sTarget = s.orderQty > 0 ? s.orderQty : (s.finRecv > 0 ? s.finRecv : 1);
        const sDone = s.readyShip > 0 ? s.readyShip : s.poly;
        s.progressPercent = Math.min(100, Math.round((sDone / sTarget) * 100));
      });

      return batch;
    });

    return list;
  }, [finishingRecords, transfers]);

  // Executive Top KPI Cards Totals
  const kpiTotals = useMemo(() => {
    let finishingRecv = 0;
    let threadCut = 0;
    let iron = 0;
    let getUp = 0;
    let hangtag = 0;
    let poly = 0;
    let carton = 0;
    let readyShip = 0;

    processBatches.forEach(b => {
      finishingRecv += b.finRecv;
      threadCut += b.threadCut;
      iron += b.iron;
      getUp += b.getUp;
      hangtag += b.hangtag;
      poly += b.poly;
      carton += b.carton;
      readyShip += b.readyShip;
    });

    return {
      finishingRecv,
      threadCut,
      iron,
      getUp,
      hangtag,
      poly,
      carton,
      readyShip
    };
  }, [processBatches]);

  // Unique filter lists
  const buyersList = useMemo(() => {
    const s = new Set<string>();
    processBatches.forEach(b => { if (b.buyer) s.add(b.buyer); });
    return Array.from(s);
  }, [processBatches]);

  const stylesList = useMemo(() => {
    const s = new Set<string>();
    processBatches.forEach(b => { if (b.styleNo) s.add(b.styleNo); });
    return Array.from(s);
  }, [processBatches]);

  const poList = useMemo(() => {
    const s = new Set<string>();
    processBatches.forEach(b => { if (b.poNo) s.add(b.poNo); });
    return Array.from(s);
  }, [processBatches]);

  const coloursList = useMemo(() => {
    const s = new Set<string>();
    processBatches.forEach(b => { if (b.colour) s.add(b.colour); });
    return Array.from(s);
  }, [processBatches]);

  // Filtered Batches based on Search and Dropdown filters
  const filteredBatches = useMemo(() => {
    return processBatches.filter(b => {
      // Buyer filter
      if (selectedBuyerFilter !== 'ALL' && b.buyer !== selectedBuyerFilter) return false;
      // Style filter
      if (selectedStyleFilter !== 'ALL' && b.styleNo !== selectedStyleFilter) return false;
      // PO filter
      if (selectedPoFilter !== 'ALL' && b.poNo !== selectedPoFilter) return false;
      // Colour filter
      if (selectedColourFilter !== 'ALL' && b.colour !== selectedColourFilter) return false;

      // Dropdown Process Filter (if specifically set by user)
      if (selectedProcessFilter !== 'ALL') {
        if (selectedProcessFilter === 'Thread Cutting' && b.threadCut === 0 && b.finRecv === 0) return false;
        if (selectedProcessFilter === 'Iron' && b.iron === 0 && b.threadCut === 0) return false;
        if (selectedProcessFilter === 'Get Up' && b.getUp === 0 && b.iron === 0) return false;
        if (selectedProcessFilter === 'Hang Tag' && b.hangtag === 0 && b.getUp === 0) return false;
        if (selectedProcessFilter === 'Poly' && b.poly === 0 && b.hangtag === 0) return false;
        if (selectedProcessFilter === 'Carton' && b.carton === 0 && b.poly === 0) return false;
        if (selectedProcessFilter === 'Ready for Shipment' && b.readyShip === 0 && b.carton === 0) return false;
      }

      // Search term
      if (searchTerm && searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matches = 
          (b.styleNo || '').toLowerCase().includes(q) ||
          (b.poNo || '').toLowerCase().includes(q) ||
          (b.colour || '').toLowerCase().includes(q) ||
          (b.buyer || '').toLowerCase().includes(q) ||
          (b.orderId || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [
    processBatches,
    selectedBuyerFilter,
    selectedStyleFilter,
    selectedPoFilter,
    selectedColourFilter,
    selectedProcessFilter,
    activeTab,
    searchTerm
  ]);

  // Overall Total Summary for Table Footer
  const tableSummary = useMemo(() => {
    let orderTarget = 0;
    let finRecv = 0;
    let threadCut = 0;
    let iron = 0;
    let getUp = 0;
    let hangtag = 0;
    let poly = 0;
    let carton = 0;
    let readyShip = 0;

    filteredBatches.forEach(b => {
      orderTarget += b.orderTarget;
      finRecv += b.finRecv;
      threadCut += b.threadCut;
      iron += b.iron;
      getUp += b.getUp;
      hangtag += b.hangtag;
      poly += b.poly;
      carton += b.carton;
      readyShip += b.readyShip;
    });

    const overallPct = orderTarget > 0 ? Math.min(100, Math.round((readyShip || poly) / orderTarget * 100)) : 0;

    return {
      batchCount: filteredBatches.length,
      orderTarget,
      finRecv,
      threadCut,
      iron,
      getUp,
      hangtag,
      poly,
      carton,
      readyShip,
      overallPct
    };
  }, [filteredBatches]);

  // Toggle row expansion for size breakdown
  const toggleRowExpansion = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Open Production Entry Modal
  const handleOpenProductionModal = (prefill?: {
    styleNo?: string;
    poNo?: string;
    colour?: string;
    size?: string;
    process?: FinishingProcessType;
  }) => {
    let defaultProc: FinishingProcessType = 'Thread Cutting';
    if (activeTab === 'thread_cut') defaultProc = 'Thread Cutting';
    else if (activeTab === 'iron') defaultProc = 'Iron';
    else if (activeTab === 'get_up') defaultProc = 'Get Up';
    else if (activeTab === 'hangtag') defaultProc = 'Hang Tag';
    else if (activeTab === 'poly') defaultProc = 'Poly';
    else if (activeTab === 'carton') defaultProc = 'Carton';

    setProductionModalInitial({
      ...prefill,
      process: prefill?.process || defaultProc
    });
    setIsProductionModalOpen(true);
  };

  // Open Transfer Challan Modal
  const handleOpenTransferModal = (type: 'Transfer' | 'Return', toDept: 'Sewing' | 'Shipment' = 'Shipment', item?: { styleNo: string; poNo: string; colour: string; size?: string; qty?: number }) => {
    setTransferModalType(type);
    setTransferDefaultToDept(toDept);
    if (item) {
      setTransferTargetItem({
        styleNo: item.styleNo,
        poNo: item.poNo,
        colour: item.colour,
        size: item.size || 'All Sizes',
        qty: item.qty || 0
      });
    } else {
      setTransferTargetItem(null);
    }
    setIsTransferModalOpen(true);
  };

  // Delete finishing record confirmation
  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      await supabaseDataService.deleteFinishingRecord(deleteTarget.id, currentUser?.name);
      setDeleteTarget(null);
      setSuccessMessage('Finishing record deleted successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const pendingFinishingInbound = transfers.filter(t => t.toDepartment === 'Finishing' && t.status === 'Dispatched').length;

  return (
    <div className="space-y-4 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* Top Header Card Matching Exact UI Spec */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-600 dark:text-blue-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Finishing & Packing Floor Master
              </h1>
              <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 rounded-full text-xs font-black uppercase tracking-wider border border-blue-200 dark:border-blue-700">
                Process-Wise Flow
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-1.5 flex-wrap">
              <span>Sequential flow:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Thread Cutting ➔ Iron ➔ Get Up ➔ Hangtag ➔ Poly ➔ Carton ➔ Ready for Shipment.
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ExportPrintToolbar title="Finishing Process Matrix" data={filteredBatches} filename="Finishing_Floor_Master" />

          <PermissionGuard dept="Finishing" permission="CREATE">
            <button
              onClick={() => handleOpenTransferModal('Transfer', 'Sewing')}
              className="px-3 py-2 bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 rounded-xl text-xs font-bold hover:bg-cyan-100 flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Send className="w-4 h-4" />
              <span>Gate Pass / Return</span>
            </button>
          </PermissionGuard>

          <PermissionGuard dept="Finishing" permission="CREATE">
            <button
              onClick={() => handleOpenProductionModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold rounded-xl text-xs shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Finishing Production Entry</span>
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {/* 8 Top Process Metric KPI Cards (Matching Image) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {/* Card 1: Finishing Receive */}
        <div 
          onClick={() => setActiveTab('incoming_transfers')}
          className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-slate-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              FINISHING RECV
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100">
            {kpiTotals.finishingRecv.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            From Wash/Sew
          </div>
        </div>

        {/* Card 2: 1. Thread Cut */}
        <div 
          onClick={() => setActiveTab('thread_cut')}
          className="bg-white dark:bg-slate-900 p-3 rounded-xl border-t-2 border-t-emerald-500 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-emerald-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              1. THREAD CUT
            </span>
            <Scissors className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">
            {kpiTotals.threadCut.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Thread Trim
          </div>
        </div>

        {/* Card 3: 2. Iron */}
        <div 
          onClick={() => setActiveTab('iron')}
          className="bg-white dark:bg-slate-900 p-3 rounded-xl border-t-2 border-t-amber-500 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-amber-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
              2. IRON
            </span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-black text-amber-700 dark:text-amber-300">
            {kpiTotals.iron.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Steam Press
          </div>
        </div>

        {/* Card 4: 3. Get Up */}
        <div 
          onClick={() => setActiveTab('get_up')}
          className="bg-white dark:bg-slate-900 p-3 rounded-xl border-t-2 border-t-cyan-500 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-cyan-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-400 flex items-center gap-1">
              3. GET UP
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div className="text-lg font-black text-cyan-700 dark:text-cyan-300">
            {kpiTotals.getUp.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            QC Inspection
          </div>
        </div>

        {/* Card 5: 4. Hangtag */}
        <div 
          onClick={() => setActiveTab('hangtag')}
          className="bg-white dark:bg-slate-900 p-3 rounded-xl border-t-2 border-t-purple-500 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-purple-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-1">
              4. HANGTAG
            </span>
            <Tag className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-lg font-black text-purple-700 dark:text-purple-300">
            {kpiTotals.hangtag.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Price & Tag
          </div>
        </div>

        {/* Card 6: 5. Poly */}
        <div 
          onClick={() => setActiveTab('poly')}
          className="bg-white dark:bg-slate-900 p-3 rounded-xl border-t-2 border-t-blue-500 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-blue-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1">
              5. POLY
            </span>
            <Box className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-lg font-black text-blue-700 dark:text-blue-300">
            {kpiTotals.poly.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Poly Pack
          </div>
        </div>

        {/* Card 7: 6. Carton */}
        <div 
          onClick={() => setActiveTab('carton')}
          className="bg-white dark:bg-slate-900 p-3 rounded-xl border-t-2 border-t-indigo-500 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-indigo-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
              6. CARTON
            </span>
            <Archive className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-lg font-black text-indigo-700 dark:text-indigo-300">
            {kpiTotals.carton.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Box Packing
          </div>
        </div>

        {/* Card 8: Ready for Ship */}
        <div 
          onClick={() => setActiveTab('all_matrix')}
          className="bg-white dark:bg-slate-900 p-3 rounded-xl border-t-2 border-t-green-600 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-green-400 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-green-700 dark:text-green-400 flex items-center gap-1">
              READY FOR SHIP
            </span>
            <PackageCheck className="w-3.5 h-3.5 text-green-600" />
          </div>
          <div className="text-lg font-black text-green-700 dark:text-green-300">
            {kpiTotals.readyShip.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Carton Verified
          </div>
        </div>
      </div>

      {/* Dropdown Filters Bar with Search */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-black uppercase text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Process Filter & Search</span>
          </div>
          <div className="relative w-full sm:w-64 md:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search Style, PO, Colour, Process..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
          {/* Buyer */}
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
              BUYER
            </label>
            <select
              value={selectedBuyerFilter}
              onChange={e => setSelectedBuyerFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-bold focus:ring-2 focus:ring-blue-500 text-xs"
            >
              <option value="ALL">All Buyers</option>
              {buyersList.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Style */}
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
              STYLE
            </label>
            <select
              value={selectedStyleFilter}
              onChange={e => setSelectedStyleFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-bold focus:ring-2 focus:ring-blue-500 text-xs"
            >
              <option value="ALL">All Styles</option>
              {stylesList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* PO Number */}
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
              PO NUMBER
            </label>
            <select
              value={selectedPoFilter}
              onChange={e => setSelectedPoFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-bold focus:ring-2 focus:ring-blue-500 text-xs"
            >
              <option value="ALL">All POs</option>
              {poList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Colour */}
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
              COLOUR
            </label>
            <select
              value={selectedColourFilter}
              onChange={e => setSelectedColourFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-bold focus:ring-2 focus:ring-blue-500 text-xs"
            >
              <option value="ALL">All Colours</option>
              {coloursList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Process Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
              PROCESS
            </label>
            <select
              value={selectedProcessFilter}
              onChange={e => setSelectedProcessFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-bold focus:ring-2 focus:ring-blue-500 text-xs"
            >
              <option value="ALL">All Processes</option>
              <option value="Thread Cutting">1. Thread Cutting</option>
              <option value="Iron">2. Iron</option>
              <option value="Get Up">3. Get Up</option>
              <option value="Hang Tag">4. Hang Tag</option>
              <option value="Poly">5. Poly Pack</option>
              <option value="Carton">6. Carton Pack</option>
              <option value="Ready for Shipment">Ready for Ship</option>
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
              DATE
            </label>
            <input
              type="date"
              value={selectedDateFilter}
              onChange={e => setSelectedDateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'incoming_transfers' ? (
        <div className="bg-white dark:bg-slate-900 p-2 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <DepartmentTransferQueue
            department="Finishing"
            defaultToDept="Shipment"
            title="Finishing Section Handover, Inbound & Outbound Challan Queue"
          />
        </div>
      ) : activeTab === 'history' ? (
        /* History Log View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-black flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <span>Finishing Production History Logs ({finishingRecords.length})</span>
            </h3>
            <PermissionGuard dept="Finishing" permission="CREATE">
              <button
                onClick={() => handleOpenProductionModal()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Production Entry</span>
              </button>
            </PermissionGuard>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Style / PO</th>
                  <th className="p-3">Colour</th>
                  <th className="p-3">Size</th>
                  <th className="p-3 text-right">Recv</th>
                  <th className="p-3 text-right text-emerald-600">Thread Cut</th>
                  <th className="p-3 text-right text-amber-600">Iron</th>
                  <th className="p-3 text-right text-cyan-600">Get Up</th>
                  <th className="p-3 text-right text-purple-600">Tagged</th>
                  <th className="p-3 text-right text-blue-600">Poly</th>
                  <th className="p-3 text-right text-indigo-600">Carton</th>
                  <th className="p-3">Supervisor</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {finishingRecords.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-6 text-center text-slate-400 italic">
                      No finishing production records logged yet.
                    </td>
                  </tr>
                ) : (
                  finishingRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-medium text-slate-600 dark:text-slate-400">{rec.date}</td>
                      <td className="p-3 font-bold text-blue-600">
                        {rec.styleNo} <span className="text-[10px] text-slate-400 block font-normal">{rec.poNo}</span>
                      </td>
                      <td className="p-3 font-medium">{rec.colour}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-extrabold text-[11px]">
                          {rec.size || 'All Sizes'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium">{(rec.sewingReceiveQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{(rec.threadCutQty ?? rec.sewingReceiveQty ?? 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-amber-600">{(rec.ironedQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-cyan-600">{(rec.getUpQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-purple-600">{(rec.taggedQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-blue-600">{(rec.packedQty || rec.polyQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-indigo-600">{(rec.cartonQty || 0).toLocaleString()}</td>
                      <td className="p-3 text-slate-500">{rec.operator}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <PermissionGuard dept="Finishing" permission="CREATE">
                            <button
                              onClick={() => handleOpenProductionModal({ styleNo: rec.styleNo, poNo: rec.poNo, colour: rec.colour, size: rec.size })}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Add Production"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </PermissionGuard>
                          <PermissionGuard dept="Finishing" permission="DELETE">
                            <button
                              onClick={() => setDeleteTarget(rec)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </PermissionGuard>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Main Processes Matrix Table (Matches User Screenshot Exact UI) */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              {/* Header Columns */}
              <thead className="bg-slate-100/90 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                <tr>
                  <th className="p-3 w-40">ORDER / BUYER</th>
                  <th className="p-3 w-36">STYLE & PO</th>
                  <th className="p-3 w-28">COLOUR</th>
                  <th className="p-3 text-right w-28">FACTORY ORDER QTY</th>
                  <th className="p-3 text-right w-24">FIN. RECV</th>
                  <th className="p-3 text-right w-28 text-emerald-700 dark:text-emerald-400">1. THREAD CUT</th>
                  <th className="p-3 text-right w-24 text-amber-700 dark:text-amber-400">2. IRON</th>
                  <th className="p-3 text-right w-24 text-cyan-700 dark:text-cyan-400">3. GET UP</th>
                  <th className="p-3 text-right w-24 text-purple-700 dark:text-purple-400">4. HANGTAG</th>
                  <th className="p-3 text-right w-24 text-blue-700 dark:text-blue-400">5. POLY</th>
                  <th className="p-3 text-right w-24 text-indigo-700 dark:text-indigo-400">6. CARTON</th>
                  <th className="p-3 text-right w-28 text-green-700 dark:text-green-400 bg-green-50/40 dark:bg-green-950/20">READY SHIP</th>
                  <th className="p-3 w-32">PROGRESS</th>
                  <th className="p-3 text-center w-36">QUICK LOG ACTION</th>
                </tr>
              </thead>

              {/* Data Rows */}
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-8 text-center text-slate-400 italic">
                      No matching order batches found for the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map(batch => {
                    const isExpanded = expandedRows.has(batch.key);
                    const isComplete = batch.isCompleted;

                    return (
                      <React.Fragment key={batch.key}>
                        {/* Main Batch Row */}
                        <tr
                          className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition-colors ${
                            isComplete ? 'bg-green-50/20 dark:bg-green-950/10' : ''
                          }`}
                        >
                          {/* ORDER / BUYER */}
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <button
                                onClick={() => toggleRowExpansion(batch.key)}
                                className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400"
                              >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                              <span>{batch.orderId}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                              {batch.buyer}
                            </div>
                          </td>

                          {/* STYLE & PO */}
                          <td className="p-3">
                            <span className="font-bold text-blue-600 dark:text-blue-400">
                              {batch.styleNo}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-normal">
                              {batch.poNo}
                            </span>
                          </td>

                          {/* COLOUR */}
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            {batch.colour}
                          </td>

                          {/* ORDER TARGET */}
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                            {batch.orderTarget.toLocaleString()}
                          </td>

                          {/* FIN. RECV */}
                          <td className="p-3 text-right font-bold text-slate-800 dark:text-slate-200">
                            {batch.finRecv.toLocaleString()}
                          </td>

                          {/* 1. THREAD CUT */}
                          <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {batch.threadCut.toLocaleString()}
                          </td>

                          {/* 2. IRON */}
                          <td className="p-3 text-right font-bold text-amber-600 dark:text-amber-400">
                            {batch.iron.toLocaleString()}
                          </td>

                          {/* 3. GET UP */}
                          <td className="p-3 text-right font-bold text-cyan-600 dark:text-cyan-400">
                            {batch.getUp.toLocaleString()}
                          </td>

                          {/* 4. HANGTAG */}
                          <td className="p-3 text-right font-bold text-purple-600 dark:text-purple-400">
                            {batch.hangtag.toLocaleString()}
                          </td>

                          {/* 5. POLY */}
                          <td className="p-3 text-right font-bold text-blue-600 dark:text-blue-400">
                            {batch.poly.toLocaleString()}
                          </td>

                          {/* 6. CARTON */}
                          <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                            {batch.carton.toLocaleString()}
                          </td>

                          {/* READY SHIP */}
                          <td className="p-3 text-right font-black text-green-700 dark:text-green-300 bg-green-50/40 dark:bg-green-950/20">
                            {batch.readyShip.toLocaleString()}
                          </td>

                          {/* PROGRESS */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    isComplete ? 'bg-emerald-500' : 'bg-blue-600'
                                  }`}
                                  style={{ width: `${batch.progressPercent}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-9 text-right">
                                {batch.progressPercent}%
                              </span>
                            </div>
                          </td>

                          {/* QUICK LOG & TRANSFER ACTIONS */}
                          <td className="p-3 text-center">
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                              <PermissionGuard dept="Finishing" permission="CREATE">
                                <button
                                  onClick={() => handleOpenProductionModal({ styleNo: batch.styleNo, poNo: batch.poNo, colour: batch.colour })}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 shadow-2xs transition-all transform active:scale-95 whitespace-nowrap"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Log</span>
                                </button>
                              </PermissionGuard>
                              {(batch.readyShip > 0 || batch.carton > 0 || batch.poly > 0) && (
                                <PermissionGuard dept="Finishing" permission="CREATE">
                                  <button
                                    onClick={() => handleOpenTransferModal('Transfer', 'Shipment', {
                                      styleNo: batch.styleNo,
                                      poNo: batch.poNo,
                                      colour: batch.colour,
                                      qty: batch.readyShip > 0 ? batch.readyShip : (batch.carton > 0 ? batch.carton : batch.poly)
                                    })}
                                    title="Issue Gate Pass / Challan to Shipment"
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black text-[11px] flex items-center justify-center gap-1 shadow-2xs transition-all whitespace-nowrap"
                                  >
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>To Ship</span>
                                  </button>
                                </PermissionGuard>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Size Breakdown Expanded Sub-Table */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                            <td colSpan={14} className="p-3 pl-8">
                              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden shadow-2xs">
                                <div className="px-3.5 py-2 bg-slate-100/70 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                  <span className="text-[11px] font-extrabold uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                                    Size-Wise Sequential Process Breakdown for {batch.styleNo} ({batch.colour})
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    Click '+ Log' next to any size to record process output
                                  </span>
                                </div>

                                <table className="w-full text-xs text-left border-collapse">
                                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">
                                    <tr>
                                      <th className="p-2.5">Size</th>
                                      <th className="p-2.5 text-right">Factory Order Qty</th>
                                      <th className="p-2.5 text-right">Fin Recv</th>
                                      <th className="p-2.5 text-right text-emerald-600">Thread Cut</th>
                                      <th className="p-2.5 text-right text-amber-600">Iron</th>
                                      <th className="p-2.5 text-right text-cyan-600">Get Up</th>
                                      <th className="p-2.5 text-right text-purple-600">Hangtag</th>
                                      <th className="p-2.5 text-right text-blue-600">Poly</th>
                                      <th className="p-2.5 text-right text-indigo-600">Carton</th>
                                      <th className="p-2.5 text-right text-green-600">Ready Ship</th>
                                      <th className="p-2.5 text-right w-24">Progress</th>
                                      <th className="p-2.5 text-center w-24">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {batch.sizeBreakdown.map(sz => (
                                      <tr key={sz.size} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                        <td className="p-2 font-extrabold text-slate-900 dark:text-slate-100">
                                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-black text-xs">
                                            {sz.size}
                                          </span>
                                        </td>
                                        <td className="p-2 text-right font-medium">{sz.orderQty.toLocaleString()}</td>
                                        <td className="p-2 text-right font-bold">{sz.finRecv.toLocaleString()}</td>
                                        <td className="p-2 text-right font-bold text-emerald-600">{sz.threadCut.toLocaleString()}</td>
                                        <td className="p-2 text-right font-bold text-amber-600">{sz.iron.toLocaleString()}</td>
                                        <td className="p-2 text-right font-bold text-cyan-600">{sz.getUp.toLocaleString()}</td>
                                        <td className="p-2 text-right font-bold text-purple-600">{sz.hangtag.toLocaleString()}</td>
                                        <td className="p-2 text-right font-bold text-blue-600">{sz.poly.toLocaleString()}</td>
                                        <td className="p-2 text-right font-bold text-indigo-600">{sz.carton.toLocaleString()}</td>
                                        <td className="p-2 text-right font-black text-green-600">{sz.readyShip.toLocaleString()}</td>
                                        <td className="p-2 text-right font-bold text-slate-600 dark:text-slate-400">
                                          {sz.progressPercent}%
                                        </td>
                                        <td className="p-2 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <button
                                              onClick={() => handleOpenProductionModal({ styleNo: batch.styleNo, poNo: batch.poNo, colour: batch.colour, size: sz.size })}
                                              className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-bold hover:bg-blue-100"
                                            >
                                              + Log
                                            </button>
                                            {(sz.readyShip > 0 || sz.carton > 0 || sz.poly > 0) && (
                                              <button
                                                onClick={() => handleOpenTransferModal('Transfer', 'Shipment', {
                                                  styleNo: batch.styleNo,
                                                  poNo: batch.poNo,
                                                  colour: batch.colour,
                                                  size: sz.size,
                                                  qty: sz.readyShip > 0 ? sz.readyShip : (sz.carton > 0 ? sz.carton : sz.poly)
                                                })}
                                                title={`Transfer ${sz.size} (${sz.readyShip || sz.carton || sz.poly} pcs) to Shipment`}
                                                className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded text-[10px] font-extrabold hover:bg-emerald-100 flex items-center gap-0.5"
                                              >
                                                <Truck className="w-2.5 h-2.5" />
                                                <span>Ship</span>
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>

              {/* Total Summary Footer Row (Matching Dark Navy in Image) */}
              <tfoot className="bg-slate-950 text-white font-black text-xs sticky bottom-0">
                <tr>
                  <td className="p-3 text-white uppercase tracking-wider" colSpan={3}>
                    TOTAL SUMMARY ({tableSummary.batchCount} BATCHES)
                  </td>
                  <td className="p-3 text-right text-white">
                    {tableSummary.orderTarget.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-blue-300">
                    {tableSummary.finRecv.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-emerald-400">
                    {tableSummary.threadCut.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-amber-400">
                    {tableSummary.iron.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-cyan-400">
                    {tableSummary.getUp.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-purple-400">
                    {tableSummary.hangtag.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-blue-400">
                    {tableSummary.poly.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-indigo-400">
                    {tableSummary.carton.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-green-400 bg-emerald-950">
                    {tableSummary.readyShip.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-emerald-300 font-extrabold" colSpan={2}>
                    {tableSummary.overallPct}% Completed
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Production Entry Modal */}
      {isProductionModalOpen && (
        <FinishingProductionModal
          isOpen={isProductionModalOpen}
          onClose={() => setIsProductionModalOpen(false)}
          initialData={productionModalInitial}
          onSaved={() => {
            setFinishingRecords([...supabaseDataService.getFinishingRecords()]);
            setSuccessMessage('Finishing production entry saved successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
          }}
        />
      )}

      {/* Transfer / Gate Pass Challan Modal */}
      {isTransferModalOpen && (
        <TransferChallanModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setTransferTargetItem(null);
          }}
          defaultFromDept="Finishing"
          defaultToDept={transferDefaultToDept || 'Shipment'}
          initialTransferType={transferModalType}
          initialStyleNo={transferTargetItem?.styleNo}
          initialPoNo={transferTargetItem?.poNo}
          initialColour={transferTargetItem?.colour}
          initialSize={transferTargetItem?.size}
          maxAvailableQty={transferTargetItem?.qty}
          onSuccess={() => {
            setTransfers([...supabaseDataService.getTransfersByDepartment('Finishing')]);
            setSuccessMessage(transferDefaultToDept === 'Shipment' ? 'Finished goods successfully transferred to Shipment Department!' : 'Gate Pass / Return Challan saved successfully!');
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <ConfirmationDialog
          isOpen={Boolean(deleteTarget)}
          title="Delete Finishing Record"
          message={`Are you sure you want to delete the finishing entry for Style "${deleteTarget.styleNo}" (${deleteTarget.colour}, ${deleteTarget.size})? This action cannot be undone.`}
          confirmLabel="Delete Record"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
