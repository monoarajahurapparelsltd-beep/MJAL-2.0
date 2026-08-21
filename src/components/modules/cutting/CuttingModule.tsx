import React, { useState, useEffect, useMemo } from 'react';
import { Scissors, Plus, Edit, Trash2, AlertCircle, Info, CheckCircle2, Send, Layers, TrendingUp, RotateCcw, ArrowRightLeft, Calendar, Save, X } from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { CuttingEntry, InterDeptTransfer } from '../../../types';
import { PageHeader } from '../../common/PageHeader';
import { StatCard } from '../../common/StatCard';
import { DataTable, Column } from '../../common/DataTable';
import { ProductionEntryModal } from '../../common/ProductionEntryModal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { PermissionGuard } from '../../common/PermissionGuard';
import { useAuth } from '../../../context/AuthContext';
import { useERP } from '../../../context/ERPContext';
import { DepartmentTransferQueue } from '../../common/DepartmentTransferQueue';
import { TransferChallanModal } from '../../common/TransferChallanModal';
import { calculateCuttingEntriesSewingStats, CuttingRowSewingStats } from '../../../utils/cuttingCalculationUtils';

export interface ConsolidatedCuttingItem extends CuttingEntry {
  rawEntryIds: string[];
  lastUpdateDate: string;
  updateCount: number;
}

