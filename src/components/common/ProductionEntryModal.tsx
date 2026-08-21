import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Scissors, X, Sparkles, AlertCircle } from 'lucide-react';
import { supabaseDataService } from '../../services/supabaseDataService';
import { ProductionOrder } from '../../types';
import { getDepartmentReceivedSizeMap } from '../../utils/sewingCalculationUtils';
import { useToast } from '../../context/ToastContext';

export interface ProductionSizeEntryRow {
  size: string;
  realOrderQty: number;
  allowanceQty: number;
  factoryOrderQty: number;
  orderQty: number;
  receivedQty: number;
  alreadyProducedQty: number;
  dueQty: number;
  newQty: number | '';
}

export interface ProductionEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName: 'Cutting' | 'Sewing' | 'Washing' | 'Finishing' | 'QC';
  title?: string;
  icon?: React.ElementType;
  initialStyleNo?: string;
  initialPoNo?: string;
  initialColour?: string;
  // Specific inputs for the module
  customFields?: React.ReactNode;
  onSave: (data: {
    buyer: string;
    styleNo: string;
    poNo: string;
    colour: string;
    sizeWiseQuantities: Record<string, number>;
    totalNewQty: number;
    notes: string;
  }) => Promise<void> | void;
  isLoading?: boolean;
}

