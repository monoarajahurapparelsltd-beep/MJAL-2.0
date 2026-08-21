import React, { useState, useEffect, useMemo } from 'react';
import { Plus, CheckCircle2, AlertCircle, X, Scissors, Flame, ShieldCheck, Tag, Box, Archive, PackageCheck, Layers, Sparkles, Search } from 'lucide-react';
import { ModalPortal } from '../../common/ModalPortal';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { FinishingRecord, ProductionOrder } from '../../../types';
import { useAuth } from '../../../context/AuthContext';

export type FinishingProcessType = 
  | 'Thread Cutting'
  | 'Iron'
  | 'Get Up'
  | 'Hang Tag'
  | 'Poly'
  | 'Carton'
  | 'Ready for Shipment'
  | 'All Processes';

interface FinishingProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    styleNo?: string;
    poNo?: string;
    colour?: string;
    size?: string;
    process?: FinishingProcessType;
  } | null;
  onSaved?: () => void;
}

export const FinishingProductionModal: React.FC<FinishingProductionModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSaved
}) => {
  const { currentUser } = useAuth();

  // Search state (matching Cutting & Sewing)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Selection states
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedPo, setSelectedPo] = useState('');
  const [selectedColour, setSelectedColour] = useState('');
  const [selectedProcess, setSelectedProcess] = useState<FinishingProcessType>('Thread Cutting');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10));
  const [operator, setOperator] = useState(currentUser?.name || 'Finishing Supervisor');
  const [remarks, setRemarks] = useState('');

  // Size-wise quantities input map: size -> quantity
  const [sizeInputs, setSizeInputs] = useState<Record<string, number | ''>>({});

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available Order Styles from data store
  const [orders, setOrders] = useState<ProductionOrder[]>(() => supabaseDataService.getOrders());

  useEffect(() => {
    const update = () => setOrders(supabaseDataService.getOrders());
    update();
    const unsub = supabaseDataService.subscribe(update);
    return unsub;
  }, []);

  // Master combinations for fast typeahead search
  const allCombinations = useMemo(() => {
    return supabaseDataService.getAllOrderCombinations();
  }, [orders]);

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const query = searchQuery.toLowerCase().trim();
    return allCombinations.filter(c => c.searchText.includes(query)).slice(0, 8);
  }, [allCombinations, searchQuery]);

  // Handle Search Selection
  const handleSelectSearchResult = (res: any) => {
    setSelectedBuyer(res.buyer || '');
    setSelectedStyle(res.styleNo);
    setSelectedPo(res.poNo);
    setSelectedColour(res.colour);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  // Available buyers
  const buyers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.buyer) set.add(o.buyer);
    });
    return Array.from(set);
  }, [orders]);

  // Styles filtered by buyer
  const styles = useMemo(() => {
    if (!selectedBuyer) return orders.map(o => o.styleNo);
    return orders.filter(o => o.buyer === selectedBuyer).map(o => o.styleNo);
  }, [orders, selectedBuyer]);

  // POs for selected style
  const purchaseOrders = useMemo(() => {
    if (!selectedStyle) return [];
    return supabaseDataService.getPurchaseOrders(selectedStyle);
  }, [selectedStyle]);

  // Colours for selected style & PO
  const colours = useMemo(() => {
    if (!selectedStyle || !selectedPo) return [];
    return supabaseDataService.getColours(selectedStyle, selectedPo);
  }, [selectedStyle, selectedPo]);

  // Init when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (initialData?.styleNo) {
        setSelectedStyle(initialData.styleNo);
        const currentOrders = supabaseDataService.getOrders();
        const order = currentOrders.find(o => o.styleNo === initialData.styleNo);
        if (order?.buyer) setSelectedBuyer(order.buyer);

        const pos = supabaseDataService.getPurchaseOrders(initialData.styleNo);
        const targetPo = initialData.poNo || (pos.length > 0 ? pos[0].poNo : '');
        setSelectedPo(targetPo);

        if (initialData.colour) {
          setSelectedColour(initialData.colour);
        } else if (initialData.styleNo && targetPo) {
          const cols = supabaseDataService.getColours(initialData.styleNo, targetPo);
          if (cols.length > 0) setSelectedColour(cols[0].colour);
        }

        if (initialData.process) {
          setSelectedProcess(initialData.process);
        }
      } else if (!selectedStyle) {
        // Defaults to first available style if none selected
        const currentOrders = supabaseDataService.getOrders();
        if (currentOrders.length > 0) {
          const first = currentOrders[0];
          setSelectedBuyer(first.buyer || '');
          setSelectedStyle(first.styleNo);
          if (first.purchaseOrders && first.purchaseOrders.length > 0) {
            const firstPo = first.purchaseOrders[0];
            setSelectedPo(firstPo.poNo);
            if (firstPo.colours && firstPo.colours.length > 0) {
              setSelectedColour(firstPo.colours[0].colour);
            }
          }
        }
      }
    }
  }, [isOpen, initialData]);

  // Master Order & Progress Details for live Size breakdown
  const orderDetails = useMemo(() => {
    if (!selectedStyle || !selectedPo || !selectedColour) return null;
    return supabaseDataService.getMasterOrderDetails(selectedStyle, selectedPo, selectedColour);
  }, [selectedStyle, selectedPo, selectedColour]);

  // Existing Finishing Records for this style/po/colour
  const existingFinishingRecords = useMemo(() => {
    if (!selectedStyle || !selectedPo || !selectedColour) return [];
    return supabaseDataService.getFinishingRecords().filter(
      f => f.styleNo?.trim().toUpperCase() === selectedStyle.trim().toUpperCase() &&
           (!f.poNo || !selectedPo || f.poNo.trim().toUpperCase() === selectedPo.trim().toUpperCase()) &&
           (!f.colour || !selectedColour || f.colour.trim().toUpperCase() === selectedColour.trim().toUpperCase())
    );
  }, [selectedStyle, selectedPo, selectedColour]);

  // Compute live breakdown per size for this Style + PO + Colour
  const sizeBreakdown = useMemo(() => {
    if (!orderDetails) return [];

    const sizes = (orderDetails.sizeBreakdown || []).filter(s => (s.orderQty || 0) > 0);
    const totalFinishingRecvOverall = sizes.reduce((sum, s) => sum + (s.finishingReceivedQty || 0), 0);

    return sizes.map(szItem => {
      const szName = szItem.size;
      const orderQty = szItem.orderQty || 0;
      
      // Calculate baseline receive for this size
      // STRICT RULE: If transfers into Finishing exist, finRecv is strictly the size's received quantity in Finishing.
      // If no transfers exist yet across this style/po/colour, fallback to orderQty as direct baseline.
      const finRecv = totalFinishingRecvOverall > 0
        ? (szItem.finishingReceivedQty || 0)
        : orderQty;

      // Find matching size records in finishing
      const sizeRecords = existingFinishingRecords.filter(
        f => f.size?.trim().toUpperCase() === szName.trim().toUpperCase() || (f.size === 'All Sizes' && sizes.length === 1)
      );

      // Max values across matching records to prevent duplicate summing
      const threadCutQty = sizeRecords.reduce((max, r) => Math.max(max, (r.threadCutQty ?? r.sewingReceiveQty ?? 0)), 0);
      const ironedQty = sizeRecords.reduce((max, r) => Math.max(max, (r.ironedQty || 0)), 0);
      const getUpQty = sizeRecords.reduce((max, r) => Math.max(max, (r.getUpQty || 0)), 0);
      const taggedQty = sizeRecords.reduce((max, r) => Math.max(max, (r.taggedQty || r.finishedQty || 0)), 0);
      const packedQty = sizeRecords.reduce((max, r) => Math.max(max, (r.packedQty || r.polyQty || r.finishedQty || 0)), 0);
      const cartonQty = sizeRecords.reduce((max, r) => Math.max(max, (r.cartonQty || 0)), 0);
      const readyShipQty = sizeRecords.reduce((max, r) => Math.max(max, (r.readyForShipmentQty || (r.isReadyForShipment ? (r.packedQty || 0) : 0))), 0);

      // Determine available quantity based on selected process
      // The capacity for any process is STRICTLY limited by finRecv (Finishing Received Qty).
      let alreadyDone = 0;
      let prevDone = finRecv;

      if (selectedProcess === 'Thread Cutting') {
        alreadyDone = threadCutQty;
        prevDone = finRecv;
      } else if (selectedProcess === 'Iron') {
        alreadyDone = ironedQty;
        prevDone = threadCutQty > 0 ? threadCutQty : finRecv;
      } else if (selectedProcess === 'Get Up') {
        alreadyDone = getUpQty;
        prevDone = ironedQty > 0 ? ironedQty : (threadCutQty > 0 ? threadCutQty : finRecv);
      } else if (selectedProcess === 'Hang Tag') {
        alreadyDone = taggedQty;
        prevDone = getUpQty > 0 ? getUpQty : (ironedQty > 0 ? ironedQty : (threadCutQty > 0 ? threadCutQty : finRecv));
      } else if (selectedProcess === 'Poly') {
        alreadyDone = packedQty;
        prevDone = taggedQty > 0 ? taggedQty : (getUpQty > 0 ? getUpQty : (ironedQty > 0 ? ironedQty : finRecv));
      } else if (selectedProcess === 'Carton') {
        alreadyDone = cartonQty;
        prevDone = packedQty > 0 ? packedQty : (taggedQty > 0 ? taggedQty : (getUpQty > 0 ? getUpQty : finRecv));
      } else if (selectedProcess === 'Ready for Shipment') {
        alreadyDone = readyShipQty;
        prevDone = cartonQty > 0 ? cartonQty : (packedQty > 0 ? packedQty : finRecv);
      } else if (selectedProcess === 'All Processes') {
        alreadyDone = readyShipQty;
        prevDone = finRecv;
      }

      // Maximum available that can be entered right now for this process (strictly capped by Finishing Receive Qty)
      const availableCap = finRecv > 0 ? finRecv : orderQty;
      const maxAvailable = Math.max(0, availableCap - alreadyDone);

      return {
        size: szName,
        orderQty,
        finRecv,
        threadCutQty,
        ironedQty,
        getUpQty,
        taggedQty,
        packedQty,
        cartonQty,
        readyShipQty,
        alreadyDone,
        prevDone: Math.min(prevDone, availableCap),
        maxAvailable
      };
    });
  }, [orderDetails, existingFinishingRecords, selectedProcess]);

  // Initialize inputs only when Style/PO/Colour/Process or Modal changes
  useEffect(() => {
    if (!isOpen) return;
    const initialInputs: Record<string, number | ''> = {};
    if (orderDetails?.sizeBreakdown) {
      orderDetails.sizeBreakdown.forEach(item => {
        initialInputs[item.size] = '';
      });
    }
    setSizeInputs(initialInputs);
  }, [selectedStyle, selectedPo, selectedColour, selectedProcess, isOpen]);

  // Total input sum across all sizes
  const totalEnteredQty = useMemo(() => {
    return Object.values(sizeInputs).reduce((sum: number, val) => sum + (Number(val) || 0), 0);
  }, [sizeInputs]);

  // Quick action: Fill full available balance
  const handleFillAllAvailable = () => {
    const updated: Record<string, number | ''> = {};
    sizeBreakdown.forEach(item => {
      updated[item.size] = item.maxAvailable > 0 ? item.maxAvailable : '';
    });
    setSizeInputs(updated);
  };

  // Quick action: Clear all
  const handleClearAll = () => {
    const updated: Record<string, number | ''> = {};
    sizeBreakdown.forEach(item => {
      updated[item.size] = '';
    });
    setSizeInputs(updated);
  };

  // Handle individual size input change
  const handleSizeInputChange = (sizeName: string, val: string) => {
    if (val === '') {
      setSizeInputs(prev => ({ ...prev, [sizeName]: '' }));
      return;
    }
    const item = sizeBreakdown.find(s => s.size === sizeName);
    let num = Math.max(0, parseInt(val, 10) || 0);
    if (item && item.maxAvailable >= 0 && num > item.maxAvailable) {
      num = item.maxAvailable;
    }
    setSizeInputs(prev => ({ ...prev, [sizeName]: num }));
  };

  // Submit and Save Production Entry
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedStyle || !selectedPo || !selectedColour) {
      setErrorMessage('Please select Style, PO Number, and Colour.');
      return;
    }

    const currentInputs = { ...sizeInputs };
    const currentBreakdown = [...sizeBreakdown];
    const totalEntered: number = Object.values(currentInputs).reduce<number>((sum, val) => sum + (Number(val) || 0), 0);

    if (totalEntered <= 0) {
      setErrorMessage('Please enter a quantity greater than 0 for at least one size.');
      return;
    }

    // Validate size by size against Available Balance (Capped strictly by Finishing Receive Qty)
    for (const item of currentBreakdown) {
      const entered = Number(currentInputs[item.size] || 0);
      if (entered > 0 && entered > item.maxAvailable) {
        setErrorMessage(
          `Quantity entered for size "${item.size}" (${entered.toLocaleString()} pcs) exceeds available balance (${item.maxAvailable.toLocaleString()} pcs). Finishing production cannot exceed Finishing Received Qty (${item.finRecv.toLocaleString()} pcs).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const recordsToSave: FinishingRecord[] = [];

      for (const item of currentBreakdown) {
        const entered = Number(currentInputs[item.size] || 0);
        if (entered <= 0) continue;

        // Check if there is an existing record for this size today or in general
        const existing = existingFinishingRecords.find(
          r => r.size?.trim().toUpperCase() === item.size.trim().toUpperCase() && r.date === entryDate
        ) || existingFinishingRecords.find(
          r => r.size?.trim().toUpperCase() === item.size.trim().toUpperCase()
        );

        let threadCut = existing ? (existing.threadCutQty ?? existing.sewingReceiveQty ?? 0) : item.threadCutQty;
        let iron = existing ? (existing.ironedQty || 0) : item.ironedQty;
        let getUp = existing ? (existing.getUpQty || 0) : item.getUpQty;
        let tagged = existing ? (existing.taggedQty || existing.finishedQty || 0) : item.taggedQty;
        let poly = existing ? (existing.packedQty || existing.polyQty || existing.finishedQty || 0) : item.packedQty;
        let carton = existing ? (existing.cartonQty || 0) : item.cartonQty;
        let readyShip = existing ? (existing.readyForShipmentQty || (existing.isReadyForShipment ? poly : 0)) : item.readyShipQty;
        let isReady = existing ? Boolean(existing.isReadyForShipment) : (readyShip > 0);

        if (selectedProcess === 'Thread Cutting') {
          threadCut = Math.min(item.finRecv, threadCut + entered);
        } else if (selectedProcess === 'Iron') {
          iron = Math.min(item.finRecv, iron + entered);
          if (threadCut < iron) threadCut = iron;
        } else if (selectedProcess === 'Get Up') {
          getUp = Math.min(item.finRecv, getUp + entered);
          if (iron < getUp) iron = getUp;
          if (threadCut < getUp) threadCut = getUp;
        } else if (selectedProcess === 'Hang Tag') {
          tagged = Math.min(item.finRecv, tagged + entered);
          if (getUp < tagged) getUp = tagged;
          if (iron < tagged) iron = tagged;
          if (threadCut < tagged) threadCut = tagged;
        } else if (selectedProcess === 'Poly') {
          poly = Math.min(item.finRecv, poly + entered);
          if (tagged < poly) tagged = poly;
          if (getUp < poly) getUp = poly;
          if (iron < poly) iron = poly;
          if (threadCut < poly) threadCut = poly;
        } else if (selectedProcess === 'Carton') {
          carton = Math.min(item.finRecv, carton + entered);
          if (poly < carton) poly = carton;
          if (tagged < carton) tagged = carton;
          if (getUp < carton) getUp = carton;
          if (iron < carton) iron = carton;
          if (threadCut < carton) threadCut = carton;
        } else if (selectedProcess === 'Ready for Shipment') {
          readyShip = Math.min(item.finRecv, readyShip + entered);
          isReady = true;
          if (carton < readyShip) carton = readyShip;
          if (poly < readyShip) poly = readyShip;
          if (tagged < readyShip) tagged = readyShip;
          if (getUp < readyShip) getUp = readyShip;
          if (iron < readyShip) iron = readyShip;
          if (threadCut < readyShip) threadCut = readyShip;
        } else if (selectedProcess === 'All Processes') {
          threadCut = Math.min(item.finRecv, threadCut + entered);
          iron = Math.min(item.finRecv, iron + entered);
          getUp = Math.min(item.finRecv, getUp + entered);
          tagged = Math.min(item.finRecv, tagged + entered);
          poly = Math.min(item.finRecv, poly + entered);
          carton = Math.min(item.finRecv, carton + entered);
          readyShip = Math.min(item.finRecv, readyShip + entered);
          isReady = true;
        }

        const baseInput = Math.max(item.finRecv, threadCut, iron, getUp, tagged, poly, carton, readyShip);

        const finRec: FinishingRecord = {
          id: existing ? existing.id : `fin-${selectedStyle}-${selectedPo}-${selectedColour}-${item.size}-${Date.now()}`,
          date: entryDate,
          buyer: selectedBuyer,
          styleNo: selectedStyle,
          poNo: selectedPo,
          colour: selectedColour,
          size: item.size,
          sewingReceiveQty: baseInput,
          finishingInputQty: baseInput,
          threadCutQty: threadCut,
          ironedQty: iron,
          getUpQty: getUp,
          foldedQty: poly,
          taggedQty: tagged,
          packedQty: poly,
          polyQty: poly,
          cartonQty: carton,
          finishedQty: poly,
          reworkQty: 0,
          rejectQty: 0,
          operator: operator || currentUser?.name || 'Finishing Supervisor',
          hangTagStatus: tagged >= baseInput && baseInput > 0 ? 'Completed' : 'In Progress',
          transferredToPackingQty: poly,
          isReadyForShipment: isReady || readyShip > 0,
          readyForShipmentQty: readyShip,
          readyForShipmentDate: (isReady || readyShip > 0) ? entryDate : undefined,
          shipmentStatus: (isReady || readyShip > 0) ? 'Ready For Shipment' : 'In Finishing',
          remarks: remarks || undefined
        };

        recordsToSave.push(finRec);
      }

      await supabaseDataService.saveFinishingRecordsBatch(recordsToSave, currentUser?.name);

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.error('Save Finishing Production Error:', err);
      setErrorMessage(err?.message || 'Failed to save production entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      headerGradient={true}
      headerIcon={<Sparkles className="w-5 h-5 text-amber-300" />}
      title="Finishing Production Entry"
      subtitle="Log production quantities for Thread Cutting, Iron, Get Up, Hangtag, Poly & Carton broken down by size."
      headerBadge={
        <span className="px-2 py-0.5 bg-blue-500/30 text-blue-100 border border-blue-400/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Process & Size-Wise
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl flex items-center gap-2 font-bold animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Order Selection Hierarchy & Universal Search */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            {/* 1. Universal Search Bar (Buyer / Style / PO / Colour / Size) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold uppercase text-slate-700 dark:text-slate-300 tracking-wider flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Select Item via Search (Buyer / Style / PO / Colour / Size)
                </label>
                {selectedStyle && selectedPo && selectedColour && (
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100/90 dark:bg-blue-950/80 border border-blue-300 dark:border-blue-700 px-2 py-0.5 rounded-md">
                    Active Selection Loaded
                  </span>
                )}
              </div>

              <div className="relative">
                <div className="w-full flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xs focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                  {selectedBuyer && (
                    <span className="text-xs font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700 px-2 py-0.5 rounded-md shrink-0">
                      {selectedBuyer}
                    </span>
                  )}
                  {selectedStyle ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 flex-1 overflow-hidden truncate">
                      <span>Style: <strong className="text-slate-950 dark:text-white font-black">{selectedStyle}</strong></span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span>PO: <strong className="text-slate-900 dark:text-slate-100 font-bold">{selectedPo || 'Select PO'}</strong></span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedColour || 'Select Colour'}</span>
                      {orderDetails?.orderQty ? (
                        <span className="text-slate-400 text-[11px] font-mono">
                          ({orderDetails.orderQty.toLocaleString()} pcs Order)
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        setIsSearchOpen(true);
                      }}
                      onFocus={() => setIsSearchOpen(true)}
                      placeholder="Search by Buyer, Style No, PO Number, or Colour..."
                      className="w-full text-xs bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium"
                    />
                  )}

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Search className="w-4 h-4 text-slate-400" />
                    {selectedStyle && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStyle('');
                          setSelectedPo('');
                          setSelectedColour('');
                          setSelectedBuyer('');
                          setSizeInputs({});
                          setSearchQuery('');
                        }}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
                        title="Clear Selection to Search Again"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Typeahead Suggestions Dropdown */}
                {isSearchOpen && searchResults.length > 0 && (
                  <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900/70 text-[11px] font-bold text-slate-600 dark:text-slate-400 flex justify-between">
                      <span>Matching Master Orders ({searchResults.length})</span>
                      <span className="text-[10px] text-slate-400">Click to auto-populate</span>
                    </div>
                    {searchResults.map(res => (
                      <div
                        key={res.key}
                        onClick={() => handleSelectSearchResult(res)}
                        className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition flex items-center justify-between group"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                              {res.styleNo}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-medium">
                              {res.buyer}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              PO: <strong className="text-slate-700 dark:text-slate-300">{res.poNo}</strong>
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">{res.colour}</span>
                            <span>•</span>
                            <span>Order: <strong className="text-slate-700 dark:text-slate-300">{res.orderQty?.toLocaleString()} pcs</strong></span>
                            {res.sizes && res.sizes.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-[10px] text-slate-400">Sizes: {res.sizes.join(', ')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="px-2.5 py-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-md group-hover:bg-blue-600 group-hover:text-white transition"
                        >
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                Or Select from Dropdowns
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Buyer: <strong className="text-slate-800 dark:text-slate-200">{selectedBuyer || 'N/A'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Buyer Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Buyer
                </label>
                <select
                  value={selectedBuyer}
                  onChange={e => {
                    const b = e.target.value;
                    setSelectedBuyer(b);
                    const matchingStyles = orders.filter(o => !b || o.buyer === b);
                    if (matchingStyles.length > 0) {
                      setSelectedStyle(matchingStyles[0].styleNo);
                      const pos = supabaseDataService.getPurchaseOrders(matchingStyles[0].styleNo);
                      if (pos.length > 0) {
                        setSelectedPo(pos[0].poNo);
                        const cols = supabaseDataService.getColours(matchingStyles[0].styleNo, pos[0].poNo);
                        if (cols.length > 0) setSelectedColour(cols[0].colour);
                      }
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Buyers</option>
                  {buyers.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Style Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Style No <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedStyle}
                  onChange={e => {
                    const s = e.target.value;
                    setSelectedStyle(s);
                    const order = orders.find(o => o.styleNo === s);
                    if (order?.buyer) setSelectedBuyer(order.buyer);
                    const pos = supabaseDataService.getPurchaseOrders(s);
                    if (pos.length > 0) {
                      setSelectedPo(pos[0].poNo);
                      const cols = supabaseDataService.getColours(s, pos[0].poNo);
                      if (cols.length > 0) setSelectedColour(cols[0].colour);
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500"
                >
                  {styles.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* PO Number Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  PO Number <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedPo}
                  onChange={e => {
                    const p = e.target.value;
                    setSelectedPo(p);
                    const cols = supabaseDataService.getColours(selectedStyle, p);
                    if (cols.length > 0) setSelectedColour(cols[0].colour);
                  }}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500"
                >
                  {purchaseOrders.map(p => (
                    <option key={p.poNo} value={p.poNo}>{p.poNo}</option>
                  ))}
                </select>
              </div>

              {/* Colour Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Colour <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedColour}
                  onChange={e => setSelectedColour(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500"
                >
                  {colours.map(c => (
                    <option key={c.colour} value={c.colour}>{c.colour} ({c.totalQty.toLocaleString()} pcs)</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target Process Selector Badges */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80">
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Finishing Process:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                {[
                  { key: 'Thread Cutting', label: '1. Thread Cut', icon: Scissors, color: 'hover:border-emerald-500 active:bg-emerald-50 text-emerald-700 dark:text-emerald-300' },
                  { key: 'Iron', label: '2. Iron Press', icon: Flame, color: 'hover:border-amber-500 active:bg-amber-50 text-amber-700 dark:text-amber-300' },
                  { key: 'Get Up', label: '3. Get Up (QC)', icon: ShieldCheck, color: 'hover:border-cyan-500 active:bg-cyan-50 text-cyan-700 dark:text-cyan-300' },
                  { key: 'Hang Tag', label: '4. Hangtag', icon: Tag, color: 'hover:border-purple-500 active:bg-purple-50 text-purple-700 dark:text-purple-300' },
                  { key: 'Poly', label: '5. Poly Pack', icon: Box, color: 'hover:border-blue-500 active:bg-blue-50 text-blue-700 dark:text-blue-300' },
                  { key: 'Carton', label: '6. Carton Pack', icon: Archive, color: 'hover:border-indigo-500 active:bg-indigo-50 text-indigo-700 dark:text-indigo-300' },
                  { key: 'Ready for Shipment', label: 'Ready for Ship', icon: PackageCheck, color: 'hover:border-green-500 active:bg-green-50 text-green-700 dark:text-green-300' }
                ].map(proc => {
                  const Icon = proc.icon;
                  const isSelected = selectedProcess === proc.key;
                  return (
                    <button
                      key={proc.key}
                      type="button"
                      onClick={() => setSelectedProcess(proc.key as FinishingProcessType)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-black'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-white' : ''}`} />
                      <span className="text-[10px] leading-tight">{proc.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Size-Wise Production Entry Grid */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>Size-Wise Production Breakdown</span>
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 rounded font-black text-[10px]">
                    {selectedProcess}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Input today's output count per size. System verifies against available finishing stock.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleFillAllAvailable}
                  className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-[11px] font-bold hover:bg-blue-100 transition-colors"
                >
                  Fill All Available Balance
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[11px] font-medium hover:bg-slate-200 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5">Size</th>
                    <th className="p-2.5 text-right">Order Target</th>
                    <th className="p-2.5 text-right text-blue-700 dark:text-blue-300">Finishing Recv</th>
                    <th className="p-2.5 text-right text-purple-700 dark:text-purple-300">Prev Done</th>
                    <th className="p-2.5 text-right text-emerald-700 dark:text-emerald-300">Available Bal</th>
                    <th className="p-2.5 text-right w-44 bg-blue-50/50 dark:bg-blue-950/30">
                      Entry Quantity (Pcs) <span className="text-rose-500">*</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {sizeBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                        No size breakdown found for selected Style, PO & Colour.
                      </td>
                    </tr>
                  ) : (
                    sizeBreakdown.map(item => {
                      const isComplete = item.maxAvailable <= 0;
                      return (
                        <tr
                          key={item.size}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            isComplete ? 'bg-slate-50/40 dark:bg-slate-800/20 opacity-70' : ''
                          }`}
                        >
                          <td className="p-2.5 font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-black text-xs">
                              {item.size}
                            </span>
                            {isComplete && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                                ✓ Recv Met
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right font-medium text-slate-400 line-through">
                            {item.orderQty.toLocaleString()} pcs
                          </td>
                          <td className="p-2.5 text-right font-black text-blue-700 dark:text-blue-400">
                            {item.finRecv.toLocaleString()} pcs
                          </td>
                          <td className="p-2.5 text-right font-semibold text-purple-600 dark:text-purple-400">
                            {item.alreadyDone.toLocaleString()} pcs
                          </td>
                          <td className="p-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                            {item.maxAvailable.toLocaleString()} pcs
                          </td>
                          <td className="p-2.5 text-right bg-blue-50/30 dark:bg-blue-950/20">
                            <input
                              type="number"
                              min="0"
                              max={item.maxAvailable > 0 ? item.maxAvailable : 0}
                              value={sizeInputs[item.size] ?? ''}
                              onChange={e => handleSizeInputChange(item.size, e.target.value)}
                              placeholder={isComplete ? '0 (Max Recv)' : '0'}
                              disabled={isComplete}
                              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-right font-extrabold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:dark:bg-slate-800/40 disabled:cursor-not-allowed disabled:text-slate-400"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {sizeBreakdown.length > 0 && (
                  <tfoot className="bg-slate-900 text-white font-black text-xs">
                    <tr>
                      <td className="p-2.5">Total Summary</td>
                      <td className="p-2.5 text-right">
                        {sizeBreakdown.reduce((sum, i) => sum + i.orderQty, 0).toLocaleString()} pcs
                      </td>
                      <td className="p-2.5 text-right text-blue-300">
                        {sizeBreakdown.reduce((sum, i) => sum + i.finRecv, 0).toLocaleString()} pcs
                      </td>
                      <td className="p-2.5 text-right text-purple-300">
                        {sizeBreakdown.reduce((sum, i) => sum + i.alreadyDone, 0).toLocaleString()} pcs
                      </td>
                      <td className="p-2.5 text-right text-emerald-300">
                        {sizeBreakdown.reduce((sum, i) => sum + i.maxAvailable, 0).toLocaleString()} pcs
                      </td>
                      <td className="p-2.5 text-right bg-blue-950 text-amber-300 font-extrabold text-sm">
                        {totalEnteredQty.toLocaleString()} pcs
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Section 3: Metadata / Operator & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Entry Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Supervisor / Operator Name
              </label>
              <input
                type="text"
                value={operator}
                onChange={e => setOperator(e.target.value)}
                placeholder="e.g. Md. Kabir Hossain"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                Remarks / Quality Note
              </label>
              <input
                type="text"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Optional notes or batch code"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Total to save: <strong className="text-blue-600 dark:text-blue-400 font-black text-sm">{totalEnteredQty.toLocaleString()} pcs</strong>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || totalEnteredQty <= 0}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
              >
                {isSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Finishing Entry</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
    </ModalPortal>
  );
};