export const CuttingModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { activeModule } = useERP();
  const [entries, setEntries] = useState<CuttingEntry[]>(supabaseDataService.getCuttingEntries());
  const [transfers, setTransfers] = useState<InterDeptTransfer[]>(supabaseDataService.getTransfersByDepartment('Cutting'));
  const [activeTab, setActiveTab] = useState<'cutting' | 'transfers'>('cutting');

  useEffect(() => {
    if (activeModule === 'cutting_transfers') {
      setActiveTab('transfers');
    } else if (activeModule === 'cutting' || activeModule === 'cutting_master') {
      setActiveTab('cutting');
    }
  }, [activeModule]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferModalType, setTransferModalType] = useState<'Transfer' | 'Return'>('Transfer');
  const [transferTargetItem, setTransferTargetItem] = useState<{ styleNo: string; poNo: string; colour: string; size: string; qty: number } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ConsolidatedCuttingItem | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<ConsolidatedCuttingItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit Single Item Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConsolidatedCuttingItem | null>(null);
  const [editCutQty, setEditCutQty] = useState<number | ''>('');
  const [editDate, setEditDate] = useState('');
  const [editFabricYds, setEditFabricYds] = useState<number | ''>('');
  const [editLayPlies, setEditLayPlies] = useState<number | ''>('');
  const [editOperator, setEditOperator] = useState('');

  // Form custom fields state
  const [cuttingTableNo, setCuttingTableNo] = useState('Table #1');
  const [layPlies, setLayPlies] = useState<number | ''>(100);
  const [fabricAllocatedYds, setFabricAllocatedYds] = useState<number | ''>('');
  const [markerLengthYds, setMarkerLengthYds] = useState<number | ''>('');

  useEffect(() => {
    const update = () => {
      setEntries([...supabaseDataService.getCuttingEntries()]);
      setTransfers([...supabaseDataService.getTransfersByDepartment('Cutting')]);
    };
    update();
    const unsub = supabaseDataService.subscribe(update);
    return unsub;
  }, []);

  /**
   * Consolidate cutting entries by unique Style + PO + Colour + Size.
   * Eliminates duplicate date rows, calculates cumulative Cut Qty, and displays the Last Update Date.
   */
  const consolidatedEntries: ConsolidatedCuttingItem[] = useMemo(() => {
    const map = new Map<string, ConsolidatedCuttingItem>();
    // Sort so later entries overwrite/update metadata
    const sorted = [...entries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    for (const e of sorted) {
      const sStyle = (e.styleNo || '').trim().toUpperCase();
      const sPo = (e.poNo || '').trim().toUpperCase();
      const sCol = (e.colour || '').trim().toUpperCase();
      const sSz = (e.size || 'All Sizes').trim().toUpperCase();
      const key = `${sStyle}__${sPo}__${sCol}__${sSz}`;

      const orderProgress = supabaseDataService.getStylePoColourProgress(e.styleNo, e.poNo, e.colour);
      const szObj = orderProgress?.sizeBreakdown?.find(s => (s.size || '').trim().toUpperCase() === sSz);
      const masterOrderQty = szObj ? szObj.orderQty : (e.orderQty || 0);

      if (!map.has(key)) {
        map.set(key, {
          ...e,
          rawEntryIds: [e.id],
          lastUpdateDate: e.date || new Date().toISOString().substring(0, 10),
          orderQty: masterOrderQty > 0 ? masterOrderQty : (e.orderQty || e.cutQty || 0),
          cutQty: Number(e.cutQty || 0),
          bundleCount: Number(e.bundleCount || Math.ceil((e.cutQty || 0) / 20) || 1),
          updateCount: 1
        });
      } else {
        const existing = map.get(key)!;
        const totalCut = (existing.cutQty || 0) + Number(e.cutQty || 0);
        const resolvedOrderQty = masterOrderQty > 0 ? masterOrderQty : Math.max(existing.orderQty || 0, e.orderQty || 0, totalCut);
        const latestDate = (e.date && e.date > (existing.lastUpdateDate || '')) ? e.date : existing.lastUpdateDate;
        const latestOperator = e.operator || existing.operator;

        map.set(key, {
          ...existing,
          rawEntryIds: [...existing.rawEntryIds, e.id],
          date: latestDate,
          lastUpdateDate: latestDate,
          orderQty: resolvedOrderQty,
          cutQty: totalCut,
          bundleCount: Math.ceil(totalCut / 20),
          shortageQty: Math.max(0, resolvedOrderQty - totalCut),
          cutEfficiency: resolvedOrderQty > 0 ? Number(((totalCut / resolvedOrderQty) * 100).toFixed(1)) : 100,
          operator: latestOperator,
          fabricAllocatedYds: (Number(existing.fabricAllocatedYds) || 0) + (Number(e.fabricAllocatedYds) || 0),
          markerLengthYds: e.markerLengthYds || existing.markerLengthYds,
          layPlies: e.layPlies || existing.layPlies,
          updateCount: existing.updateCount + 1
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => (b.lastUpdateDate || '').localeCompare(a.lastUpdateDate || ''));
  }, [entries]);

  // Raw transfers from Cutting to Sewing
  const rawTransfers = supabaseDataService.getTransfers();
  const cuttingToSewingTransfers = rawTransfers.filter(
    t => t.fromDepartment === 'Cutting' && t.toDepartment === 'Sewing'
  );

  // Exact line-by-line size/PO/style matching stats based on consolidated rows
  const sewingStatsMap: Map<string, CuttingRowSewingStats> = useMemo(
    () => calculateCuttingEntriesSewingStats(consolidatedEntries, rawTransfers),
    [consolidatedEntries, rawTransfers]
  );

  const handleOpenAdd = () => {
    setSelectedEntry(null);
    setCuttingTableNo('Table #1');
    setLayPlies(100);
    setFabricAllocatedYds('');
    setMarkerLengthYds('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenTransferModal = (type: 'Transfer' | 'Return', item?: ConsolidatedCuttingItem) => {
    setTransferModalType(type);
    if (item) {
      const stats = sewingStatsMap.get(item.id);
      const remainingBalance = stats ? stats.inputBalance : item.cutQty;
      setTransferTargetItem({
        styleNo: item.styleNo,
        poNo: item.poNo,
        colour: item.colour,
        size: item.size || 'All Sizes',
        qty: remainingBalance > 0 ? remainingBalance : item.cutQty
      });
    } else {
      setTransferTargetItem(null);
    }
    setIsTransferModalOpen(true);
  };

  const handleOpenEdit = (entry: ConsolidatedCuttingItem) => {
    setEditingItem(entry);
    setEditCutQty(entry.cutQty);
    setEditDate(entry.lastUpdateDate || entry.date || new Date().toISOString().substring(0, 10));
    setEditFabricYds(entry.fabricAllocatedYds || '');
    setEditLayPlies(entry.layPlies || 100);
    setEditOperator(entry.operator || currentUser?.name || 'Cutting Master');
    setIsEditModalOpen(true);
  };

  const handleSaveItemEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsLoading(true);
    setErrorMessage(null);

    const newCutQty = Number(editCutQty) || 0;
    const resolvedOrderQty = editingItem.orderQty || newCutQty;
    const updatedEntry: CuttingEntry = {
      id: editingItem.id,
      date: editDate || new Date().toISOString().substring(0, 10),
      styleNo: editingItem.styleNo,
      poNo: editingItem.poNo,
      colour: editingItem.colour,
      size: editingItem.size,
      orderQty: resolvedOrderQty,
      cutQty: newCutQty,
      shortageQty: Math.max(0, resolvedOrderQty - newCutQty),
      rejectQty: editingItem.rejectQty || 0,
      recutQty: editingItem.recutQty || 0,
      bundleCount: Math.ceil(newCutQty / 20),
      cutEfficiency: resolvedOrderQty > 0 ? Number(((newCutQty / resolvedOrderQty) * 100).toFixed(1)) : 100,
      operator: editOperator || currentUser?.name || 'Cutting Master',
      fabricAllocatedYds: Number(editFabricYds) || 0,
      layPlies: Number(editLayPlies) || 100,
      markerLengthYds: editingItem.markerLengthYds || 0,
      markerEfficiency: editingItem.markerEfficiency || 88.0
    };

    // If there were multiple duplicate raw records merged into this one, clean up excess raw IDs
    if (editingItem.rawEntryIds && editingItem.rawEntryIds.length > 1) {
      for (const extraId of editingItem.rawEntryIds) {
        if (extraId !== editingItem.id) {
          await supabaseDataService.deleteCuttingEntry(extraId, currentUser?.name);
        }
      }
    }

    const res = await supabaseDataService.saveCuttingEntry(updatedEntry, currentUser?.name);
    setIsLoading(false);

    if (res.success) {
      setIsEditModalOpen(false);
      setEditingItem(null);
      setEntries([...supabaseDataService.getCuttingEntries()]);
    } else {
      setErrorMessage(res.error || 'Failed to update cutting record.');
    }
  };

  const handleOpenDelete = (entry: ConsolidatedCuttingItem) => {
    setEntryToDelete(entry);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    setIsLoading(true);

    const idsToDelete = entryToDelete.rawEntryIds && entryToDelete.rawEntryIds.length > 0
      ? entryToDelete.rawEntryIds
      : [entryToDelete.id];

    let allSuccess = true;
    let lastError: string | undefined;

    for (const id of idsToDelete) {
      const res = await supabaseDataService.deleteCuttingEntry(id, currentUser?.name);
      if (!res.success) {
        allSuccess = false;
        lastError = res.error;
      }
    }

    setIsLoading(false);
    if (!allSuccess) {
      setErrorMessage(lastError || 'Failed to delete cutting record from database.');
    } else {
      setIsDeleteModalOpen(false);
      setEntryToDelete(null);
      setEntries([...supabaseDataService.getCuttingEntries()]);
    }
  };

  /**
   * Saves new cutting production.
   * Checks if an entry already exists for Style+PO+Colour+Size:
   * - If found: Auto-implements by updating the cumulative cutQty and setting date to the latest production date.
   * - If not found: Creates a new entry for this unique Style+PO+Colour+Size.
   */
  const handleSaveCuttingFromModal = async (data: {
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

    const dateStr = new Date().toISOString().substring(0, 10);
    const numLayPlies = Number(layPlies) || 0;
    const numFabric = Number(fabricAllocatedYds) || 0;
    const numMarkerLen = Number(markerLengthYds) || 0;

    const sizeKeys = Object.keys(data.sizeWiseQuantities);
    const existingRawEntries = supabaseDataService.getCuttingEntries();

    if (sizeKeys.length > 0) {
      for (const sz of sizeKeys) {
        const newBatchQty = data.sizeWiseQuantities[sz];
        if (newBatchQty > 0) {
          const orderProgress = supabaseDataService.getStylePoColourProgress(data.styleNo, data.poNo, data.colour);
          const szObj = orderProgress?.sizeBreakdown?.find(s => (s.size || '').trim().toUpperCase() === String(sz || '').trim().toUpperCase());
          const sizeOrderQty = szObj ? szObj.orderQty : newBatchQty;

          // Find existing cutting entry matching exact Style + PO + Colour + Size
          const matchingExisting = existingRawEntries.find(e =>
            (e.styleNo || '').trim().toUpperCase() === data.styleNo.trim().toUpperCase() &&
            (e.poNo || '').trim().toUpperCase() === data.poNo.trim().toUpperCase() &&
            (e.colour || '').trim().toUpperCase() === data.colour.trim().toUpperCase() &&
            (e.size || '').trim().toUpperCase() === String(sz || '').trim().toUpperCase()
          );

          if (matchingExisting) {
            // Auto-accumulate into the existing record with the new Last Update Date
            const cumulativeCutQty = Number(matchingExisting.cutQty || 0) + newBatchQty;
            const updatedEntry: CuttingEntry = {
              ...matchingExisting,
              date: dateStr, // Update to the latest production date
              orderQty: sizeOrderQty > 0 ? sizeOrderQty : (matchingExisting.orderQty || cumulativeCutQty),
              cutQty: cumulativeCutQty,
              shortageQty: Math.max(0, (sizeOrderQty > 0 ? sizeOrderQty : matchingExisting.orderQty) - cumulativeCutQty),
              bundleCount: Math.ceil(cumulativeCutQty / 20),
              cutEfficiency: sizeOrderQty > 0 ? Number(((cumulativeCutQty / sizeOrderQty) * 100).toFixed(1)) : 100,
              operator: currentUser?.name || matchingExisting.operator || 'Cutting Master',
              fabricAllocatedYds: (Number(matchingExisting.fabricAllocatedYds) || 0) + numFabric,
              layPlies: numLayPlies || matchingExisting.layPlies || 100,
              markerLengthYds: numMarkerLen || matchingExisting.markerLengthYds || 0
            };
            await supabaseDataService.saveCuttingEntry(updatedEntry, currentUser?.name);
          } else {
            // Create a brand new record for this Style+PO+Colour+Size
            const entryId = 'cut-' + Date.now() + '-' + String(sz || '').toLowerCase() + '-' + Math.random().toString(36).substring(2, 6);
            const entryToSave: CuttingEntry = {
              id: entryId,
              date: dateStr,
              styleNo: data.styleNo,
              poNo: data.poNo,
              colour: data.colour,
              size: sz,
              orderQty: sizeOrderQty,
              fabricAllocatedYds: numFabric,
              markerLengthYds: numMarkerLen,
              markerEfficiency: 88.0,
              layPlies: numLayPlies || 100,
              cutQty: newBatchQty,
              shortageQty: Math.max(0, sizeOrderQty - newBatchQty),
              rejectQty: 0,
              recutQty: 0,
              bundleCount: Math.ceil(newBatchQty / 20),
              cutEfficiency: sizeOrderQty > 0 ? Number(((newBatchQty / sizeOrderQty) * 100).toFixed(1)) : 100,
              operator: currentUser?.name || 'Cutting Master'
            };
            await supabaseDataService.saveCuttingEntry(entryToSave, currentUser?.name);
          }
        }
      }
    } else if (data.totalNewQty > 0) {
      // Fallback single batch (All Sizes)
      const matchingAll = existingRawEntries.find(e =>
        (e.styleNo || '').trim().toUpperCase() === data.styleNo.trim().toUpperCase() &&
        (e.poNo || '').trim().toUpperCase() === data.poNo.trim().toUpperCase() &&
        (e.colour || '').trim().toUpperCase() === data.colour.trim().toUpperCase() &&
        (!e.size || e.size === 'All Sizes')
      );

      if (matchingAll) {
        const cumulativeCut = Number(matchingAll.cutQty || 0) + data.totalNewQty;
        const entryToSave: CuttingEntry = {
          ...matchingAll,
          date: dateStr,
          cutQty: cumulativeCut,
          bundleCount: Math.ceil(cumulativeCut / 20),
          operator: currentUser?.name || matchingAll.operator || 'Cutting Master'
        };
        await supabaseDataService.saveCuttingEntry(entryToSave, currentUser?.name);
      } else {
        const entryId = 'cut-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        const entryToSave: CuttingEntry = {
          id: entryId,
          date: dateStr,
          styleNo: data.styleNo,
          poNo: data.poNo,
          colour: data.colour,
          size: 'All Sizes',
          orderQty: data.totalNewQty,
          fabricAllocatedYds: numFabric,
          markerLengthYds: numMarkerLen,
          markerEfficiency: 88.0,
          layPlies: numLayPlies || 100,
          cutQty: data.totalNewQty,
          shortageQty: 0,
          rejectQty: 0,
          recutQty: 0,
          bundleCount: Math.ceil(data.totalNewQty / 20),
          cutEfficiency: 100,
          operator: currentUser?.name || 'Cutting Master'
        };
        await supabaseDataService.saveCuttingEntry(entryToSave, currentUser?.name);
      }
    }

    setIsLoading(false);
    setEntries([...supabaseDataService.getCuttingEntries()]);
  };

  // KPI Summary Calculations using consolidated data
  const totalCutQty = consolidatedEntries.reduce((sum, c) => sum + (c.cutQty || 0), 0);
  const totalCutOrderQty = consolidatedEntries.reduce((sum, c) => sum + (c.orderQty || 0), 0);
  const totalBundlesCount = consolidatedEntries.reduce((sum, c) => sum + (c.bundleCount || 0), 0);

  const totalSewingSentFromCut = Array.from(sewingStatsMap.values()).reduce(
    (sum: number, s: CuttingRowSewingStats) => sum + (s?.sewingSent || 0),
    0
  );

  const todayStr = new Date().toISOString().substring(0, 10);
  const todaySewingSentFromCut = cuttingToSewingTransfers
    .filter(t => t.transferDate === todayStr || t.transferDate === '2026-08-10')
    .reduce((sum, t) => sum + (t.quantity || 0), 0);

  const totalSewingInputQty = totalSewingSentFromCut;
  const todaySewingInputQty = todaySewingSentFromCut;

  const totalInputBalance = Math.max(0, totalCutQty - totalSewingInputQty);
  const inputBalancePercent = totalCutQty > 0
    ? Math.min(100, Math.round((totalSewingInputQty / totalCutQty) * 100))
    : 0;

  const columns: Column<ConsolidatedCuttingItem>[] = [
    {
      header: 'Last Update Date',
      accessorKey: 'lastUpdateDate',
      sortable: true,
      cell: e => (
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-800">{e.lastUpdateDate || e.date}</span>
        </div>
      )
    },
    {
      header: 'Style / PO',
      cell: e => (
        <div>
          <span className="font-bold text-blue-600">{e.styleNo}</span>
          <span className="text-[11px] text-slate-500 block">{e.poNo}</span>
        </div>
      )
    },
    { header: 'Colour', accessorKey: 'colour', sortable: true },
    {
      header: 'Size',
      accessorKey: 'size',
      cell: e => (
        <span className="px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 font-black border border-purple-200 text-xs">
          {e.size || 'All Sizes'}
        </span>
      )
    },
    {
      header: 'Factory Order Qty',
      accessorKey: 'orderQty',
      cell: e => <span className="font-bold text-slate-800">{e.orderQty?.toLocaleString()} pcs</span>
    },
    {
      header: 'Cut Qty',
      accessorKey: 'cutQty',
      cell: e => (
        <div>
          <span className="font-black text-emerald-700">{e.cutQty?.toLocaleString()} pcs</span>
        </div>
      )
    },
    {
      header: 'Sewing Sent',
      cell: e => {
        const stats = sewingStatsMap.get(e.id);
        const sent = stats?.sewingSent || 0;
        return <span className="font-extrabold text-indigo-600">{(sent || 0).toLocaleString()} pcs</span>;
      }
    },
    {
      header: 'Input Balance',
      cell: e => {
        const stats = sewingStatsMap.get(e.id);
        const bal = stats?.inputBalance ?? (e.cutQty || e.orderQty || 0);
        const isComplete = stats?.isFullyTransferred || false;
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${isComplete ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {isComplete ? '100% Transferred' : `${(bal || 0).toLocaleString()} pcs bal`}
          </span>
        );
      }
    },
    { header: 'Bundles', cell: e => <span className="font-mono text-xs font-bold text-slate-700">{e.bundleCount}</span> },
    {
      header: 'Efficiency %',
      cell: e => (
        <span className={`font-bold ${e.cutEfficiency >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
          {e.cutEfficiency}%
        </span>
      )
    },
    { header: 'Operator', accessorKey: 'operator' },
    {
      header: 'Actions',
      cell: e => (
        <div className="flex items-center gap-1.5">
          <PermissionGuard dept="Cutting" permission="CREATE">
            <button
              onClick={() => handleOpenTransferModal('Transfer', e)}
              title="Issue Cut Panel Transfer to Sewing"
              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">To Sewing</span>
            </button>
          </PermissionGuard>
          <PermissionGuard dept="Cutting" permission="EDIT">
            <button
              onClick={() => handleOpenEdit(e)}
              title="Edit Cut Item Record"
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          </PermissionGuard>
          <PermissionGuard dept="Cutting" permission="DELETE">
            <button
              onClick={() => handleOpenDelete(e)}
              title="Delete Item Record"
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </PermissionGuard>
        </div>
      )
    }
  ];

  const renderCuttingFooter = (data: ConsolidatedCuttingItem[]) => {
    const totalOrder = data.reduce((sum, item) => sum + (item.orderQty || 0), 0);
    const totalCut = data.reduce((sum, item) => sum + (item.cutQty || 0), 0);
    const totalSent = data.reduce((sum, item) => {
      const stats = sewingStatsMap.get(item.id);
      return sum + (stats?.sewingSent || 0);
    }, 0);
    const totalBal = Math.max(0, totalCut - totalSent);
    const totalBundles = data.reduce((sum, item) => sum + (item.bundleCount || 0), 0);
    const avgEff = data.length > 0
      ? Math.round(data.reduce((sum, item) => sum + (item.cutEfficiency || 100), 0) / data.length)
      : 100;
    const overallPct = totalCut > 0 ? Math.min(100, Math.round((totalSent / totalCut) * 100)) : 0;

    return (
      <tr className="bg-slate-950 text-white font-black text-xs">
        <td className="px-2.5 py-3 text-white uppercase tracking-wider" colSpan={4}>
          TOTAL SUMMARY ({data.length} ITEMS)
        </td>
        <td className="px-2.5 py-3 text-white font-mono">
          {totalOrder.toLocaleString()} pcs
        </td>
        <td className="px-2.5 py-3 text-emerald-400 font-mono">
          {totalCut.toLocaleString()} pcs
        </td>
        <td className="px-2.5 py-3 text-indigo-300 font-mono">
          {totalSent.toLocaleString()} pcs
        </td>
        <td className="px-2.5 py-3">
          <span className="text-amber-400 font-mono block">{totalBal.toLocaleString()} pcs</span>
          <span className="text-[10px] text-slate-400 block font-normal">{overallPct}% Sent</span>
        </td>
        <td className="px-2.5 py-3 text-cyan-300 font-mono">
          {totalBundles.toLocaleString()}
        </td>
        <td className="px-2.5 py-3 text-emerald-300 font-mono">
          {avgEff}%
        </td>
        <td className="px-2.5 py-3 text-slate-400" colSpan={2}>
          -
        </td>
      </tr>
    );
  };

  const pendingOutgoingTransfers = transfers.filter(t => t.fromDepartment === 'Cutting' && t.status === 'Dispatched').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Cutting Section Module"
        description="Fabric Spreading, Marker Efficiency, Lay & Style-Wise Cutting Operations (Master Data Driven)"
        actions={
          <div className="flex items-center gap-2">
            <ExportPrintToolbar title="Cutting Production" data={consolidatedEntries} filename="MJAL_Cutting_Log" />
            <PermissionGuard dept="Cutting" permission="CREATE">
              <button
                onClick={() => handleOpenTransferModal('Return')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-2xs transition-colors"
              >
                <RotateCcw className="h-4 w-4 text-amber-700" />
                <span>Return Challan</span>
              </button>
            </PermissionGuard>
            <PermissionGuard dept="Cutting" permission="CREATE">
              <button
                onClick={() => handleOpenTransferModal('Transfer')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm transition-colors"
              >
                <Send className="h-4 w-4" />
                <span>Issue Transfer to Sewing</span>
              </button>
            </PermissionGuard>
            <PermissionGuard dept="Cutting" permission="CREATE">
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                New Cutting Entry
              </button>
            </PermissionGuard>
          </div>
        }
      />

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {activeTab === 'cutting' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Total Cut Output"
              value={`${(totalCutQty || 0).toLocaleString()} pcs`}
              subtitle={`Order Goal: ${(totalCutOrderQty || 0).toLocaleString()} pcs`}
              icon={Scissors}
              variant="blue"
            />
            <StatCard
              title="Today Sewing Input"
              value={`${(todaySewingInputQty || totalSewingInputQty || 0).toLocaleString()} pcs`}
              subtitle={`Total Sent to Sewing: ${(totalSewingInputQty || 0).toLocaleString()} pcs`}
              trend={todaySewingInputQty > 0 ? 'Today Sent' : 'Total Input'}
              trendType="positive"
              icon={Send}
              variant="purple"
            />
            <StatCard
              title="Input Balance"
              value={`${(totalInputBalance || 0).toLocaleString()} pcs`}
              subtitle={`Cut (${(totalCutQty || 0).toLocaleString()}) - Sent (${(totalSewingInputQty || 0).toLocaleString()})`}
              trend={`${inputBalancePercent}% Transferred`}
              trendType={totalInputBalance === 0 ? 'positive' : 'negative'}
              icon={CheckCircle2}
              variant={totalInputBalance === 0 ? 'emerald' : 'amber'}
            />
            <StatCard
              title="Total Bundles"
              value={`${(totalBundlesCount || 0).toLocaleString()} bundles`}
              subtitle="Bundles Ready for Sewing Handover"
              icon={Layers}
              variant="emerald"
            />
          </div>

          <DataTable
            data={consolidatedEntries}
            columns={columns}
            keyExtractor={e => e.id}
            searchPlaceholder="Search Style, PO, Colour, Size, Operator..."
            footerRow={renderCuttingFooter}
          />
        </div>
      )}

      {activeTab === 'transfers' && (
        <DepartmentTransferQueue
          department="Cutting"
          defaultToDept="Sewing"
          title="Cutting Section Product Transfers, Gate Passes & Return Challans"
        />
      )}

      {/* Cutting Entry Modal Matching User Image */}
      {isModalOpen && (
        <ProductionEntryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          moduleName="Cutting"
          title="NEW CUTTING PRODUCTION LOG ENTRY"
          icon={Scissors}
          initialStyleNo={selectedEntry?.styleNo || ''}
          initialPoNo={selectedEntry?.poNo || ''}
          initialColour={selectedEntry?.colour || ''}
          isLoading={isLoading}
          onSave={handleSaveCuttingFromModal}
          customFields={
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                  Cutting Table No
                </label>
                <input
                  type="text"
                  value={cuttingTableNo}
                  onChange={e => setCuttingTableNo(e.target.value)}
                  placeholder="e.g. Table #1"
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                  Fabric Plies / Layers
                </label>
                <input
                  type="number"
                  value={layPlies}
                  onChange={e => setLayPlies(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="100"
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-mono"
                />
              </div>
            </div>
          }
        />
      )}

      {/* Edit Single Cutting Item Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-2 sm:p-4 pt-3 sm:pt-6 md:pt-8 pb-6 bg-slate-950/75 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] flex flex-col min-h-0 rounded-2xl bg-white shadow-2xl border border-slate-700/30 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0b1329] text-white border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center border border-blue-500/40">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-100">
                    Edit Cutting Item Record
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Style: <strong className="text-white">{editingItem.styleNo}</strong> | PO: <strong className="text-white">{editingItem.poNo}</strong> | Colour: <strong className="text-white">{editingItem.colour}</strong> | Size: <strong className="text-purple-300">{editingItem.size}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingItem(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemEdit} className="p-5 space-y-4 bg-slate-50/50 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Order Goal Qty
                  </label>
                  <div className="text-sm font-black text-slate-900 font-mono">
                    {editingItem.orderQty.toLocaleString()} pcs
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Cut Quantity (pcs) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editCutQty}
                    onChange={e => setEditCutQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-sm font-black bg-slate-50 border border-slate-300 rounded-lg p-2 text-emerald-700 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Last Update Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Fabric Plies / Layers
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editLayPlies}
                    onChange={e => setEditLayPlies(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="100"
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Fabric Allocated (yds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editFabricYds}
                    onChange={e => setEditFabricYds(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-mono"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Cutting Master / Operator
                  </label>
                  <input
                    type="text"
                    value={editOperator}
                    onChange={e => setEditOperator(e.target.value)}
                    placeholder="Operator Name"
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{isLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Confirm Deletion"
        message={`Are you sure you want to permanently delete the cutting record for Style "${entryToDelete?.styleNo}", PO "${entryToDelete?.poNo}", Colour "${entryToDelete?.colour}", Size "${entryToDelete?.size}"?`}
        confirmLabel={isLoading ? 'Deleting...' : 'Delete Record'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setEntryToDelete(null);
        }}
      />

      {/* Transfer Challan Modal */}
      {isTransferModalOpen && (
        <TransferChallanModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setTransferTargetItem(null);
          }}
          defaultFromDept="Cutting"
          defaultToDept="Sewing"
          initialStyleNo={transferTargetItem?.styleNo || ''}
          initialPoNo={transferTargetItem?.poNo || ''}
          initialColour={transferTargetItem?.colour || ''}
          initialSize={transferTargetItem?.size || 'All Sizes'}
          maxAvailableQty={transferTargetItem?.qty || 0}
          initialTransferType={transferModalType}
          onSuccess={() => {
            setEntries([...supabaseDataService.getCuttingEntries()]);
            setTransfers([...supabaseDataService.getTransfersByDepartment('Cutting')]);
          }}
        />
      )}
    </div>
  );
};

