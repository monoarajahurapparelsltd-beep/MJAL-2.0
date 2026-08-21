import React, { useState, useEffect, useMemo } from 'react';
import {
  Shirt,
  Plus,
  Target,
  CheckCircle2,
  Edit,
  Trash2,
  AlertCircle,
  Layers,
  Send,
  Building2,
  Check,
  RotateCcw,
  Palette,
  FileSpreadsheet,
  Filter,
  X,
  Sparkles,
  Box
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { SewingProduction, SewingLine, SewingTarget, InterDeptTransfer } from '../../../types';
import { PageHeader } from '../../common/PageHeader';
import { StatCard } from '../../common/StatCard';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { ProductionEntryModal } from '../../common/ProductionEntryModal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { PermissionGuard } from '../../common/PermissionGuard';
import { useAuth } from '../../../context/AuthContext';
import { useERP } from '../../../context/ERPContext';
import { OrderHierarchySelector, OrderSelectionValue } from '../../common/OrderHierarchySelector';
import { DepartmentTransferQueue } from '../../common/DepartmentTransferQueue';
import { TransferChallanModal } from '../../common/TransferChallanModal';
import { getSewingInputReceivedBreakdown, getSewingSizeWiseBreakdownGroup, getDepartmentReceivedSizeMap } from '../../../utils/sewingCalculationUtils';

const fallbackLines: SewingLine[] = [
  { id: '00000000-0000-0000-0004-000000000001', lineNo: 'Line No 1', lineName: 'Line No 1', capacityPerDay: 800, supervisorName: 'Shahidul Islam', status: 'Active' },
  { id: '00000000-0000-0000-0004-000000000002', lineNo: 'Line No 2', lineName: 'Line No 2', capacityPerDay: 800, supervisorName: 'Monirul Haque', status: 'Active' },
  { id: '00000000-0000-0000-0004-000000000003', lineNo: 'Line No 3', lineName: 'Line No 3', capacityPerDay: 900, supervisorName: 'Faruk Ahmed', status: 'Active' },
  { id: '00000000-0000-0000-0004-000000000004', lineNo: 'Line No 4', lineName: 'Line No 4', capacityPerDay: 1200, supervisorName: 'Selim Reza', status: 'Active' },
  { id: '00000000-0000-0000-0004-000000000005', lineNo: 'Line No 5', lineName: 'Line No 5', capacityPerDay: 850, supervisorName: 'Abdul Malek', status: 'Active' },
  { id: '00000000-0000-0000-0004-000000000006', lineNo: 'Line No 6', lineName: 'Line No 6', capacityPerDay: 800, supervisorName: 'Rakibul Hasan', status: 'Active' },
  { id: '00000000-0000-0000-0004-000000000007', lineNo: 'Line No 7', lineName: 'Line No 7', capacityPerDay: 800, supervisorName: 'Mizanur Rahman', status: 'Active' },
  { id: '00000000-0000-0000-0004-000000000008', lineNo: 'Line No 8', lineName: 'Line No 8', capacityPerDay: 850, supervisorName: 'Kabir Hossain', status: 'Active' },
  { id: '00000000-0000-0000-0004-000000000009', lineNo: 'Line No 9', lineName: 'Line No 9', capacityPerDay: 900, supervisorName: 'Sultan Mahmud', status: 'Active' },
  { id: '00000000-0000-0000-0004-000000000010', lineNo: 'Line No 10', lineName: 'Line No 10', capacityPerDay: 950, supervisorName: 'Tareq Rahman', status: 'Active' },
];

export const SewingModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { activeModule } = useERP();
  const [production, setProduction] = useState<SewingProduction[]>(supabaseDataService.getSewingProduction());
  const [lines, setLines] = useState<SewingLine[]>(supabaseDataService.getSewingLines());
  const [targets, setTargets] = useState<SewingTarget[]>(supabaseDataService.getSewingTargets());
  const [transfers, setTransfers] = useState<InterDeptTransfer[]>(supabaseDataService.getTransfers());
  const [orders, setOrders] = useState<any[]>(supabaseDataService.getOrders());
  const [activeTab, setActiveTab] = useState<'production' | 'input_received' | 'targets' | 'transfers'>('production');

  useEffect(() => {
    if (activeModule === 'sewing_input_receive') {
      setActiveTab('input_received');
    } else if (activeModule === 'sewing_handover') {
      setActiveTab('transfers');
    } else if (activeModule === 'sewing_targets' || activeModule === 'targets_daily' || activeModule === 'targets_monthly') {
      setActiveTab('targets');
    } else if (activeModule === 'sewing' || activeModule === 'sewing_production') {
      setActiveTab('production');
    }
  }, [activeModule]);

  const [selectedLineFilter, setSelectedLineFilter] = useState<string>('ALL');

  const activeLines = useMemo(() => {
    return (lines && lines.length > 0) ? lines : fallbackLines;
  }, [lines]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferModalType, setTransferModalType] = useState<'Transfer' | 'Return'>('Transfer');
  const [transferDefaultToDept, setTransferDefaultToDept] = useState<'Cutting' | 'Washing' | 'Finishing'>('Finishing');
  const [transferTargetItem, setTransferTargetItem] = useState<{ styleNo: string; poNo: string; colour: string; size: string; qty: number } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'production' | 'target'; id: string; title: string } | null>(null);
  const [selectedProd, setSelectedProd] = useState<SewingProduction | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<SewingTarget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receivingTransferId, setReceivingTransferId] = useState<string | null>(null);
  const [receiverNameInput, setReceiverNameInput] = useState('');
  const [receivingTransferQty, setReceivingTransferQty] = useState<number>(0);

  // Production Form Custom Fields (Line, Target, Alter, Reject, Rework)
  const [lineNo, setLineNo] = useState('Line No 1');
  const [dailyTarget, setDailyTarget] = useState<number | ''>('');
  const [alterQty, setAlterQty] = useState<number | ''>('');
  const [rejectQty, setRejectQty] = useState<number | ''>('');
  const [reworkQty, setReworkQty] = useState<number | ''>('');

  // Target Form fields
  const [buyer, setBuyer] = useState('');
  const [styleNo, setStyleNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [colour, setColour] = useState('');

  useEffect(() => {
    const update = () => {
      setProduction([...supabaseDataService.getSewingProduction()]);
      setLines([...supabaseDataService.getSewingLines()]);
      setTargets([...supabaseDataService.getSewingTargets()]);
      setTransfers([...supabaseDataService.getTransfers()]);
      setOrders([...supabaseDataService.getOrders()]);
    };
    update();
    const unsub = supabaseDataService.subscribe(update);
    return unsub;
  }, []);

  // Compute Sewing Input Received breakdown and stats
  const sewingInputStats = useMemo(() => {
    return getSewingInputReceivedBreakdown(transfers);
  }, [transfers]);

  // Compute Style & Size-Wise Order vs Received vs Done vs Remaining Balance Breakdown
  const sizeWiseBreakdownGroups = useMemo(() => {
    return getSewingSizeWiseBreakdownGroup(orders, transfers, production);
  }, [orders, transfers, production]);

  // Interactive Filter States for Sewing Input Received & Size Breakdown Display
  const [inputFilterBuyer, setInputFilterBuyer] = useState<string>('ALL');
  const [inputFilterStyle, setInputFilterStyle] = useState<string>('ALL');
  const [inputFilterPo, setInputFilterPo] = useState<string>('ALL');
  const [inputFilterColour, setInputFilterColour] = useState<string>('ALL');

  // Dynamic Buyer Options from Orders & Size Breakdown Groups
  const inputBuyerOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.buyer) set.add(o.buyer.trim()); });
    sizeWiseBreakdownGroups.forEach(g => { if (g.buyer) set.add(g.buyer.trim()); });
    return Array.from(set).sort();
  }, [orders, sizeWiseBreakdownGroups]);

  // Dynamic Style Options filtered by selected buyer
  const inputStyleOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (inputFilterBuyer === 'ALL' || o.buyer?.trim() === inputFilterBuyer) {
        if (o.styleNo) set.add(o.styleNo.trim());
      }
    });
    sizeWiseBreakdownGroups.forEach(g => {
      if (inputFilterBuyer === 'ALL' || g.buyer?.trim() === inputFilterBuyer) {
        if (g.styleNo) set.add(g.styleNo.trim());
      }
    });
    return Array.from(set).sort();
  }, [orders, sizeWiseBreakdownGroups, inputFilterBuyer]);

  // Dynamic PO Options filtered by selected buyer and style
  const inputPoOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (inputFilterBuyer === 'ALL' || o.buyer?.trim() === inputFilterBuyer) {
        if (inputFilterStyle === 'ALL' || o.styleNo?.trim() === inputFilterStyle) {
          o.purchaseOrders?.forEach((po: any) => {
            if (po.poNo) set.add(po.poNo.trim());
          });
        }
      }
    });
    sizeWiseBreakdownGroups.forEach(g => {
      if (inputFilterBuyer === 'ALL' || g.buyer?.trim() === inputFilterBuyer) {
        if (inputFilterStyle === 'ALL' || g.styleNo?.trim() === inputFilterStyle) {
          if (g.poNo) set.add(g.poNo.trim());
        }
      }
    });
    return Array.from(set).sort();
  }, [orders, sizeWiseBreakdownGroups, inputFilterBuyer, inputFilterStyle]);

  // Dynamic Colour Options filtered by selected buyer, style, and PO
  const inputColourOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (inputFilterBuyer === 'ALL' || o.buyer?.trim() === inputFilterBuyer) {
        if (inputFilterStyle === 'ALL' || o.styleNo?.trim() === inputFilterStyle) {
          o.purchaseOrders?.forEach((po: any) => {
            if (inputFilterPo === 'ALL' || po.poNo?.trim() === inputFilterPo) {
              po.colours?.forEach((c: any) => {
                if (c.colour) set.add(c.colour.trim());
              });
            }
          });
        }
      }
    });
    sizeWiseBreakdownGroups.forEach(g => {
      if (inputFilterBuyer === 'ALL' || g.buyer?.trim() === inputFilterBuyer) {
        if (inputFilterStyle === 'ALL' || g.styleNo?.trim() === inputFilterStyle) {
          if (inputFilterPo === 'ALL' || g.poNo?.trim() === inputFilterPo) {
            if (g.colour) set.add(g.colour.trim());
          }
        }
      }
    });
    return Array.from(set).sort();
  }, [orders, sizeWiseBreakdownGroups, inputFilterBuyer, inputFilterStyle, inputFilterPo]);

  // Filtered Size-Wise Breakdown Groups based on selected Buyer, Style, PO, and Colour
  const filteredSizeWiseBreakdownGroups = useMemo(() => {
    return sizeWiseBreakdownGroups.filter(g => {
      const matchBuyer = inputFilterBuyer === 'ALL' || g.buyer?.trim() === inputFilterBuyer;
      const matchStyle = inputFilterStyle === 'ALL' || g.styleNo?.trim() === inputFilterStyle;
      const matchPo = inputFilterPo === 'ALL' || g.poNo?.trim() === inputFilterPo;
      const matchColour = inputFilterColour === 'ALL' || g.colour?.trim() === inputFilterColour;
      return matchBuyer && matchStyle && matchPo && matchColour;
    });
  }, [sizeWiseBreakdownGroups, inputFilterBuyer, inputFilterStyle, inputFilterPo, inputFilterColour]);

  // Filtered Input Received Detailed Breakdown Table
  const filteredTableBreakdown = useMemo(() => {
    return sewingInputStats.breakdown.filter(item => {
      const matchStyle = inputFilterStyle === 'ALL' || item.styleNo?.trim() === inputFilterStyle;
      const matchPo = inputFilterPo === 'ALL' || item.poNo?.trim() === inputFilterPo;
      const matchColour = inputFilterColour === 'ALL' || item.colour?.trim() === inputFilterColour;
      return matchStyle && matchPo && matchColour;
    });
  }, [sewingInputStats.breakdown, inputFilterStyle, inputFilterPo, inputFilterColour]);

  // Total received in currently filtered view
  const filteredTotalReceivedQty = useMemo(() => {
    return filteredSizeWiseBreakdownGroups.reduce((sum, g) => sum + (g.totalReceivedQty || 0), 0);
  }, [filteredSizeWiseBreakdownGroups]);

  const totalFinishedOutput = useMemo(() => {
    return production.reduce((sum, p) => sum + (p.totalOutput || 0), 0);
  }, [production]);

  const currentWIP = Math.max(0, sewingInputStats.totalInputReceived - totalFinishedOutput);

  const isLineMatch = (recordLine: string, filterLine: string) => {
    if (filterLine === 'ALL') return true;
    if (!recordLine) return false;
    const num1 = recordLine.replace(/[^0-9]/g, '');
    const num2 = filterLine.replace(/[^0-9]/g, '');
    return recordLine === filterLine || (num1 !== '' && num1 === num2);
  };

  // Filter production records by selected line
  const filteredProduction = useMemo(() => {
    if (selectedLineFilter === 'ALL') return production;
    return production.filter(p => isLineMatch(p.lineNo, selectedLineFilter));
  }, [production, selectedLineFilter]);

  const handleOpenTransferModal = (type: 'Transfer' | 'Return', targetDept: 'Cutting' | 'Washing' | 'Finishing' = 'Finishing', item?: SewingProduction) => {
    setTransferModalType(type);
    setTransferDefaultToDept(targetDept);
    if (item) {
      setTransferTargetItem({
        styleNo: item.styleNo,
        poNo: item.poNo,
        colour: item.colour,
        size: item.size || 'All Sizes',
        qty: item.totalOutput || 0
      });
    } else {
      setTransferTargetItem(null);
    }
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransferReceive = async (transferId: string) => {
    const receiver = receiverNameInput.trim() || currentUser?.name || 'Sewing Supervisor';
    const targetTransfer = transfers.find(t => t.id === transferId);
    const qtyToReceive = receivingTransferQty > 0 ? receivingTransferQty : (targetTransfer?.quantity || 0);
    setIsLoading(true);
    const res = await supabaseDataService.receiveTransfer(transferId, receiver, currentUser?.name, qtyToReceive);
    setIsLoading(false);
    if (res.success) {
      setReceivingTransferId(null);
      setReceiverNameInput('');
      setReceivingTransferQty(0);
      setTransfers([...supabaseDataService.getTransfers()]);
    } else {
      setErrorMessage(res.error || 'Failed to acknowledge input receipt');
    }
  };

  const resetTargetForm = () => {
    setSelectedTarget(null);
    setBuyer('');
    setStyleNo('');
    setPoNo('');
    setColour('');
    setDailyTarget('');
    setLineNo(activeLines[0]?.lineNo || 'Line No 1');
    setErrorMessage(null);
  };

  const handleOpenAddProd = () => {
    setSelectedProd(null);
    setLineNo(currentUser?.line_no || activeLines[0]?.lineNo || 'Line No 1');
    setDailyTarget('');
    setAlterQty('');
    setRejectQty('');
    setReworkQty('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenAddTarget = () => {
    resetTargetForm();
    setIsTargetModalOpen(true);
  };

  const handleOpenEditProd = (prod: SewingProduction) => {
    setSelectedProd(prod);
    setLineNo(prod.lineNo);
    setDailyTarget(prod.dailyTarget || '');
    setAlterQty(prod.alterQty || '');
    setRejectQty(prod.rejectQty || '');
    setReworkQty(prod.reworkQty || '');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEditTarget = (target: SewingTarget) => {
    setSelectedTarget(target);
    setLineNo(target.lineNo);
    setStyleNo(target.styleNo);
    setPoNo(target.poNo);
    setColour(target.colour);
    setDailyTarget(target.dailyTargetQty);
    setErrorMessage(null);
    setIsTargetModalOpen(true);
  };

  const handleOpenDelete = (type: 'production' | 'target', id: string, title: string) => {
    setItemToDelete({ type, id, title });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsLoading(true);
    let res;
    if (itemToDelete.type === 'production') {
      res = await supabaseDataService.deleteSewingProduction(itemToDelete.id, currentUser?.name);
    } else {
      res = await supabaseDataService.deleteSewingTarget(itemToDelete.id, currentUser?.name);
    }
    setIsLoading(false);
    if (!res.success) {
      setErrorMessage(res.error || 'Failed to delete record from database.');
    } else {
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const handleSaveSewingFromModal = async (data: {
    buyer: string;
    styleNo: string;
    poNo: string;
    colour: string;
    sizeWiseQuantities: Record<string, number>;
    totalNewQty: number;
    notes: string;
  }) => {
    setIsLoading(true);
    setErrorMessage(null);

    const dateStr = selectedProd ? selectedProd.date : new Date().toISOString().substring(0, 10);
    const numTarget = Number(dailyTarget) || 0;
    const numAlter = Number(alterQty) || 0;
    const numReject = Number(rejectQty) || 0;
    const numRework = Number(reworkQty) || 0;

    const sizeKeys = Object.keys(data.sizeWiseQuantities);

    // Compute size-wise received map
    const allTransfers = supabaseDataService.getTransfers();
    const currentOrder = orders.find(o => (o.styleNo || '').trim().toUpperCase() === (data.styleNo || '').trim().toUpperCase());
    const currentPo = currentOrder?.purchaseOrders?.find((p: any) => (p.poNo || '').trim().toUpperCase() === (data.poNo || '').trim().toUpperCase());
    const currentColourObj = currentPo?.colours?.find((c: any) => (c.colour || '').trim().toUpperCase() === (data.colour || '').trim().toUpperCase());
    const receivedMap = getDepartmentReceivedSizeMap('Sewing', data.styleNo, data.poNo, data.colour, currentColourObj?.sizeQuantities || {}, allTransfers);

    if (sizeKeys.length > 0) {
      for (const sz of sizeKeys) {
        const qty = data.sizeWiseQuantities[sz];
        if (qty > 0) {
          const prodId = selectedProd && selectedProd.size === sz
            ? selectedProd.id
            : 'sew-' + Date.now() + '-' + String(sz || '').toLowerCase() + '-' + Math.random().toString(36).substring(2, 6);
          const orderProgress = supabaseDataService.getStylePoColourProgress(data.styleNo, data.poNo, data.colour);
          const szObj = orderProgress?.sizeBreakdown?.find(s => (s.size || '').trim().toUpperCase() === String(sz || '').trim().toUpperCase());
          const sizeOrderQty = szObj ? szObj.orderQty : qty;
          const sizeReceivedQty = receivedMap[sz] || 0;
          const effectiveInputQty = sizeReceivedQty > 0 ? sizeReceivedQty : sizeOrderQty;

          const prodToSave: SewingProduction = {
            id: prodId,
            date: dateStr,
            lineNo: lineNo || 'Line No 1',
            buyer: data.buyer || 'Unknown Buyer',
            styleNo: data.styleNo,
            poNo: data.poNo,
            colour: data.colour,
            size: sz,
            inputQty: effectiveInputQty,
            dailyTarget: numTarget > 0 ? Math.round(numTarget / sizeKeys.length) : effectiveInputQty,
            hourlyOutputs: [],
            totalOutput: qty,
            alterQty: numAlter,
            rejectQty: numReject,
            reworkQty: numRework,
            wipQty: Math.max(0, effectiveInputQty - qty),
            remarks: data.notes,
            submittedBy: currentUser?.name || 'Sewing Supervisor',
            submissionTime: new Date().toTimeString().substring(0, 5),
            lineSupervisor: currentUser?.name || 'Sewing In-charge'
          };
          await supabaseDataService.saveSewingProduction(prodToSave, currentUser?.name);
        }
      }
    } else {
      const prodId = selectedProd ? selectedProd.id : 'sew-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const prodToSave: SewingProduction = {
        id: prodId,
        date: dateStr,
        lineNo: lineNo || 'Line No 1',
        buyer: data.buyer || 'Unknown Buyer',
        styleNo: data.styleNo,
        poNo: data.poNo,
        colour: data.colour,
        size: 'All Sizes',
        inputQty: data.totalNewQty,
        dailyTarget: numTarget > 0 ? numTarget : data.totalNewQty,
        hourlyOutputs: [],
        totalOutput: data.totalNewQty,
        alterQty: numAlter,
        rejectQty: numReject,
        reworkQty: numRework,
        wipQty: 0,
        remarks: data.notes,
        submittedBy: currentUser?.name || 'Sewing Supervisor',
        submissionTime: new Date().toTimeString().substring(0, 5),
        lineSupervisor: currentUser?.name || 'Sewing In-charge'
      };
      await supabaseDataService.saveSewingProduction(prodToSave, currentUser?.name);
    }

    setIsLoading(false);
    setIsModalOpen(false);
    setProduction([...supabaseDataService.getSewingProduction()]);
  };

  const handleOrderHierarchySelect = (selection: OrderSelectionValue) => {
    setBuyer(selection.buyer);
    setStyleNo(selection.styleNo);
    setPoNo(selection.poNo);
    setColour(selection.colour);
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const sNo = styleNo.trim();
    const pNo = poNo.trim();
    const col = colour.trim();

    if (!sNo || !pNo || !col) {
      setErrorMessage('Please select a valid Master Order (Style, PO, and Colour).');
      return;
    }

    if (!dailyTarget || Number(dailyTarget) <= 0) {
      setErrorMessage('Daily target quantity must be a positive number.');
      return;
    }

    setIsLoading(true);

    const numDailyTarget = Number(dailyTarget);

    const existingTarget = !selectedTarget
      ? targets.find(t => t.styleNo === sNo && t.poNo === pNo && t.colour === col && t.lineNo === lineNo)
      : null;

    const targetId = selectedTarget ? selectedTarget.id : (existingTarget ? existingTarget.id : 'tgt-' + Date.now());

    const targetToSave: SewingTarget = {
      id: targetId,
      lineNo,
      date: selectedTarget ? selectedTarget.date : new Date().toISOString().substring(0, 10),
      month: new Date().toISOString().substring(0, 7),
      styleNo: sNo,
      poNo: pNo,
      colour: col,
      dailyTargetQty: numDailyTarget,
      hourlyTargetQty: Math.round(numDailyTarget / 10),
      workingDays: 26,
      monthlyTargetQty: numDailyTarget * 26
    };

    const res = await supabaseDataService.saveSewingTarget(targetToSave, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save line target to database.');
    } else {
      setIsTargetModalOpen(false);
      resetTargetForm();
    }
  };

  const productionColumns: Column<SewingProduction>[] = [
    {
      header: 'Last Update Date',
      accessorKey: 'lastUpdateDate',
      sortable: true,
      cell: p => <span className="font-bold text-slate-800">{p.lastUpdateDate || p.date}</span>
    },
    {
      header: 'Line No',
      accessorKey: 'lineNo',
      sortable: true,
      cell: p => <span className="font-bold text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-100">{p.lineNo}</span>
    },
    {
      header: 'Buyer / Style',
      cell: p => <div><span className="font-bold text-blue-600">{p.styleNo}</span> <span className="text-[11px] text-slate-500 block">{p.buyer}</span></div>
    },
    {
      header: 'PO & Colour',
      cell: p => <div><span className="font-semibold text-slate-800">{p.poNo}</span> <span className="text-[11px] text-slate-500 block">{p.colour}</span></div>
    },
    {
      header: 'Size',
      accessorKey: 'size',
      cell: p => (
        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200 text-xs">
          {p.size || 'All Sizes'}
        </span>
      )
    },
    {
      header: 'Daily Target',
      cell: p => <span className="font-bold text-slate-800">{p.dailyTarget ? `${p.dailyTarget.toLocaleString()} pcs` : '-'}</span>
    },
    {
      header: 'Sewing Output',
      cell: p => <span className="font-black text-indigo-700">{(p.totalOutput || 0).toLocaleString()} pcs</span>
    },
    {
      header: 'Due Qty',
      cell: p => {
        const due = Math.max(0, (p.dailyTarget || 0) - (p.totalOutput || 0));
        return (p.dailyTarget && p.dailyTarget > 0 && due === 0) ? (
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Target Completed
          </span>
        ) : p.dailyTarget && p.dailyTarget > 0 ? (
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            {(due || 0).toLocaleString()} pcs due
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        );
      }
    },
    {
      header: 'Achievement %',
      cell: p => {
        const ach = p.dailyTarget > 0 ? Math.round((p.totalOutput / p.dailyTarget) * 100) : 100;
        return (
          <span className={`font-extrabold ${ach >= 90 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {ach}%
          </span>
        );
      }
    },
    {
      header: 'Alter / Reject',
      cell: p => <span className="text-xs text-rose-600 font-semibold">{p.alterQty || 0} / {p.rejectQty || 0}</span>
    },
    {
      header: 'Floor WIP',
      cell: p => <span className="font-bold text-amber-600">{p.wipQty || 0} pcs</span>
    },
    { header: 'Supervisor', accessorKey: 'submittedBy' },
    {
      header: 'Actions',
      cell: p => (
        <div className="flex items-center gap-1.5">
          <PermissionGuard dept="Sewing" permission="CREATE">
            <button
              onClick={() => handleOpenTransferModal('Transfer', 'Finishing', p)}
              title="Issue Handover Challan (Wash / Direct Finishing)"
              className="p-1.5 text-cyan-600 hover:text-cyan-800 hover:bg-cyan-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Handover</span>
            </button>
          </PermissionGuard>
          <PermissionGuard dept="Sewing" permission="EDIT">
            <button
              onClick={() => handleOpenEditProd(p)}
              title="Edit Record"
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          </PermissionGuard>
          <PermissionGuard dept="Sewing" permission="DELETE">
            <button
              onClick={() => handleOpenDelete('production', p.id, `${p.lineNo} - ${p.styleNo}`)}
              title="Delete Record"
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGuard>
        </div>
      )
    }
  ];

  const renderSewingProductionFooter = (data: SewingProduction[]) => {
    const totalTarget = data.reduce((sum, p) => sum + (p.dailyTarget || 0), 0);
    const totalOutput = data.reduce((sum, p) => sum + (p.totalOutput || 0), 0);
    const totalDue = data.reduce((sum, p) => sum + Math.max(0, (p.dailyTarget || 0) - (p.totalOutput || 0)), 0);
    const totalAlter = data.reduce((sum, p) => sum + (p.alterQty || 0), 0);
    const totalReject = data.reduce((sum, p) => sum + (p.rejectQty || 0), 0);
    const totalWip = data.reduce((sum, p) => sum + (p.wipQty || 0), 0);
    const overallAch = totalTarget > 0 ? Math.round((totalOutput / totalTarget) * 100) : 100;

    return (
      <tr className="bg-slate-950 text-white font-black text-xs">
        <td className="px-2.5 py-3 text-white uppercase tracking-wider" colSpan={5}>
          TOTAL SUMMARY ({data.length} RECORDS)
        </td>
        <td className="px-2.5 py-3 text-white font-mono">
          {totalTarget > 0 ? `${totalTarget.toLocaleString()} pcs` : '-'}
        </td>
        <td className="px-2.5 py-3 text-indigo-300 font-mono">
          {totalOutput.toLocaleString()} pcs
        </td>
        <td className="px-2.5 py-3">
          {totalDue === 0 && totalTarget > 0 ? (
            <span className="text-emerald-400 font-mono">Target Completed</span>
          ) : totalTarget > 0 ? (
            <span className="text-rose-400 font-mono">{totalDue.toLocaleString()} pcs due</span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
        <td className="px-2.5 py-3 text-emerald-400 font-mono">
          {overallAch}%
        </td>
        <td className="px-2.5 py-3 text-rose-300 font-mono">
          {totalAlter} / {totalReject}
        </td>
        <td className="px-2.5 py-3 text-amber-400 font-mono">
          {totalWip.toLocaleString()} pcs
        </td>
        <td className="px-2.5 py-3 text-slate-400" colSpan={2}>
          -
        </td>
      </tr>
    );
  };

  const renderWindowHeader = () => {
    if (activeModule === 'sewing_input_receive') {
      return (
        <PageHeader
          title="Sewing Input Receiving & Cut Panel Verification"
          description="Acknowledge incoming bundle challans from Cutting section with size-wise tally"
          actions={
            <div className="flex items-center gap-2">
              <ExportPrintToolbar title="Sewing Received Inputs" data={transfers.filter(t => t.toDepartment === 'Sewing')} filename="Sewing_Received_Inputs" />
              {sewingInputStats.pendingTransfers.length > 0 && (
                <span className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-black animate-pulse flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {sewingInputStats.pendingTransfers.length} Pending Cuts to Receive
                </span>
              )}
            </div>
          }
        />
      );
    }

    if (activeModule === 'targets_daily' || activeModule === 'targets_monthly') {
      return (
        <PageHeader
          title="Sewing Line Target Output Allocation"
          description="Set and manage daily output targets per line and master order"
          actions={
            <div className="flex items-center gap-2">
              <PermissionGuard dept="Sewing" permission="CREATE">
                <button
                  onClick={handleOpenAddTarget}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                >
                  <Target className="h-4 w-4" />
                  Set / Change Line Target
                </button>
              </PermissionGuard>
            </div>
          }
        />
      );
    }

    if (activeModule === 'sewing_handover') {
      return (
        <PageHeader
          title="Sewing Handover & Gate Pass Management"
          description="Issue inter-department transfers from Sewing to Washing, Finishing, or QC with Challans"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm"
              >
                <Send className="h-4 w-4" />
                <span>Issue Handover Challan</span>
              </button>
            </div>
          }
        />
      );
    }

    return (
      <PageHeader
        title="Sewing Line Output & Daily Production Log"
        description="Line-wise size matrix production tracking, line targets, and floor WIP monitoring"
        actions={
          <div className="flex items-center gap-2">
            <ExportPrintToolbar title="Sewing Production" data={production} filename="MJAL_Sewing_Log" />
            <PermissionGuard dept="Sewing" permission="CREATE">
              <button
                onClick={() => handleOpenTransferModal('Return', 'Cutting')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-2xs transition-colors"
              >
                <RotateCcw className="h-4 w-4 text-amber-700" />
                <span>Return to Cutting</span>
              </button>
            </PermissionGuard>
            <PermissionGuard dept="Sewing" permission="CREATE">
              <button
                onClick={() => handleOpenTransferModal('Transfer', 'Finishing')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm transition-colors"
              >
                <Send className="h-4 w-4" />
                <span>Issue Handover Challan</span>
              </button>
            </PermissionGuard>
            <PermissionGuard dept="Sewing" permission="CREATE">
              <button
                onClick={handleOpenAddTarget}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Target className="h-4 w-4 text-blue-600" />
                Change Line Target
              </button>
            </PermissionGuard>
            <PermissionGuard dept="Sewing" permission="CREATE">
              <button
                onClick={handleOpenAddProd}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                New Sewing Entry
              </button>
            </PermissionGuard>
          </div>
        }
      />
    );
  };

  const sewingTransfersList = transfers.filter(t => t.fromDepartment === 'Sewing' || t.toDepartment === 'Sewing');
  const pendingSewingOutgoing = transfers.filter(t => t.fromDepartment === 'Sewing' && t.status === 'Dispatched').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {renderWindowHeader()}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Production View */}
      {activeTab === 'production' && (
        <div className="space-y-4">
          {/* Key Production Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Total Sewing Output"
              value={`${(totalFinishedOutput || 0).toLocaleString()} pcs`}
              subtitle="All Lines Output Recorded"
              icon={Shirt}
              variant="blue"
            />
            <StatCard
              title="Total Input Received"
              value={`${(sewingInputStats?.totalInputReceived || 0).toLocaleString()} pcs`}
              subtitle="Cut Panels Confirmed into Sewing"
              icon={CheckCircle2}
              variant="emerald"
            />
            <StatCard
              title="Floor WIP Balance"
              value={`${(currentWIP || 0).toLocaleString()} pcs`}
              subtitle="Received in Sewing - Total Output"
              trend={currentWIP === 0 ? 'Balanced' : `${currentWIP.toLocaleString()} pcs in WIP`}
              trendType={currentWIP === 0 ? 'positive' : 'neutral'}
              icon={Layers}
              variant={currentWIP === 0 ? 'emerald' : 'amber'}
            />
            <StatCard
              title="Active Production Lines"
              value={`${activeLines.length} Lines`}
              subtitle="Sewing Floor Line Capacity"
              icon={Building2}
              variant="purple"
            />
          </div>

          {/* Line Selection Filter */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-bold">
            <span className="text-slate-500 text-[11px] px-2 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-blue-600" /> Filter Line:
            </span>
            {['ALL', ...activeLines.map(l => l.lineNo)].map(lineKey => (
              <button
                key={lineKey}
                type="button"
                onClick={() => setSelectedLineFilter(lineKey)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedLineFilter === lineKey
                    ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {lineKey === 'ALL' ? `All ${activeLines.length} Lines` : lineKey}
              </button>
            ))}
          </div>

          <DataTable
            data={filteredProduction}
            columns={productionColumns}
            keyExtractor={p => p.id}
            searchPlaceholder="Search sewing production..."
            footerRow={renderSewingProductionFooter}
          />
        </div>
      )}

      {/* Sewing Input Received & Style/Size Breakdown Tab */}
      {activeTab === 'input_received' && (
        <div className="space-y-6">
          {/* Incoming Pending Transfers requiring confirmation */}
          {sewingInputStats.pendingTransfers.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-900">
                    Pending Incoming Inputs to Confirm ({sewingInputStats.pendingTransfers.length} Challans)
                  </h3>
                </div>
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  {(sewingInputStats?.pendingInputToReceive || 0).toLocaleString()} pcs Waiting
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sewingInputStats.pendingTransfers.map(t => (
                  <div key={t.id} className="p-3 bg-white rounded-lg border border-amber-200 shadow-2xs space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-blue-700">{t.challanNo}</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                        From {t.fromDepartment}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-slate-700">
                      <p>Style: <strong className="text-slate-900">{t.styleNo}</strong></p>
                      <p>PO: <strong className="text-slate-900">{t.poNo}</strong></p>
                      <p>Colour: <strong>{t.colour}</strong></p>
                      <p>Size: <strong className="text-purple-700">{t.size || 'All Sizes'}</strong></p>
                      <p className="col-span-2 text-indigo-700 font-extrabold text-sm mt-1">
                        Input Quantity: {(t.quantity || 0).toLocaleString()} pcs
                      </p>
                    </div>

                    {receivingTransferId === t.id ? (
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={receiverNameInput}
                            onChange={e => setReceiverNameInput(e.target.value)}
                            placeholder="Receiver name"
                            className="flex-1 text-xs border rounded p-1.5 font-semibold"
                          />
                          <input
                            type="number"
                            min={1}
                            max={t.quantity}
                            value={receivingTransferQty}
                            onChange={e => setReceivingTransferQty(Math.max(1, parseInt(e.target.value) || 0))}
                            placeholder="Qty"
                            title={`Max: ${t.quantity} pcs`}
                            className="w-20 text-xs border rounded p-1.5 font-black text-emerald-700"
                          />
                          <button
                            onClick={() => handleConfirmTransferReceive(t.id)}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setReceivingTransferId(null)}
                            className="px-2 py-1.5 text-xs text-slate-500"
                          >
                            Cancel
                          </button>
                        </div>
                        {receivingTransferQty > 0 && receivingTransferQty < t.quantity && (
                          <span className="text-[10px] text-purple-700 font-bold">
                            Remaining {t.quantity - receivingTransferQty} pcs will stay in inbound queue
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReceivingTransferId(t.id);
                          setReceiverNameInput(currentUser?.name || 'Sewing Supervisor');
                          setReceivingTransferQty(t.quantity);
                        }}
                        className="w-full mt-2 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center justify-center gap-1.5"
                      >
                        <Check className="h-4 w-4" />
                        <span>Confirm Input Received</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirmed Sewing Input Received Breakdown */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Sewing Input Received — Style & Size Breakdown Display</span>
                </h3>
                <p className="text-xs text-slate-500">Exact pcs received into Sewing section for each Style and Size</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                  Confirmed Received: <strong className="text-blue-700 text-sm">{(sewingInputStats?.totalInputReceived || 0).toLocaleString()} pcs</strong>
                </span>
                <span className="font-bold text-slate-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                  Floor WIP: <strong className="text-amber-800 text-sm">{(currentWIP || 0).toLocaleString()} pcs</strong>
                </span>
              </div>
            </div>

            {/* Cascading Filter Selection Controls (Buyer, Style, PO, Colour) */}
            <div className="bg-slate-50 text-slate-800 p-4 rounded-xl shadow-xs space-y-3.5 border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Select Buyer, Style, PO & Colour to Display Size-Wise Received Quantities
                  </span>
                </div>
                {(inputFilterBuyer !== 'ALL' || inputFilterStyle !== 'ALL' || inputFilterPo !== 'ALL' || inputFilterColour !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputFilterBuyer('ALL');
                      setInputFilterStyle('ALL');
                      setInputFilterPo('ALL');
                      setInputFilterColour('ALL');
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100/80 hover:bg-amber-200 px-2.5 py-1 rounded-lg border border-amber-300 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    <span>Reset All Filters</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Buyer Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>1. Buyer</span>
                  </label>
                  <select
                    value={inputFilterBuyer}
                    onChange={e => {
                      const newBuyer = e.target.value;
                      setInputFilterBuyer(newBuyer);
                      setInputFilterStyle('ALL');
                      setInputFilterPo('ALL');
                      setInputFilterColour('ALL');
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none shadow-xs"
                  >
                    <option value="ALL">All Buyers ({inputBuyerOptions.length})</option>
                    {inputBuyerOptions.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Style Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                    <Shirt className="h-3.5 w-3.5 text-indigo-600" />
                    <span>2. Style No</span>
                  </label>
                  <select
                    value={inputFilterStyle}
                    onChange={e => {
                      const newStyle = e.target.value;
                      setInputFilterStyle(newStyle);
                      setInputFilterPo('ALL');
                      setInputFilterColour('ALL');
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none shadow-xs"
                  >
                    <option value="ALL">All Styles ({inputStyleOptions.length})</option>
                    {inputStyleOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* 3. PO Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-teal-600" />
                    <span>3. PO No</span>
                  </label>
                  <select
                    value={inputFilterPo}
                    onChange={e => {
                      const newPo = e.target.value;
                      setInputFilterPo(newPo);
                      setInputFilterColour('ALL');
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none shadow-xs"
                  >
                    <option value="ALL">All POs ({inputPoOptions.length})</option>
                    {inputPoOptions.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* 4. Colour Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5 text-emerald-600" />
                    <span>4. Colour</span>
                  </label>
                  <select
                    value={inputFilterColour}
                    onChange={e => {
                      setInputFilterColour(e.target.value);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none shadow-xs"
                  >
                    <option value="ALL">All Colours ({inputColourOptions.length})</option>
                    {inputColourOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Filter Result Summary & Size-Wise Breakdown */}
            {filteredSizeWiseBreakdownGroups.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs px-1 text-slate-600 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    Showing size breakdown for <strong>{filteredSizeWiseBreakdownGroups.length} variation(s)</strong>
                  </span>
                  <span className="text-slate-500">
                    Filtered Received Qty: <strong className="text-emerald-700 font-bold">{filteredTotalReceivedQty.toLocaleString()} pcs</strong>
                  </span>
                </div>

                {filteredSizeWiseBreakdownGroups.map((group, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 text-slate-800 p-3.5 px-4 rounded-xl space-y-3 shadow-xs hover:border-slate-300 transition-all"
                  >
                    {/* Header bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="bg-blue-600 text-white text-xs font-black uppercase px-2.5 py-1 rounded-md tracking-wider shadow-xs flex items-center gap-1">
                          <span className="opacity-80 text-[9px] font-medium uppercase tracking-normal">Buyer:</span>
                          <span>{group.buyer || 'BUYER'}</span>
                        </span>

                        <div className="text-xs font-bold text-slate-700 flex items-center gap-2 flex-wrap">
                          <span>Style: <strong className="text-slate-900 font-extrabold text-sm">{group.styleNo}</strong></span>
                          <span className="text-slate-300">•</span>
                          <span>PO: <strong className="text-slate-900 font-extrabold text-sm">{group.poNo}</strong></span>
                          <span className="text-slate-300">•</span>
                          <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                            Colour: {group.colour}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Total Received: <strong className="font-black text-emerald-900">{(group.totalReceivedQty || 0).toLocaleString()} pcs</strong></span>
                        </span>
                        {group.totalOrderQty > 0 && (
                          <span className="text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg">
                            Factory Order: {group.totalOrderQty.toLocaleString()} pcs
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Size-Wise Received Quantities Display */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <span>Size-Wise Received Quantities (pcs):</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                        {group.sizes.map(s => {
                          const hasReceived = (s.receivedQty || 0) > 0;
                          return (
                            <div
                              key={s.size}
                              className={`p-2.5 rounded-lg border flex flex-col justify-between transition-all ${
                                hasReceived
                                  ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                                  : 'bg-slate-50/80 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className={hasReceived ? "text-emerald-900 font-extrabold text-xs" : "text-slate-700 font-bold text-xs"}>
                                  {(s.size || '').toLowerCase().startsWith('size') ? s.size : `Size ${s.size}`}
                                </span>
                                {s.orderQty > 0 && (
                                  <span className="text-[10px] text-slate-500 font-medium">Fact: {s.orderQty}</span>
                                )}
                              </div>
                              <div className="mt-1.5 flex items-baseline justify-between">
                                <span className="text-[10px] text-slate-500 uppercase font-semibold">Received:</span>
                                <span
                                  className={`text-xs font-black px-1.5 py-0.5 rounded ${
                                    hasReceived
                                      ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                                      : 'text-slate-400 bg-slate-100'
                                  }`}
                                >
                                  {(s.receivedQty || 0).toLocaleString()} pcs
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
                <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">No Size Breakdown Found for Selected Filters</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No confirmed input receive records matched Buyer: <strong>{inputFilterBuyer}</strong>, Style: <strong>{inputFilterStyle}</strong>, PO: <strong>{inputFilterPo}</strong>, Colour: <strong>{inputFilterColour}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInputFilterBuyer('ALL');
                    setInputFilterStyle('ALL');
                    setInputFilterPo('ALL');
                    setInputFilterColour('ALL');
                  }}
                  className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs"
                >
                  Show All Records
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <th className="p-2.5">Style No</th>
                    <th className="p-2.5">PO No</th>
                    <th className="p-2.5">Colour</th>
                    <th className="p-2.5">Size</th>
                    <th className="p-2.5">Received Qty (pcs)</th>
                    <th className="p-2.5">Total Batches</th>
                    <th className="p-2.5">Last Received Date</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTableBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-400 font-semibold">
                        No confirmed input received records match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTableBreakdown.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2.5 font-extrabold text-blue-700">{item.styleNo}</td>
                        <td className="p-2.5 font-semibold text-slate-800">{item.poNo}</td>
                        <td className="p-2.5 font-medium text-slate-700">{item.colour}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200 text-[11px]">
                            {item.size}
                          </span>
                        </td>
                        <td className="p-2.5 font-black text-indigo-700 text-sm">{(item.totalReceivedQty || 0).toLocaleString()} pcs</td>
                        <td className="p-2.5 font-semibold text-slate-600">{item.challanCount} batches</td>
                        <td className="p-2.5 text-slate-500 font-medium">{item.lastReceiveDate}</td>
                        <td className="p-2.5 font-bold">
                          <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                            Input Received Confirmed
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-950 text-white font-black text-xs sticky bottom-0">
                  <tr>
                    <td className="p-3 text-white uppercase tracking-wider" colSpan={4}>
                      TOTAL SUMMARY ({filteredTableBreakdown.length} ITEMS)
                    </td>
                    <td className="p-3 text-indigo-300 font-mono text-sm">
                      {filteredTableBreakdown.reduce((sum, item) => sum + (item.totalReceivedQty || 0), 0).toLocaleString()} pcs
                    </td>
                    <td className="p-3 text-cyan-300 font-mono">
                      {filteredTableBreakdown.reduce((sum, item) => sum + (item.challanCount || 0), 0)} batches
                    </td>
                    <td className="p-3 text-emerald-300 font-extrabold" colSpan={2}>
                      {(sewingInputStats?.totalInputReceived || 0).toLocaleString()} pcs Total Confirmed
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transfers' && (
        <DepartmentTransferQueue
          department="Sewing"
          title="Sewing Section Handover & Gate Pass Dispatches (Wash / Direct Finishing)"
        />
      )}

      {activeTab === 'targets' && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
            <span className="font-bold text-blue-900">
              Set or Change Daily Target for any Line (Line 01 - Line 10) and Style/PO/Colour
            </span>
            <button
              onClick={handleOpenAddTarget}
              className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
            >
              + Set New Daily Target
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {targets.map(t => (
              <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2 relative group">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-sm text-blue-700">{t.lineNo}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded">{t.styleNo} ({t.poNo})</span>
                    <div className="flex items-center gap-1">
                      <PermissionGuard dept="Sewing" permission="EDIT">
                        <button
                          onClick={() => handleOpenEditTarget(t)}
                          className="p-1 text-slate-400 hover:text-blue-600"
                          title="Change Daily Target"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                      </PermissionGuard>
                      <PermissionGuard dept="Sewing" permission="DELETE">
                        <button
                          onClick={() => handleOpenDelete('target', t.id, `${t.lineNo} Target`)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Delete Target"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </PermissionGuard>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600">Colour: <strong className="text-slate-900">{t.colour}</strong></p>
                <div className="grid grid-cols-2 gap-2 pt-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Daily Target</p>
                    <p className="font-extrabold text-indigo-600 text-sm mt-0.5">{t.dailyTargetQty} pcs</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Monthly Target (26 Days)</p>
                    <p className="font-extrabold text-slate-800 text-sm mt-0.5">{(t.monthlyTargetQty || 0).toLocaleString()} pcs</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sewing Production Entry Modal Matching Cutting Format */}
      {isModalOpen && (
        <ProductionEntryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          moduleName="Sewing"
          title="NEW SEWING PRODUCTION LOG ENTRY"
          icon={Shirt}
          initialStyleNo={selectedProd?.styleNo || ''}
          initialPoNo={selectedProd?.poNo || ''}
          initialColour={selectedProd?.colour || ''}
          isLoading={isLoading}
          onSave={handleSaveSewingFromModal}
          customFields={
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                  Sewing Line <span className="text-rose-500">*</span>
                </label>
                <select
                  value={lineNo || 'Line No 1'}
                  onChange={e => setLineNo(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none cursor-pointer"
                >
                  {activeLines.map(l => (
                    <option key={l.id} value={l.lineNo}>
                      {l.lineName || l.lineNo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                  Daily Target (Pcs)
                </label>
                <input
                  type="number"
                  value={dailyTarget}
                  onChange={e => setDailyTarget(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 800"
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                  Alteration Qty
                </label>
                <input
                  type="number"
                  value={alterQty}
                  onChange={e => setAlterQty(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-amber-700 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                  Reject Qty
                </label>
                <input
                  type="number"
                  value={rejectQty}
                  onChange={e => setRejectQty(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-rose-700 focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none font-mono"
                />
              </div>
            </div>
          }
        />
      )}

      {/* Target Setting Modal */}
      <Modal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        title={selectedTarget ? `Change Line Daily Target (${selectedTarget.lineNo})` : "Configure Line Production Daily Target"}
        maxWidth="3xl"
      >
        <form onSubmit={handleSaveTarget} className="space-y-4">
          <OrderHierarchySelector
            selectedBuyer={buyer}
            selectedStyleNo={styleNo}
            selectedPoNo={poNo}
            selectedColour={colour}
            onSelect={handleOrderHierarchySelect}
            currentModule="Sewing"
            showSizeSelector={false}
            customTitle="Select Order Master for Line Target"
          />

          <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sewing Line *</label>
              <select
                value={lineNo || 'Line No 1'}
                onChange={e => setLineNo(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {activeLines.map(l => (
                  <option key={l.id} value={l.lineNo}>
                    {l.lineName || l.lineNo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Daily Target (Pcs) *</label>
              <input
                type="number"
                value={dailyTarget}
                onChange={e => setDailyTarget(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 850"
                className="w-full rounded border p-2 text-xs font-bold text-blue-600 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsTargetModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : (selectedTarget ? 'Update Target' : 'Save Line Target')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Confirm Deletion"
        message={`Are you sure you want to permanently delete "${itemToDelete?.title}" from the database?`}
        confirmLabel={isLoading ? 'Deleting...' : 'Delete Record'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
      />

      {/* Transfer & Gate Pass Challan Modal */}
      {isTransferModalOpen && (
        <TransferChallanModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setTransferTargetItem(null);
          }}
          defaultFromDept="Sewing"
          defaultToDept={transferDefaultToDept}
          initialStyleNo={transferTargetItem?.styleNo || ''}
          initialPoNo={transferTargetItem?.poNo || ''}
          initialColour={transferTargetItem?.colour || ''}
          initialSize={transferTargetItem?.size || 'All Sizes'}
          maxAvailableQty={transferTargetItem?.qty || 0}
          initialTransferType={transferModalType}
          onSuccess={() => {
            setProduction([...supabaseDataService.getSewingProduction()]);
            setTransfers([...supabaseDataService.getTransfers()]);
          }}
        />
      )}
    </div>
  );
};
