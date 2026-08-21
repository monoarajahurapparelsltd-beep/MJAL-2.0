import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  X,
  RotateCcw,
  Check,
  Plus,
  Minus,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers
} from 'lucide-react';
import { ModalPortal } from '../../common/ModalPortal';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { ProductionOrder, QCInspection, QCDefectItem, InterDeptTransfer } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

export interface QCInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    buyer?: string;
    styleNo?: string;
    poNo?: string;
    colour?: string;
    size?: string;
    inspectionType?: string;
  } | null;
  onSuccess?: () => void;
}

// Standard Garment Industry Defect Catalog
interface DefectDefinition {
  id: string;
  category: 'Sewing' | 'Fabric' | 'Spot & Wash' | 'Trims & Measure';
  name: string;
  severity: 'Minor' | 'Major' | 'Critical';
}

const DEFECT_CATALOG: DefectDefinition[] = [
  // 1. Sewing & Stitching
  { id: 'sew_skip', category: 'Sewing', name: 'Skip Stitch', severity: 'Major' },
  { id: 'sew_broken', category: 'Sewing', name: 'Broken Stitch', severity: 'Major' },
  { id: 'sew_open', category: 'Sewing', name: 'Open Seam', severity: 'Critical' },
  { id: 'sew_pucker', category: 'Sewing', name: 'Seam Puckering', severity: 'Minor' },
  { id: 'sew_spi', category: 'Sewing', name: 'Uneven SPI', severity: 'Minor' },
  { id: 'sew_raw', category: 'Sewing', name: 'Raw Edge / Fraying', severity: 'Major' },
  { id: 'sew_tension', category: 'Sewing', name: 'Tension Loose/Tight', severity: 'Minor' },
  { id: 'sew_needle_cut', category: 'Sewing', name: 'Needle Cut / Hole', severity: 'Critical' },
  { id: 'sew_runoff', category: 'Sewing', name: 'Run-Off Seam', severity: 'Minor' },
  { id: 'sew_shape', category: 'Sewing', name: 'Asymmetric / Slanted', severity: 'Major' },

  // 2. Fabric & Material
  { id: 'fab_hole', category: 'Fabric', name: 'Fabric Hole / Cut', severity: 'Critical' },
  { id: 'fab_shade', category: 'Fabric', name: 'Shade Variation', severity: 'Major' },
  { id: 'fab_slub', category: 'Fabric', name: 'Slub / Knot Yarn', severity: 'Minor' },
  { id: 'fab_bow', category: 'Fabric', name: 'Bowing / Skewing', severity: 'Major' },
  { id: 'fab_foreign', category: 'Fabric', name: 'Foreign Yarn / Stain', severity: 'Minor' },
  { id: 'fab_print', category: 'Fabric', name: 'Print / Embroidery Defect', severity: 'Major' },

  // 3. Spot, Stain & Washing
  { id: 'spot_oil', category: 'Spot & Wash', name: 'Oil / Grease Spot', severity: 'Major' },
  { id: 'spot_dirt', category: 'Spot & Wash', name: 'Dust / Dirt Mark', severity: 'Minor' },
  { id: 'spot_water', category: 'Spot & Wash', name: 'Water Mark', severity: 'Minor' },
  { id: 'spot_wash_shade', category: 'Spot & Wash', name: 'Uneven Wash Shade', severity: 'Major' },
  { id: 'spot_burn', category: 'Spot & Wash', name: 'Iron Shine / Burn', severity: 'Critical' },

  // 4. Trims, Measurement & Finishing
  { id: 'trim_spec', category: 'Trims & Measure', name: 'Measurement Out (+/-)', severity: 'Major' },
  { id: 'trim_label', category: 'Trims & Measure', name: 'Wrong / Slanted Label', severity: 'Major' },
  { id: 'trim_button', category: 'Trims & Measure', name: 'Missing / Broken Button', severity: 'Critical' },
  { id: 'trim_thread', category: 'Trims & Measure', name: 'Uncut Long Threads', severity: 'Minor' },
  { id: 'trim_hangtag', category: 'Trims & Measure', name: 'Missing / Wrong Tag', severity: 'Minor' }
];