export const ProductionEntryModal: React.FC<ProductionEntryModalProps> = ({
  isOpen,
  onClose,
  moduleName,
  title,
  icon: IconComponent = Scissors,
  initialStyleNo = '',
  initialPoNo = '',
  initialColour = '',
  customFields,
  onSave,
  isLoading = false
}) => {
  const [orders, setOrders] = useState<ProductionOrder[]>(supabaseDataService.getOrders());

  // Hierarchy Selection State
  const [selectedStyleNo, setSelectedStyleNo] = useState(initialStyleNo);
  const [selectedPoNo, setSelectedPoNo] = useState(initialPoNo);
  const [selectedColour, setSelectedColour] = useState(initialColour);
  const [selectedBuyer, setSelectedBuyer] = useState('');

  // Size-wise entries mapping: { [size]: number | '' }
  const [sizeInputs, setSizeInputs] = useState<Record<string, number | ''>>({});
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const isCutting = moduleName === 'Cutting';

  useEffect(() => {
    const update = () => setOrders(supabaseDataService.getOrders());
    update();
    const unsub = supabaseDataService.subscribe(update);
    return unsub;
  }, []);

  // When initial props change or modal opens
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      if (initialStyleNo) {
        setSelectedStyleNo(initialStyleNo);
        const order = orders.find(o => o.styleNo === initialStyleNo);
        if (order) setSelectedBuyer(order.buyer);
      }
      if (initialPoNo) setSelectedPoNo(initialPoNo);
      if (initialColour) setSelectedColour(initialColour);
      setNotes('');
      setErrorMessage(null);
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, initialStyleNo, initialPoNo, initialColour, orders]);

  // Filter active uncompleted orders for production entry
  const availableOrders = useMemo(() => {
    return orders.filter(o => (o.status !== 'Completed' && o.status !== 'Shipment Complete' && o.status !== 'Cancelled') || o.styleNo === selectedStyleNo);
  }, [orders, selectedStyleNo]);

  // 1. Available Buyers list
  const availableBuyers = useMemo(() => {
    return supabaseDataService.getBuyers(false);
  }, [orders]);

  // 2. Available POs (filtered by selected Buyer)
  const availablePOs = useMemo(() => {
    return supabaseDataService.getBuyerPOs(selectedBuyer, false);
  }, [orders, selectedBuyer]);

  // 3. Available Styles (filtered by selected PO and Buyer)
  const availableStyles = useMemo(() => {
    if (!selectedPoNo) {
      return supabaseDataService.getStyles(selectedBuyer, false);
    }
    return supabaseDataService.getPOStyles(selectedPoNo, selectedBuyer, false);
  }, [orders, selectedPoNo, selectedBuyer]);

  // Derived Objects
  const currentStyleObj = useMemo(() => {
    if (!selectedStyleNo) return null;
    return orders.find(o => o.styleNo.trim().toUpperCase() === selectedStyleNo.trim().toUpperCase()) || null;
  }, [orders, selectedStyleNo]);

  const currentPoObj = useMemo(() => {
    if (!selectedPoNo) return null;
    if (currentStyleObj) {
      const found = (currentStyleObj.purchaseOrders || []).find(
        p => p.poNo.trim().toUpperCase() === selectedPoNo.trim().toUpperCase()
      );
      if (found) return found;
    }
    return availablePOs.find(p => p.poNo.trim().toUpperCase() === selectedPoNo.trim().toUpperCase()) || null;
  }, [currentStyleObj, availablePOs, selectedPoNo]);

  // 4. Available Colours (strictly belonging to selected Style + PO)
  const availableColours = useMemo(() => {
    if (!selectedStyleNo || !selectedPoNo) return [];
    return supabaseDataService.getColours(selectedStyleNo, selectedPoNo, false);
  }, [selectedStyleNo, selectedPoNo, orders]);

  const currentColourObj = useMemo(() => {
    if (!selectedColour || availableColours.length === 0) return null;
    return availableColours.find(
      c => c.colour.trim().toUpperCase() === selectedColour.trim().toUpperCase()
    ) || null;
  }, [availableColours, selectedColour]);

  // Real-time live production progress for this Style+PO+Colour
  const liveProgress = useMemo(() => {
    if (!selectedStyleNo || !selectedPoNo || !selectedColour) return null;
    return supabaseDataService.getStylePoColourProgress(selectedStyleNo, selectedPoNo, selectedColour);
  }, [selectedStyleNo, selectedPoNo, selectedColour, orders]);

  // Automatically initialize default sizes when colour is picked
  const availableSizes = useMemo(() => {
    if (!currentColourObj || !currentColourObj.sizeQuantities) return [];
    return Object.keys(currentColourObj.sizeQuantities).filter(
      k => (currentColourObj.sizeQuantities[k] || 0) > 0
    );
  }, [currentColourObj]);

  // Calculate size-wise received quantities for the active department
  const deptReceivedMap = useMemo(() => {
    if (isCutting || !currentColourObj?.sizeQuantities || !selectedStyleNo) {
      return {};
    }
    const allTransfers = supabaseDataService.getTransfers();
    return getDepartmentReceivedSizeMap(
      moduleName,
      selectedStyleNo,
      selectedPoNo,
      selectedColour,
      currentColourObj.sizeQuantities,
      allTransfers,
      selectedBuyer || currentStyleObj?.buyer
    );
  }, [isCutting, moduleName, selectedStyleNo, selectedPoNo, selectedColour, currentColourObj, orders, selectedBuyer, currentStyleObj]);

  // Size breakdown rows computation
  const sizeRows: ProductionSizeEntryRow[] = useMemo(() => {
    if (!currentColourObj || !currentColourObj.sizeQuantities) return [];
    const colAllowance = Number(currentColourObj.allowancePct ?? currentPoObj?.allowancePct ?? currentStyleObj?.allowancePct ?? 0);

    return availableSizes.map(sz => {
      const realOrderQty = currentColourObj.sizeQuantities[sz] || 0;
      let allowanceQty = 0;
      if (currentColourObj.allowanceSizeQuantities && currentColourObj.allowanceSizeQuantities[sz] !== undefined) {
        allowanceQty = Number(currentColourObj.allowanceSizeQuantities[sz]) || 0;
      } else {
        allowanceQty = Math.round(realOrderQty * (colAllowance / 100));
      }
      let factoryOrderQty = realOrderQty + allowanceQty;
      if (currentColourObj.factorySizeQuantities && currentColourObj.factorySizeQuantities[sz] !== undefined) {
        factoryOrderQty = Number(currentColourObj.factorySizeQuantities[sz]) || factoryOrderQty;
      }

      const receivedQty = deptReceivedMap[sz] || 0;
      let alreadyDone = 0;

      if (liveProgress?.sizeBreakdown) {
        const item = liveProgress.sizeBreakdown.find(
          s => s.size.trim().toUpperCase() === sz.trim().toUpperCase()
        );
        if (item) {
          switch (moduleName) {
            case 'Cutting':
              alreadyDone = item.cutQty || 0;
              break;
            case 'Sewing':
              alreadyDone = item.sewOutput || 0;
              break;
            case 'Washing':
              alreadyDone = item.washingReceivedQty || 0;
              break;
            case 'Finishing':
              alreadyDone = item.finQty || 0;
              break;
            case 'QC':
              alreadyDone = item.qcPassedQty || 0;
              break;
            default:
              alreadyDone = item.cutQty || 0;
          }
        }
      }

      // For Cutting, base production order quantity is Factory Order Qty. For all other depts, base is Receive Qty.
      const baselineQty = isCutting ? factoryOrderQty : receivedQty;
      const dueQty = Math.max(0, baselineQty - alreadyDone);
      const newQty = sizeInputs[sz] !== undefined ? sizeInputs[sz] : '';

      return {
        size: sz,
        realOrderQty,
        allowanceQty,
        factoryOrderQty,
        orderQty: factoryOrderQty,
        receivedQty,
        alreadyProducedQty: alreadyDone,
        dueQty,
        newQty
      };
    });
  }, [currentColourObj, availableSizes, liveProgress, moduleName, sizeInputs, deptReceivedMap, isCutting, currentPoObj, currentStyleObj]);

  // Summary Totals
  const totalRealOrderQty = sizeRows.reduce((sum, r) => sum + r.realOrderQty, 0);
  const totalAllowanceQty = sizeRows.reduce((sum, r) => sum + r.allowanceQty, 0);
  const totalFactoryOrderQty = sizeRows.reduce((sum, r) => sum + r.factoryOrderQty, 0);
  const totalReceivedQty = sizeRows.reduce((sum, r) => sum + r.receivedQty, 0);
  const totalAlreadyProduced = sizeRows.reduce((sum, r) => sum + r.alreadyProducedQty, 0);
  const totalDueQty = Math.max(0, (isCutting ? totalFactoryOrderQty : totalReceivedQty) - totalAlreadyProduced);
  const totalNewQty = sizeRows.reduce((sum, r) => sum + (Number(r.newQty) || 0), 0);

  const handleSizeInputChange = (sz: string, val: string) => {
    const num = val === '' ? '' : Number(val);
    setSizeInputs(prev => ({
      ...prev,
      [sz]: num
    }));
  };

  const handleFillDueQuantities = () => {
    const newInputs: Record<string, number> = {};
    sizeRows.forEach(r => {
      newInputs[r.size] = r.dueQty;
    });
    setSizeInputs(newInputs);
  };

  const handleClearInputs = () => {
    setSizeInputs({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!selectedStyleNo || !selectedPoNo || !selectedColour) {
      setErrorMessage('Please select Style / Order, PO Number, and Colour.');
      return;
    }

    if (totalNewQty <= 0) {
      setErrorMessage(`Please enter a valid quantity for at least one size in "NEW ${moduleName.toUpperCase()} QTY".`);
      return;
    }

    // Size-wise Factory Order Qty & Production limit validation rule
    for (const r of sizeRows) {
      const q = Number(sizeInputs[r.size]) || 0;
      if (q > 0) {
        const maxLimit = isCutting ? r.factoryOrderQty : r.receivedQty;
        if (maxLimit > 0 && r.alreadyProducedQty + q > maxLimit) {
          const limitName = isCutting ? 'Factory Order Qty' : 'Received Qty';
          setErrorMessage(
            `Quantity for size "${r.size}" (${q.toLocaleString()} pcs + already produced ${r.alreadyProducedQty.toLocaleString()} pcs = ${(r.alreadyProducedQty + q).toLocaleString()} pcs) exceeds the size-wise ${limitName} limit (${maxLimit.toLocaleString()} pcs). Maximum available due: ${r.dueQty.toLocaleString()} pcs.`
          );
          return;
        }
      }
    }

    const cleanSizeQuantities: Record<string, number> = {};
    sizeRows.forEach(r => {
      const q = Number(sizeInputs[r.size]) || 0;
      if (q > 0) {
        cleanSizeQuantities[r.size] = q;
      }
    });

    try {
      await onSave({
        buyer: selectedBuyer || currentStyleObj?.buyer || 'Unknown Buyer',
        styleNo: selectedStyleNo,
        poNo: selectedPoNo,
        colour: selectedColour,
        sizeWiseQuantities: cleanSizeQuantities,
        totalNewQty,
        notes
      });
      toast.success(`${moduleName} Production entry (${totalNewQty.toLocaleString()} pcs) saved successfully!`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save production entry.');
    }
  };

  if (!isOpen) return null;

  // Verb naming
  const moduleActionLabels: Record<string, { done: string; due: string; newField: string }> = {
    Cutting: { done: 'ALREADY CUT', due: 'CUTTING DUE', newField: 'NEW CUT QTY' },
    Sewing: { done: 'ALREADY SEWN', due: 'SEWING DUE', newField: 'NEW SEWING QTY' },
    Washing: { done: 'ALREADY WASHED', due: 'WASH DUE', newField: 'NEW WASH QTY' },
    Finishing: { done: 'ALREADY PACKED', due: 'PACKING DUE', newField: 'NEW FINISH QTY' },
    QC: { done: 'ALREADY INSPECTED', due: 'QC DUE', newField: 'NEW QC QTY' },
  };

  const actionLabels = moduleActionLabels[moduleName] || {
    done: 'ALREADY PRODUCED',
    due: 'PRODUCTION DUE',
    newField: `NEW ${moduleName.toUpperCase()} QTY`
  };

  const defaultModalTitle = title || `NEW ${moduleName.toUpperCase()} PRODUCTION LOG ENTRY`;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center p-2 sm:p-4 pt-3 sm:pt-6 md:pt-8 pb-6 bg-slate-950/80 backdrop-blur-xs animate-fade-in overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] flex flex-col min-h-0 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-700/30 dark:border-slate-800 overflow-hidden relative z-[10000]"
        onClick={e => e.stopPropagation()}
      >
        {/* Dark Premium Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#0b1329] dark:bg-slate-950 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600/30 text-blue-400 flex items-center justify-center border border-blue-500/40">
              <IconComponent className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-black tracking-wide uppercase text-slate-100 flex items-center gap-2">
              {defaultModalTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-900/50 overscroll-contain">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Buyer, PO, Style & Colour Cascading Selectors (Strict Buyer -> PO -> Style -> Colour Flow) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 p-3 sm:p-3.5 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            {/* 1. Buyer Selector */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-slate-600 dark:text-slate-300 mb-1">
                Buyer <span className="text-slate-400 font-normal">({availableBuyers.length})</span>
              </label>
              <select
                value={selectedBuyer}
                onChange={e => {
                  const b = e.target.value;
                  setSelectedBuyer(b);
                  const pos = supabaseDataService.getBuyerPOs(b, false);
                  if (pos.length === 1) {
                    const po = pos[0].poNo;
                    setSelectedPoNo(po);
                    const styles = supabaseDataService.getPOStyles(po, b, false);
                    if (styles.length === 1) {
                      const st = styles[0].styleNo;
                      setSelectedStyleNo(st);
                      const cols = supabaseDataService.getColours(st, po, false);
                      if (cols.length === 1) {
                        setSelectedColour(cols[0].colour);
                      } else {
                        setSelectedColour('');
                      }
                    } else {
                      setSelectedStyleNo('');
                      setSelectedColour('');
                    }
                  } else {
                    setSelectedPoNo('');
                    setSelectedStyleNo('');
                    setSelectedColour('');
                  }
                  setSizeInputs({});
                }}
                className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-750 outline-none cursor-pointer"
              >
                <option value="">-- All Buyers --</option>
                {availableBuyers.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* 2. PO Number */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-slate-600 dark:text-slate-300 mb-1">
                PO Number <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedPoNo}
                onChange={e => {
                  const p = e.target.value;
                  setSelectedPoNo(p);
                  const poObj = availablePOs.find(po => po.poNo === p);
                  if (poObj?.buyer && !selectedBuyer) {
                    setSelectedBuyer(poObj.buyer);
                  }
                  const styles = supabaseDataService.getPOStyles(p, selectedBuyer || poObj?.buyer, false);
                  if (styles.length === 1) {
                    const st = styles[0].styleNo;
                    setSelectedStyleNo(st);
                    const cols = supabaseDataService.getColours(st, p, false);
                    if (cols.length === 1) {
                      setSelectedColour(cols[0].colour);
                    } else {
                      setSelectedColour('');
                    }
                  } else {
                    setSelectedStyleNo('');
                    setSelectedColour('');
                  }
                  setSizeInputs({});
                }}
                disabled={availablePOs.length === 0}
                className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-750 outline-none cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400"
              >
                <option value="">-- Select PO ({availablePOs.length}) --</option>
                {availablePOs.map(po => (
                  <option key={po.id || po.poNo} value={po.poNo}>
                    {po.poNo} ({po.totalQty?.toLocaleString()} pcs)
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Style / Order */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-slate-600 dark:text-slate-300 mb-1">
                Style / Order <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedStyleNo}
                onChange={e => {
                  const s = e.target.value;
                  setSelectedStyleNo(s);
                  const order = orders.find(o => o.styleNo === s);
                  if (order?.buyer && !selectedBuyer) {
                    setSelectedBuyer(order.buyer);
                  }
                  const cols = supabaseDataService.getColours(s, selectedPoNo, false);
                  if (cols.length === 1) {
                    setSelectedColour(cols[0].colour);
                  } else {
                    setSelectedColour('');
                  }
                  setSizeInputs({});
                }}
                disabled={availableStyles.length === 0}
                className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-750 outline-none cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400"
              >
                <option value="">-- Select Style ({availableStyles.length}) --</option>
                {availableStyles.map(s => (
                  <option key={s.id || s.styleNo} value={s.styleNo}>
                    {s.styleNo} - {s.styleName || s.garmentType}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Colour */}
            <div>
              <label className="block text-[11px] font-extrabold uppercase text-slate-600 dark:text-slate-300 mb-1">
                Colour <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedColour}
                onChange={e => {
                  setSelectedColour(e.target.value);
                  setSizeInputs({});
                }}
                disabled={!selectedStyleNo || !selectedPoNo || availableColours.length === 0}
                className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-750 outline-none cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400"
              >
                <option value="">
                  {!selectedStyleNo || !selectedPoNo
                    ? '-- Select PO & Style First --'
                    : availableColours.length === 0
                    ? 'No Colours configured'
                    : `-- Select Colour (${availableColours.length}) --`}
                </option>
                {availableColours.map(c => (
                  <option key={c.colour} value={c.colour}>
                    {c.colour} ({c.totalQty?.toLocaleString()} pcs)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Custom Operational Fields (Table No / Plies / Line / Wash Type / etc.) */}
          {customFields && (
            <div className="space-y-2">
              {customFields}
            </div>
          )}

          {/* 4. Exact Size-Wise Matrix Table (Like the Reference Image) */}
          <div className="space-y-1.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {isCutting ? 'Size-Wise Factory Order Qty' : 'Size-Wise Receive Qty'}, {actionLabels.done}, {actionLabels.due} & {actionLabels.newField}
              </label>
              {sizeRows.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFillDueQuantities}
                    className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 border border-blue-300 dark:border-blue-800 px-2 py-0.5 rounded transition cursor-pointer"
                  >
                    Auto Fill Remaining Due
                  </button>
                  <button
                    type="button"
                    onClick={handleClearInputs}
                    className="text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 rounded transition cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-300/90 dark:border-slate-800 overflow-hidden shadow-xs bg-white dark:bg-slate-900">
              {/* Dark Table Header */}
              {isCutting ? (
                <div className="bg-[#0b1329] dark:bg-slate-950 text-white px-3 py-2.5 grid grid-cols-12 text-[10px] sm:text-[11px] font-black tracking-wider uppercase items-center text-center">
                  <div className="col-span-1 text-left font-black text-slate-200">Size</div>
                  <div className="col-span-2 text-right font-black text-slate-300">Real Order</div>
                  <div className="col-span-1 text-right font-black text-amber-300">Allow.</div>
                  <div className="col-span-2 text-right font-black text-blue-300">Factory Order</div>
                  <div className="col-span-2 text-right font-black text-emerald-400">{actionLabels.done}</div>
                  <div className="col-span-2 text-right font-black text-amber-400">{actionLabels.due}</div>
                  <div className="col-span-2 text-right font-black text-blue-400">{actionLabels.newField}</div>
                </div>
              ) : (
                <div className="bg-[#0b1329] dark:bg-slate-950 text-white px-4 py-2.5 grid grid-cols-12 text-[11px] font-black tracking-wider uppercase items-center text-center">
                  <div className="col-span-2 text-left font-black text-slate-200">Size</div>
                  <div className="col-span-2 text-right font-black text-blue-300">Factory Order</div>
                  <div className="col-span-2 text-right font-black text-slate-200">Receive Qty</div>
                  <div className="col-span-2 text-right font-black text-emerald-400">{actionLabels.done}</div>
                  <div className="col-span-2 text-right font-black text-amber-400">{actionLabels.due}</div>
                  <div className="col-span-2 text-right font-black text-blue-400">{actionLabels.newField}</div>
                </div>
              )}

              {/* Rows */}
              {sizeRows.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {selectedStyleNo && selectedPoNo && selectedColour
                    ? 'No size breakdown defined for this colour in Order Management.'
                    : 'Select Style, PO, and Colour above to load size breakdown.'}
                </div>
              ) : (
                <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                  {sizeRows.map(row => (
                    isCutting ? (
                      <div
                        key={row.size}
                        className="px-3 py-2 grid grid-cols-12 items-center text-xs font-semibold hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition"
                      >
                        <div className="col-span-1 text-left font-black text-slate-900 dark:text-slate-100 text-sm">
                          {row.size}
                        </div>
                        <div className="col-span-2 text-right font-medium text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {row.realOrderQty.toLocaleString()}
                        </div>
                        <div className="col-span-1 text-right font-bold text-amber-700 dark:text-amber-400 font-mono text-[11px]">
                          +{row.allowanceQty.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right font-black text-blue-700 dark:text-blue-400 font-mono text-xs">
                          {row.factoryOrderQty.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {row.alreadyProducedQty.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right font-bold font-mono">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                            row.dueQty === 0
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold'
                          }`}>
                            {row.dueQty.toLocaleString()}
                          </span>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <input
                            type="number"
                            min="0"
                            value={row.newQty}
                            onChange={e => handleSizeInputChange(row.size, e.target.value)}
                            placeholder="0"
                            className="w-20 text-right px-2 py-1 text-xs font-black text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-950 border border-blue-400 dark:border-blue-600 focus:border-blue-600 focus:ring-2 focus:ring-blue-500 rounded-lg outline-none shadow-2xs font-mono"
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        key={row.size}
                        className="px-4 py-2.5 grid grid-cols-12 items-center text-xs font-semibold hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition"
                      >
                        <div className="col-span-2 text-left font-black text-slate-900 dark:text-slate-100 text-sm">
                          {row.size}
                        </div>
                        <div className="col-span-2 text-right font-bold text-blue-700 dark:text-blue-400 font-mono text-xs">
                          {row.factoryOrderQty.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right font-bold text-slate-700 dark:text-slate-300 font-mono">
                          {row.receivedQty.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {row.alreadyProducedQty.toLocaleString()}
                        </div>
                        <div className="col-span-2 text-right font-bold font-mono">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                            row.dueQty === 0
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold'
                          }`}>
                            {row.dueQty.toLocaleString()}
                          </span>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <input
                            type="number"
                            min="0"
                            value={row.newQty}
                            onChange={e => handleSizeInputChange(row.size, e.target.value)}
                            placeholder="0"
                            className="w-24 text-right px-2.5 py-1 text-xs font-black text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-950 border border-blue-400 dark:border-blue-600 focus:border-blue-600 focus:ring-2 focus:ring-blue-500 rounded-lg outline-none shadow-2xs font-mono"
                          />
                        </div>
                      </div>
                    )
                  ))}

                  {/* TOTAL Summary Row */}
                  {isCutting ? (
                    <div className="px-3 py-2.5 bg-blue-50/60 dark:bg-blue-950/40 border-t-2 border-slate-300 dark:border-slate-700 grid grid-cols-12 items-center text-xs font-black">
                      <div className="col-span-1 text-left uppercase text-slate-900 dark:text-slate-100 tracking-wider font-black">
                        TOTAL
                      </div>
                      <div className="col-span-2 text-right text-slate-600 dark:text-slate-400 font-mono font-bold text-[11px]">
                        {totalRealOrderQty.toLocaleString()}
                      </div>
                      <div className="col-span-1 text-right text-amber-700 dark:text-amber-400 font-mono font-bold text-[11px]">
                        +{totalAllowanceQty.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right text-blue-900 dark:text-blue-300 font-mono font-black text-xs">
                        {totalFactoryOrderQty.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right text-emerald-700 dark:text-emerald-400 font-mono font-black">
                        {totalAlreadyProduced.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right text-amber-700 dark:text-amber-400 font-mono font-black">
                        {totalDueQty.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right text-blue-800 dark:text-blue-300 font-mono text-sm font-black">
                        {totalNewQty.toLocaleString()} <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">pcs</span>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-3 bg-blue-50/60 dark:bg-blue-950/40 border-t-2 border-slate-300 dark:border-slate-700 grid grid-cols-12 items-center text-xs font-black">
                      <div className="col-span-2 text-left uppercase text-slate-900 dark:text-slate-100 tracking-wider font-black">
                        TOTAL
                      </div>
                      <div className="col-span-2 text-right text-blue-900 dark:text-blue-300 font-mono font-black text-xs">
                        {totalFactoryOrderQty.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right text-slate-900 dark:text-slate-100 font-mono font-black">
                        {totalReceivedQty.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right text-emerald-700 dark:text-emerald-400 font-mono font-black">
                        {totalAlreadyProduced.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right text-amber-700 dark:text-amber-400 font-mono font-black">
                        {totalDueQty.toLocaleString()}
                      </div>
                      <div className="col-span-2 text-right text-blue-800 dark:text-blue-300 font-mono text-sm font-black">
                        {totalNewQty.toLocaleString()} <span className="text-xs font-medium text-slate-500 dark:text-slate-400">pcs</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 5. Notes / Remarks */}
          <div className="space-y-1">
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Notes / Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Enter shade, marker number, batch info, or production notes..."
              className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Modal Footer (Pinned at bottom) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Total Input: <span className="text-blue-700 dark:text-blue-400 font-black text-sm">{totalNewQty.toLocaleString()} pcs</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || totalNewQty <= 0}
              className="px-6 py-2 text-xs font-black rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              {isLoading ? (
                <span>Saving Record...</span>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save {moduleName} Production Entry</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