export const QCInspectionModal: React.FC<QCInspectionModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // Orders Store
  const [orders, setOrders] = useState<ProductionOrder[]>(() => supabaseDataService.getOrders());

  useEffect(() => {
    const update = () => setOrders(supabaseDataService.getOrders());
    update();
    const unsub = supabaseDataService.subscribe(update);
    return unsub;
  }, []);

  // Selection State
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedPo, setSelectedPo] = useState('');
  const [selectedColour, setSelectedColour] = useState('');
  const [selectedSize, setSelectedSize] = useState('All Sizes');

  // Inspection Metadata
  const [inspectionType, setInspectionType] = useState<string>('End Line QC');
  const [lineNo, setLineNo] = useState('Line No 1');
  const [shift, setShift] = useState('Day Shift (A)');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [inspectorName, setInspectorName] = useState(() => currentUser?.name || 'QC Inspector');
  const [aqlLevel, setAqlLevel] = useState('AQL 2.5');
  const [remarks, setRemarks] = useState('');
  const [autoCreateReturnChallan, setAutoCreateReturnChallan] = useState(false);

  // UI Modes & Toggles
  const [entryMode, setEntryMode] = useState<'simple' | 'matrix'>('simple');
  const [showDefectPicker, setShowDefectPicker] = useState(false);
  const [showAdvanceMeta, setShowAdvanceMeta] = useState(false);
  const [activeDefectTab, setActiveDefectTab] = useState<'Sewing' | 'Fabric' | 'Spot & Wash' | 'Trims & Measure'>('Sewing');

  // Search Typeahead
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Core Simple Quantities
  const [inspectedQtyInput, setInspectedQtyInput] = useState<number | ''>('');
  const [passedQtyInput, setPassedQtyInput] = useState<number | ''>('');
  const [reworkQtyInput, setReworkQtyInput] = useState<number | ''>('');
  const [rejectQtyInput, setRejectQtyInput] = useState<number | ''>('');
  const [defectCounts, setDefectCounts] = useState<Record<string, number>>({});

  // Batch Multi-Size Quantities
  const [batchSizeInputs, setBatchSizeInputs] = useState<Record<string, { inspected: number | ''; passed: number | ''; rework: number | ''; reject: number | '' }>>({});

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoized Search Items
  const allCombinations = useMemo(() => {
    return supabaseDataService.getAllOrderCombinations();
  }, [orders]);

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const query = searchQuery.toLowerCase().trim();
    return allCombinations.filter(c => c.searchText.includes(query)).slice(0, 6);
  }, [allCombinations, searchQuery]);

  // Cascades
  const buyersList = useMemo(() => supabaseDataService.getBuyers(false), [orders]);
  const purchaseOrdersList = useMemo(() => supabaseDataService.getBuyerPOs(selectedBuyer, false), [orders, selectedBuyer]);
  const stylesList = useMemo(() => {
    if (!selectedPo) return supabaseDataService.getStyles(selectedBuyer, false);
    return supabaseDataService.getPOStyles(selectedPo, selectedBuyer, false);
  }, [orders, selectedPo, selectedBuyer]);
  const coloursList = useMemo(() => {
    if (!selectedStyle || !selectedPo) return [];
    return supabaseDataService.getColours(selectedStyle, selectedPo, false);
  }, [selectedStyle, selectedPo, orders]);

  // Initial Data Sync
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);

    if (initialData?.styleNo) {
      setSelectedStyle(initialData.styleNo);
      const match = orders.find(o => o.styleNo === initialData.styleNo);
      if (match?.buyer) setSelectedBuyer(match.buyer);

      const pos = supabaseDataService.getPurchaseOrders(initialData.styleNo);
      const targetPo = initialData.poNo || (pos.length > 0 ? pos[0].poNo : '');
      setSelectedPo(targetPo);

      if (initialData.colour) {
        setSelectedColour(initialData.colour);
      } else if (targetPo) {
        const cols = supabaseDataService.getColours(initialData.styleNo, targetPo);
        if (cols.length > 0) setSelectedColour(cols[0].colour);
      }

      if (initialData.size) setSelectedSize(initialData.size);
      if (initialData.inspectionType) setInspectionType(initialData.inspectionType);
    } else if (!selectedStyle && orders.length > 0) {
      const first = orders[0];
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
  }, [isOpen, initialData, orders]);

  // Order Details
  const orderDetails = useMemo(() => {
    if (!selectedStyle || !selectedPo || !selectedColour) return null;
    return supabaseDataService.getMasterOrderDetails(selectedStyle, selectedPo, selectedColour, selectedSize);
  }, [selectedStyle, selectedPo, selectedColour, selectedSize]);

  // QC History Records
  const existingQCRecords = useMemo(() => {
    if (!selectedStyle || !selectedPo || !selectedColour) return [];
    return supabaseDataService.getQCInspections().filter(
      q => q.styleNo?.trim().toUpperCase() === selectedStyle.trim().toUpperCase() &&
           (!q.poNo || !selectedPo || q.poNo.trim().toUpperCase() === selectedPo.trim().toUpperCase()) &&
           (!q.colour || !selectedColour || q.colour.trim().toUpperCase() === selectedColour.trim().toUpperCase())
    );
  }, [selectedStyle, selectedPo, selectedColour]);

  const sizeBreakdownList = useMemo(() => {
    if (!orderDetails?.sizeBreakdown) return [];
    return orderDetails.sizeBreakdown;
  }, [orderDetails]);

  // Size metrics
  const sizeMetricsMap = useMemo(() => {
    const map = new Map<string, {
      realOrderQty: number;
      factoryOrderQty: number;
      receivedQty: number;
      inspectedQty: number;
      passedQty: number;
      reworkQty: number;
      rejectQty: number;
      remainingQty: number;
      pct: number;
    }>();

    for (const item of sizeBreakdownList) {
      const sz = item.size;
      const realOrder = item.realOrderQty ?? item.orderQty;
      const factoryOrder = item.factoryOrderQty && item.factoryOrderQty > 0 ? item.factoryOrderQty : (item.orderQty || realOrder);
      const sewingRecv = item.sewOutput > 0 ? item.sewOutput : (item.receivedQty ?? factoryOrder);
      const received = sewingRecv > 0 ? sewingRecv : factoryOrder;

      const qcRecords = existingQCRecords.filter(
        q => (q.size || 'All Sizes').trim().toUpperCase() === sz.trim().toUpperCase() ||
             (q.size === 'All Sizes' && sizeBreakdownList.length === 1)
      );

      const insp = qcRecords.reduce((s, q) => s + (q.inspectedQty || 0), 0);
      const pass = qcRecords.reduce((s, q) => s + (q.passedQty || 0), 0);
      const rew = qcRecords.reduce((s, q) => s + (q.reworkQty || 0), 0);
      const rej = qcRecords.reduce((s, q) => s + (q.rejectQty || 0), 0);
      const remaining = Math.max(0, received - insp);
      const pct = received > 0 ? Math.min(100, Math.round((insp / received) * 100)) : 0;

      map.set(sz, {
        realOrderQty: realOrder,
        factoryOrderQty: factoryOrder,
        receivedQty: received,
        inspectedQty: insp,
        passedQty: pass,
        reworkQty: rew,
        rejectQty: rej,
        remainingQty: remaining,
        pct
      });
    }

    return map;
  }, [sizeBreakdownList, existingQCRecords]);

  // Active Size Info
  const activeMetrics = useMemo(() => {
    if (selectedSize && selectedSize !== 'All Sizes' && sizeMetricsMap.has(selectedSize)) {
      return sizeMetricsMap.get(selectedSize)!;
    }
    let totalReal = 0;
    let totalFact = 0;
    let totalRecv = 0;
    let totalInsp = 0;
    let totalPass = 0;
    let totalRew = 0;
    let totalRej = 0;
    let totalRem = 0;

    sizeMetricsMap.forEach(m => {
      totalReal += m.realOrderQty;
      totalFact += m.factoryOrderQty;
      totalRecv += m.receivedQty;
      totalInsp += m.inspectedQty;
      totalPass += m.passedQty;
      totalRew += m.reworkQty;
      totalRej += m.rejectQty;
      totalRem += m.remainingQty;
    });

    const pct = totalRecv > 0 ? Math.min(100, Math.round((totalInsp / totalRecv) * 100)) : 0;

    return {
      realOrderQty: totalReal,
      factoryOrderQty: totalFact,
      receivedQty: totalRecv,
      inspectedQty: totalInsp,
      passedQty: totalPass,
      reworkQty: totalRew,
      rejectQty: totalRej,
      remainingQty: totalRem,
      pct
    };
  }, [sizeMetricsMap, selectedSize]);

  // Defect Counts
  const totalDefectsCount = useMemo(() => {
    return Object.values(defectCounts).reduce((sum: number, v) => sum + (Number(v) || 0), 0);
  }, [defectCounts]);

  const reworkDefectsCount = useMemo(() => {
    return DEFECT_CATALOG.filter(d => d.severity !== 'Critical').reduce((sum: number, d) => sum + (Number(defectCounts[d.id]) || 0), 0);
  }, [defectCounts]);

  const criticalDefectsCount = useMemo(() => {
    return DEFECT_CATALOG.filter(d => d.severity === 'Critical').reduce((sum: number, d) => sum + (Number(defectCounts[d.id]) || 0), 0);
  }, [defectCounts]);

  // Auto-sync defects with Rework & Reject inputs
  useEffect(() => {
    if (entryMode === 'simple') {
      if (reworkDefectsCount > 0 || criticalDefectsCount > 0) {
        setReworkQtyInput(reworkDefectsCount);
        setRejectQtyInput(criticalDefectsCount);

        const currentInsp = typeof inspectedQtyInput === 'number' ? inspectedQtyInput : 0;
        const defective = reworkDefectsCount + criticalDefectsCount;
        if (currentInsp >= defective) {
          setPassedQtyInput(currentInsp - defective);
        } else if (currentInsp === 0 && defective > 0) {
          setInspectedQtyInput(defective);
          setPassedQtyInput(0);
        }
      }
    }
  }, [reworkDefectsCount, criticalDefectsCount, entryMode]);

  // Live Metrics & Result
  const liveInspectionMetrics = useMemo(() => {
    const inspected = Number(inspectedQtyInput) || 0;
    const passed = Number(passedQtyInput) || 0;
    const rework = Number(reworkQtyInput) || 0;
    const reject = Number(rejectQtyInput) || 0;
    const totalDefects = totalDefectsCount > 0 ? totalDefectsCount : (rework + reject);

    const dhu = inspected > 0 ? Number(((totalDefects / inspected) * 100).toFixed(1)) : 0;
    const passRate = inspected > 0 ? Number(((passed / inspected) * 100).toFixed(1)) : (inspected > 0 ? 100 : 0);

    let result: 'Pass' | 'Fail' | 'Pending Rework' = 'Pass';
    if (reject > 0 || dhu > 5.0) {
      result = 'Fail';
    } else if (rework > 0 || dhu > 2.5) {
      result = 'Pending Rework';
    }

    return {
      inspected,
      passed,
      rework,
      reject,
      totalDefects,
      dhu,
      passRate,
      result
    };
  }, [inspectedQtyInput, passedQtyInput, reworkQtyInput, rejectQtyInput, totalDefectsCount]);

  // Preset Handlers
  const handleSetInspected = (qty: number) => {
    setInspectedQtyInput(qty);
    const defects = (Number(reworkQtyInput) || 0) + (Number(rejectQtyInput) || 0);
    setPassedQtyInput(Math.max(0, qty - defects));
  };

  const handleAddInspected = (add: number) => {
    const current = Number(inspectedQtyInput) || 0;
    handleSetInspected(current + add);
  };

  const handleAllPassed = () => {
    const rem = activeMetrics.remainingQty > 0 ? activeMetrics.remainingQty : 100;
    setInspectedQtyInput(rem);
    setPassedQtyInput(rem);
    setReworkQtyInput(0);
    setRejectQtyInput(0);
    setDefectCounts({});
  };

  const handleClearAll = () => {
    setInspectedQtyInput('');
    setPassedQtyInput('');
    setReworkQtyInput('');
    setRejectQtyInput('');
    setDefectCounts({});
    setBatchSizeInputs({});
    setRemarks('');
  };

  const handleIncrementDefect = (id: string, amount: number) => {
    setDefectCounts(prev => {
      const curr = prev[id] || 0;
      const next = Math.max(0, curr + amount);
      const updated = { ...prev };
      if (next === 0) delete updated[id];
      else updated[id] = next;
      return updated;
    });
  };

  const handleSelectSearchResult = (res: any) => {
    setSelectedBuyer(res.buyer || '');
    setSelectedStyle(res.styleNo);
    setSelectedPo(res.poNo);
    setSelectedColour(res.colour);
    if (res.sizes && res.sizes.length > 0) setSelectedSize(res.sizes[0]);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedStyle || !selectedPo || !selectedColour) {
      setErrorMessage('Please select Style, PO Number, and Colour.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (entryMode === 'simple') {
        const insp = Number(inspectedQtyInput) || 0;
        const pass = typeof passedQtyInput === 'number' ? passedQtyInput : Math.max(0, insp - ((Number(reworkQtyInput) || 0) + (Number(rejectQtyInput) || 0)));
        const rew = Number(reworkQtyInput) || 0;
        const rej = Number(rejectQtyInput) || 0;

        if (insp <= 0) {
          setErrorMessage('Please enter Inspected Quantity greater than 0.');
          setIsSubmitting(false);
          return;
        }

        if (pass + rew + rej > insp) {
          setErrorMessage(`Sum of Passed (${pass}), Rework (${rew}), and Reject (${rej}) cannot exceed Inspected (${insp}).`);
          setIsSubmitting(false);
          return;
        }

        // Defect items
        const defectItems: QCDefectItem[] = [];
        Object.entries(defectCounts).forEach(([defId, qty]) => {
          const count = Number(qty) || 0;
          if (count > 0) {
            const defObj = DEFECT_CATALOG.find(d => d.id === defId);
            if (defObj) {
              defectItems.push({
                defectCategory: `${defObj.name} (${defObj.category})`,
                defectQty: count,
                defectType: defObj.severity
              });
            }
          }
        });

        if (defectItems.length === 0 && (rew > 0 || rej > 0)) {
          defectItems.push({
            defectCategory: 'General Stitch / Quality Defect',
            defectQty: rew + rej,
            defectType: rej > 0 ? 'Critical' : 'Major'
          });
        }

        const qcRecord: QCInspection = {
          id: `qc-${selectedStyle}-${selectedPo}-${selectedColour}-${selectedSize || 'All'}-${Date.now()}`,
          date: entryDate,
          buyer: selectedBuyer,
          styleNo: selectedStyle,
          poNo: selectedPo,
          colour: selectedColour,
          size: selectedSize || 'All Sizes',
          lineNo,
          shift,
          inspectionType,
          inspectedQty: insp,
          passedQty: pass,
          reworkQty: rew,
          rejectQty: rej,
          dhu: liveInspectionMetrics.dhu,
          defects: defectItems,
          inspectorName: inspectorName || currentUser?.name || 'QC Inspector',
          result: liveInspectionMetrics.result,
          aqlLevel,
          remarks: remarks ? `${remarks}${autoCreateReturnChallan ? ' [Auto Rework Challan]' : ''}` : undefined
        };

        const saveRes = await supabaseDataService.saveQCInspection(qcRecord, currentUser?.name);
        if (!saveRes.success) {
          setErrorMessage(saveRes.error || 'Failed to save QC inspection.');
          setIsSubmitting(false);
          return;
        }

        // Auto return challan if requested
        if (autoCreateReturnChallan && rew > 0) {
          try {
            const transferRecord: InterDeptTransfer = {
              id: `trans-rework-${Date.now()}`,
              challanNo: `QC-REW-${Date.now().toString().slice(-6)}`,
              transferDate: entryDate,
              transferType: 'Return',
              returnReason: `QC Rework Return from ${inspectionType} (${lineNo})`,
              fromDepartment: 'Finishing',
              toDepartment: 'Sewing',
              buyer: selectedBuyer || 'Default Buyer',
              styleNo: selectedStyle,
              poNo: selectedPo,
              colour: selectedColour,
              size: selectedSize || 'All Sizes',
              garmentType: 'Garment',
              isWashGarment: false,
              quantity: rew,
              senderName: inspectorName || currentUser?.name || 'QC Inspector',
              authorizedBy: inspectorName || currentUser?.name || 'QC Inspector',
              status: 'Dispatched',
              remarks: `Defects logged: ${defectItems.map(d => d.defectCategory).join(', ')}`,
              createdAt: new Date().toISOString()
            };
            await supabaseDataService.saveTransfer(transferRecord, currentUser?.name);
          } catch (tErr) {
            console.warn('Auto return challan warning:', tErr);
          }
        }

        toast.success(`QC Inspection recorded: ${qcRecord.passedQty} pcs Passed (${qcRecord.result})`);
      } else {
        // Multi-size batch
        const recordsToSave: QCInspection[] = [];
        let totalBatchInsp = 0;

        for (const item of sizeBreakdownList) {
          const szInput = batchSizeInputs[item.size];
          if (!szInput) continue;
          const insp = Number(szInput.inspected) || 0;
          if (insp <= 0) continue;

          totalBatchInsp += insp;
          const pass = Number(szInput.passed) || (insp - ((Number(szInput.rework) || 0) + (Number(szInput.reject) || 0)));
          const rew = Number(szInput.rework) || 0;
          const rej = Number(szInput.reject) || 0;
          const dhu = insp > 0 ? Number((((rew + rej) / insp) * 100).toFixed(1)) : 0;
          const result = rej > 0 || dhu > 5.0 ? 'Fail' : rew > 0 || dhu > 2.5 ? 'Pending Rework' : 'Pass';

          recordsToSave.push({
            id: `qc-${selectedStyle}-${selectedPo}-${selectedColour}-${item.size}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            date: entryDate,
            buyer: selectedBuyer,
            styleNo: selectedStyle,
            poNo: selectedPo,
            colour: selectedColour,
            size: item.size,
            lineNo,
            shift,
            inspectionType,
            inspectedQty: insp,
            passedQty: pass,
            reworkQty: rew,
            rejectQty: rej,
            dhu,
            defects: [
              { defectCategory: 'Batch Inspection Faults', defectQty: rew + rej, defectType: rej > 0 ? 'Critical' : 'Major' }
            ],
            inspectorName: inspectorName || currentUser?.name || 'QC Inspector',
            result,
            aqlLevel,
            remarks: remarks || undefined
          });
        }

        if (recordsToSave.length === 0) {
          setErrorMessage('Please enter Inspected quantity for at least one size.');
          setIsSubmitting(false);
          return;
        }

        await supabaseDataService.saveQCInspectionsBatch(recordsToSave, currentUser?.name);
        toast.success(`Batch QC saved for ${recordsToSave.length} sizes (${totalBatchInsp.toLocaleString()} pcs total)!`);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Save QC Inspection Error:', err);
      setErrorMessage(err?.message || 'Failed to submit QC Inspection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      headerGradient={false}
      headerIcon={<ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
      title="QC Inspection Entry"
      subtitle="Easy garment quality check, defect counter & live pass rate"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl flex items-center gap-2 font-bold text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. COMPACT ORDER SELECTOR */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
          {/* Search bar & Typeahead */}
          <div className="relative">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search Buyer / Style / PO / Colour..."
                className="w-full bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 font-medium text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {searchResults.map(res => (
                  <div
                    key={res.key}
                    onClick={() => handleSelectSearchResult(res)}
                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-black text-slate-900 dark:text-slate-100">{res.styleNo}</span>
                      <span className="text-slate-400 mx-1">•</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">PO: {res.poNo}</span>
                      <span className="text-slate-400 mx-1">•</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">{res.colour}</span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 rounded">
                      Select
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4 Simple Dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400 mb-0.5">Buyer</label>
              <select
                value={selectedBuyer}
                onChange={e => {
                  const b = e.target.value;
                  setSelectedBuyer(b);
                  const pos = supabaseDataService.getBuyerPOs(b, false);
                  if (pos.length > 0) {
                    const firstPo = pos[0].poNo;
                    setSelectedPo(firstPo);
                    const styles = supabaseDataService.getPOStyles(firstPo, b, false);
                    if (styles.length > 0) {
                      const firstStyle = styles[0].styleNo;
                      setSelectedStyle(firstStyle);
                      const cols = supabaseDataService.getColours(firstStyle, firstPo, false);
                      if (cols.length > 0) setSelectedColour(cols[0].colour);
                    }
                  }
                }}
                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Buyers</option>
                {buyersList.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400 mb-0.5">PO No *</label>
              <select
                value={selectedPo}
                onChange={e => {
                  const p = e.target.value;
                  setSelectedPo(p);
                  const styles = supabaseDataService.getPOStyles(p, selectedBuyer, false);
                  if (styles.length > 0) {
                    const firstStyle = styles[0].styleNo;
                    setSelectedStyle(firstStyle);
                    const cols = supabaseDataService.getColours(firstStyle, p, false);
                    if (cols.length > 0) setSelectedColour(cols[0].colour);
                  }
                }}
                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select PO</option>
                {purchaseOrdersList.map(p => <option key={p.poNo} value={p.poNo}>{p.poNo}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400 mb-0.5">Style *</label>
              <select
                value={selectedStyle}
                onChange={e => {
                  const s = e.target.value;
                  setSelectedStyle(s);
                  const order = orders.find(o => o.styleNo === s);
                  if (order?.buyer && !selectedBuyer) setSelectedBuyer(order.buyer);
                  const cols = supabaseDataService.getColours(s, selectedPo, false);
                  if (cols.length > 0) setSelectedColour(cols[0].colour);
                }}
                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select Style</option>
                {stylesList.map(s => (
                  <option key={s.id || s.styleNo} value={s.styleNo}>
                    {s.styleNo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400 mb-0.5">Colour *</label>
              <select
                value={selectedColour}
                onChange={e => setSelectedColour(e.target.value)}
                className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-bold focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select Colour</option>
                {coloursList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 2. SIZE SELECTOR & QUICK SUMMARY */}
        <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">Size:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedSize('All Sizes');
                  if (entryMode === 'simple') {
                    setInspectedQtyInput('');
                    setPassedQtyInput('');
                    setReworkQtyInput('');
                    setRejectQtyInput('');
                    setDefectCounts({});
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  selectedSize === 'All Sizes'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>All Sizes</span>
                <span className="text-[10px] opacity-80">({activeMetrics.remainingQty} rem)</span>
              </button>

              {sizeBreakdownList.map(item => {
                const m = sizeMetricsMap.get(item.size);
                const isSelected = selectedSize === item.size;
                const rem = m?.remainingQty ?? 0;
                return (
                  <button
                    key={item.size}
                    type="button"
                    onClick={() => {
                      setSelectedSize(item.size);
                      if (entryMode === 'simple') {
                        setInspectedQtyInput('');
                        setPassedQtyInput('');
                        setReworkQtyInput('');
                        setRejectQtyInput('');
                        setDefectCounts({});
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{item.size}</span>
                    <span className={`text-[10px] px-1 rounded ${
                      isSelected ? 'bg-blue-800 text-white' : rem === 0 ? 'text-emerald-600' : 'text-amber-600 font-black'
                    }`}>
                      {rem}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Mode switch */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setEntryMode('simple')}
                className={`px-2.5 py-0.5 rounded-md transition ${entryMode === 'simple' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-2xs' : 'text-slate-500'}`}
              >
                Simple Entry
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('matrix')}
                className={`px-2.5 py-0.5 rounded-md transition ${entryMode === 'matrix' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-2xs' : 'text-slate-500'}`}
              >
                Multi-Size Table
              </button>
            </div>
          </div>
        </div>

        {/* 3. SIMPLE INSPECTION FORM */}
        {entryMode === 'simple' ? (
          <div className="space-y-3">
            {/* Quick Fill Preset Buttons */}
            <div className="flex items-center justify-between flex-wrap gap-1.5 px-1 text-xs">
              <span className="text-[11px] font-bold text-slate-500">Quick Fill:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeMetrics.remainingQty > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSetInspected(activeMetrics.remainingQty)}
                    className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg font-bold hover:bg-blue-100 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    <span>Fill Remaining ({activeMetrics.remainingQty} pcs)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAddInspected(10)}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-200 cursor-pointer"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => handleAddInspected(50)}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-200 cursor-pointer"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => handleAddInspected(100)}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-200 cursor-pointer"
                >
                  +100
                </button>
                <button
                  type="button"
                  onClick={handleAllPassed}
                  className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg font-bold hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>100% Passed</span>
                </button>
              </div>
            </div>

            {/* 4 Clean Large Input Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* 1. Inspected */}
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/80 rounded-xl space-y-1">
                <label className="block text-[11px] font-black uppercase text-blue-900 dark:text-blue-300">
                  1. Inspected Qty *
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={inspectedQtyInput}
                  onChange={e => {
                    const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                    setInspectedQtyInput(val);
                    if (typeof val === 'number') {
                      const defects = (Number(reworkQtyInput) || 0) + (Number(rejectQtyInput) || 0);
                      setPassedQtyInput(Math.max(0, val - defects));
                    }
                  }}
                  className="w-full text-lg font-black px-2.5 py-1 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg text-blue-950 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="text-[10px] text-slate-500 block">Total checked</span>
              </div>

              {/* 2. Passed */}
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/80 rounded-xl space-y-1">
                <label className="block text-[11px] font-black uppercase text-emerald-900 dark:text-emerald-300">
                  2. Passed (Good)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={passedQtyInput}
                  onChange={e => setPassedQtyInput(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                  className="w-full text-lg font-black px-2.5 py-1 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 block">A-Grade garment</span>
              </div>

              {/* 3. Rework */}
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/80 rounded-xl space-y-1">
                <label className="block text-[11px] font-black uppercase text-amber-900 dark:text-amber-300">
                  3. Rework / Alter
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={reworkQtyInput}
                  onChange={e => {
                    const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                    setReworkQtyInput(val);
                    const currentInsp = typeof inspectedQtyInput === 'number' ? inspectedQtyInput : 0;
                    const rej = Number(rejectQtyInput) || 0;
                    if (currentInsp > 0) {
                      setPassedQtyInput(Math.max(0, currentInsp - (Number(val) + rej)));
                    }
                  }}
                  className="w-full text-lg font-black px-2.5 py-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-amber-700 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-slate-500 block">Can be repaired</span>
              </div>

              {/* 4. Reject */}
              <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/80 rounded-xl space-y-1">
                <label className="block text-[11px] font-black uppercase text-rose-900 dark:text-rose-300">
                  4. Reject (Scrap)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={rejectQtyInput}
                  onChange={e => {
                    const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                    setRejectQtyInput(val);
                    const currentInsp = typeof inspectedQtyInput === 'number' ? inspectedQtyInput : 0;
                    const rew = Number(reworkQtyInput) || 0;
                    if (currentInsp > 0) {
                      setPassedQtyInput(Math.max(0, currentInsp - (rew + Number(val))));
                    }
                  }}
                  className="w-full text-lg font-black px-2.5 py-1 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-lg text-rose-700 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500"
                />
                <span className="text-[10px] text-slate-500 block">Unusable fault</span>
              </div>
            </div>

            {/* Live Result Strip */}
            <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-xl p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Defects: </span>
                  <strong className="text-amber-300 font-black">{liveInspectionMetrics.totalDefects} pcs</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Pass Rate: </span>
                  <strong className="text-emerald-400 font-black">{liveInspectionMetrics.passRate}%</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">DHU Rate: </span>
                  <strong className={`font-black ${liveInspectionMetrics.dhu <= 2.5 ? 'text-emerald-400' : liveInspectionMetrics.dhu <= 5.0 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {liveInspectionMetrics.dhu}%
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Result:</span>
                <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase flex items-center gap-1 ${
                  liveInspectionMetrics.result === 'Pass'
                    ? 'bg-emerald-500 text-white'
                    : liveInspectionMetrics.result === 'Pending Rework'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-rose-600 text-white'
                }`}>
                  {liveInspectionMetrics.result === 'Pass' ? <CheckCircle2 className="w-3.5 h-3.5" /> : liveInspectionMetrics.result === 'Pending Rework' ? <AlertTriangle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>{liveInspectionMetrics.result}</span>
                </span>
              </div>
            </div>

            {/* Collapsible Defect Tagging Section */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setShowDefectPicker(!showDefectPicker)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span>Defect Categorization & Tags {totalDefectsCount > 0 && `(${totalDefectsCount} logged)`}</span>
                </div>
                <div className="flex items-center gap-2">
                  {totalDefectsCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] rounded-full font-black">
                      {totalDefectsCount} defects
                    </span>
                  )}
                  {showDefectPicker ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {showDefectPicker && (
                <div className="p-3 space-y-2.5 border-t border-slate-200 dark:border-slate-800">
                  {/* Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {(['Sewing', 'Fabric', 'Spot & Wash', 'Trims & Measure'] as const).map(cat => {
                      const catCount = DEFECT_CATALOG.filter(d => d.category === cat).reduce((s: number, d) => s + (Number(defectCounts[d.id]) || 0), 0);
                      const isActive = activeDefectTab === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setActiveDefectTab(cat)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          <span>{cat}</span>
                          {catCount > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                              isActive ? 'bg-white text-blue-700' : 'bg-rose-500 text-white'
                            }`}>
                              {catCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Defect Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {DEFECT_CATALOG.filter(d => d.category === activeDefectTab).map(def => {
                      const count = defectCounts[def.id] || 0;
                      return (
                        <div
                          key={def.id}
                          className={`p-2 rounded-lg border transition flex flex-col justify-between ${
                            count > 0
                              ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-400'
                              : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`text-[9px] font-black px-1 rounded ${
                                def.severity === 'Critical'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : def.severity === 'Major'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              }`}>
                                {def.severity}
                              </span>
                              {count > 0 && (
                                <span className="text-[11px] font-black text-amber-700 dark:text-amber-400">
                                  {count} pcs
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
                              {def.name}
                            </p>
                          </div>

                          {/* Easy Counter Buttons */}
                          <div className="flex items-center justify-between gap-1 mt-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleIncrementDefect(def.id, -1)}
                                disabled={count <= 0}
                                className="w-6 h-6 flex items-center justify-center rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleIncrementDefect(def.id, 1)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 font-bold cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleIncrementDefect(def.id, 5)}
                              className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
                            >
                              +5
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Mode B: Multi-Size Batch Table */
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">
                Multi-Size Inspection Grid
              </span>
              <button
                type="button"
                onClick={() => {
                  const updated: typeof batchSizeInputs = {};
                  sizeBreakdownList.forEach(s => {
                    const m = sizeMetricsMap.get(s.size);
                    const rem = m?.remainingQty ?? 0;
                    if (rem > 0) {
                      updated[s.size] = {
                        inspected: rem,
                        passed: rem,
                        rework: '',
                        reject: ''
                      };
                    }
                  });
                  setBatchSizeInputs(updated);
                }}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 cursor-pointer"
              >
                Inspect All Due Quantities
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-750">
              <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-black text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-2">Size</th>
                    <th className="p-2 text-right">Target</th>
                    <th className="p-2 text-right text-amber-600">Remaining</th>
                    <th className="p-2 text-right text-blue-600 w-24">Inspected *</th>
                    <th className="p-2 text-right text-emerald-600 w-24">Passed</th>
                    <th className="p-2 text-right text-amber-600 w-24">Rework</th>
                    <th className="p-2 text-right text-rose-600 w-24">Reject</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sizeBreakdownList.map(item => {
                    const m = sizeMetricsMap.get(item.size);
                    const szInput = batchSizeInputs[item.size] || { inspected: '', passed: '', rework: '', reject: '' };
                    return (
                      <tr key={item.size} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2 font-black text-slate-900 dark:text-white">Size {item.size}</td>
                        <td className="p-2 text-right text-slate-500">{m?.factoryOrderQty}</td>
                        <td className="p-2 text-right font-black text-amber-600">{m?.remainingQty}</td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={szInput.inspected}
                            onChange={e => {
                              const v = e.target.value === '' ? '' : Number(e.target.value);
                              setBatchSizeInputs(prev => ({
                                ...prev,
                                [item.size]: {
                                  ...szInput,
                                  inspected: v,
                                  passed: typeof v === 'number' ? Math.max(0, v - ((Number(szInput.rework) || 0) + (Number(szInput.reject) || 0))) : ''
                                }
                              }));
                            }}
                            className="w-full px-2 py-1 border border-blue-300 rounded font-black text-right text-blue-900 bg-blue-50/40"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={szInput.passed}
                            onChange={e => {
                              const v = e.target.value === '' ? '' : Number(e.target.value);
                              setBatchSizeInputs(prev => ({
                                ...prev,
                                [item.size]: { ...szInput, passed: v }
                              }));
                            }}
                            className="w-full px-2 py-1 border border-emerald-300 rounded font-black text-right text-emerald-700 bg-emerald-50/40"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={szInput.rework}
                            onChange={e => {
                              const v = e.target.value === '' ? '' : Number(e.target.value);
                              setBatchSizeInputs(prev => ({
                                ...prev,
                                [item.size]: { ...szInput, rework: v }
                              }));
                            }}
                            className="w-full px-2 py-1 border border-amber-300 rounded font-black text-right text-amber-700 bg-amber-50/40"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={szInput.reject}
                            onChange={e => {
                              const v = e.target.value === '' ? '' : Number(e.target.value);
                              setBatchSizeInputs(prev => ({
                                ...prev,
                                [item.size]: { ...szInput, reject: v }
                              }));
                            }}
                            className="w-full px-2 py-1 border border-rose-300 rounded font-black text-right text-rose-700 bg-rose-50/40"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. DETAILS ROW (Collapsible or Quick Row) */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">QC Type *</label>
              <select
                value={inspectionType}
                onChange={e => setInspectionType(e.target.value)}
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold"
              >
                <option value="Inline QC">Inline QC</option>
                <option value="End Line QC">End Line QC</option>
                <option value="Final QC">Final QC</option>
                <option value="AQL Inspection">AQL Inspection</option>
                <option value="100% Inspection">100% Inspection</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Sewing Line *</label>
              <select
                value={lineNo}
                onChange={e => setLineNo(e.target.value)}
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold"
              >
                <option value="Line No 1">Line No 1</option>
                <option value="Line No 2">Line No 2</option>
                <option value="Line No 3">Line No 3</option>
                <option value="Line No 4">Line No 4</option>
                <option value="Line No 5">Line No 5</option>
                <option value="Finishing Table">Finishing Table</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={e => setEntryDate(e.target.value)}
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Inspector</label>
              <input
                type="text"
                value={inspectorName}
                onChange={e => setInspectorName(e.target.value)}
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold"
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoReturnCheckbox"
                checked={autoCreateReturnChallan}
                onChange={e => setAutoCreateReturnChallan(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="autoReturnCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Auto-create Rework Challan to Sewing line
              </label>
            </div>

            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Optional remarks..."
              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none w-64"
            />
          </div>
        </div>

        {/* 5. FOOTER ACTIONS */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSubmitting 
                  ? 'Saving...' 
                  : entryMode === 'simple' && inspectedQtyInput 
                  ? `Save Inspection (${inspectedQtyInput} pcs)` 
                  : 'Save QC Inspection'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </ModalPortal>
  );
};
