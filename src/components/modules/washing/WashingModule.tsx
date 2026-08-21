import React, { useState, useEffect, useMemo } from 'react';
import {
  Waves,
  Plus,
  Edit2,
  Trash2,
  Info,
  AlertCircle,
  Send,
  Sparkles,
  RotateCcw,
  ArrowRightLeft,
  Truck,
  CheckCircle2,
  Clock,
  Printer,
  Building2,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  Check,
  X,
  FileText
} from 'lucide-react';
import { supabaseDataService, generateUUID } from '../../../services/supabaseDataService';
import { WashingRecord, WashingSizeItem, InterDeptTransfer, OrderStyle, TransferChallanItem } from '../../../types';
import { PageHeader } from '../../common/PageHeader';
import { DataTable, Column } from '../../common/DataTable';
import { StatusBadge } from '../../common/StatusBadge';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { useAuth } from '../../../context/AuthContext';
import { useERP } from '../../../context/ERPContext';
import { PermissionGuard } from '../../common/PermissionGuard';
import { DepartmentTransferQueue } from '../../common/DepartmentTransferQueue';
import { TransferChallanModal } from '../../common/TransferChallanModal';
import { printThirdPartyWashChallanPDF, printThirdPartyWashReturnChallanPDF, printTransferChallanPDF } from '../../../utils/printUtils';
import {
  getDepartmentTransferAvailability,
  getWashingToFinishingSizeBreakdown,
  WashingToFinishingSizeItem,
  cleanStyleName,
  matchesColour,
  matchesPo,
  matchesStyle
} from '../../../utils/transferValidationUtils';

const PRESET_WASH_VENDORS = [
  { name: 'Apex Wash Plant Ltd.', address: 'Kachpur, Narayanganj, Dhaka' },
  { name: 'Ananta Wet Processing Plant', address: 'EPZ Road, Ashulia, Savar' },
  { name: 'Tusuka Wet Processing Ltd.', address: 'Konabari, Gazipur' },
  { name: 'Impress Wash & Dyeing Ltd.', address: 'Gorai, Mirzapur, Tangail' },
  { name: 'Standard Group Washing Unit', address: 'Kalampur, Dhamrai, Dhaka' },
  { name: 'Dada Washing & Garments', address: 'Baipal, Savar, Dhaka' }
];

export const WashingModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { activeModule } = useERP();
  const [washing, setWashing] = useState<WashingRecord[]>(supabaseDataService.getWashingRecords());
  const [transfers, setTransfers] = useState<InterDeptTransfer[]>(supabaseDataService.getTransfers());
  const [orders, setOrders] = useState<OrderStyle[]>(supabaseDataService.getOrders());

  const [activeTab, setActiveTab] = useState<'sewing_inbound' | 'plant_outward' | 'to_finishing' | 'style_summary' | 'transfer_queue'>('sewing_inbound');

  useEffect(() => {
    if (activeModule === 'washing_inbound' || activeModule === 'washing' || activeModule === 'washing_receive') {
      setActiveTab('sewing_inbound');
    } else if (activeModule === 'washing_plant_outward' || activeModule === 'washing_log') {
      setActiveTab('plant_outward');
    } else if (activeModule === 'washing_to_finishing' || activeModule === 'washing_handover') {
      setActiveTab('to_finishing');
    } else if (activeModule === 'washing_summary') {
      setActiveTab('style_summary');
    } else if (activeModule === 'washing_transfers') {
      setActiveTab('transfer_queue');
    }
  }, [activeModule]);

  useEffect(() => {
    const update = () => {
      setWashing([...supabaseDataService.getWashingRecords()]);
      setTransfers([...supabaseDataService.getTransfers()]);
      setOrders([...supabaseDataService.getOrders()]);
    };
    update();
    const unsub = supabaseDataService.subscribe(update);
    return unsub;
  }, []);

  // Filter transfers from Sewing to Washing (Inbound queue)
  const sewingInboundTransfers = useMemo(() => {
    return transfers.filter(t => t.toDepartment === 'Washing' && t.fromDepartment === 'Sewing');
  }, [transfers]);

  const pendingSewingInbound = useMemo(() => {
    return sewingInboundTransfers.filter(t => t.status === 'Dispatched');
  }, [sewingInboundTransfers]);

  // Transfers from Washing to Finishing
  const washingToFinishingTransfers = useMemo(() => {
    return transfers.filter(t => t.fromDepartment === 'Washing' && t.toDepartment === 'Finishing');
  }, [transfers]);

  // Summary by style
  const styleWiseSummary = useMemo(() => {
    const map = new Map<string, {
      styleNo: string;
      poNo: string;
      colour: string;
      sewingReceivedQty: number;
      plantSentQty: number;
      plantReceivedQty: number;
      damageQty: number;
      plantBalanceQty: number;
      dispatchedToFinishingQty: number;
      washFloorWip: number;
    }>();

    // From incoming sewing transfers
    sewingInboundTransfers.forEach(t => {
      const key = `${t.styleNo}_${t.poNo}_${t.colour}`;
      const existing = map.get(key) || {
        styleNo: t.styleNo,
        poNo: t.poNo,
        colour: t.colour,
        sewingReceivedQty: 0,
        plantSentQty: 0,
        plantReceivedQty: 0,
        damageQty: 0,
        plantBalanceQty: 0,
        dispatchedToFinishingQty: 0,
        washFloorWip: 0
      };
      if (t.status === 'Received') {
        existing.sewingReceivedQty += t.quantity || 0;
      }
      map.set(key, existing);
    });

    // From third-party washing plant records
    washing.forEach(w => {
      const key = `${w.styleNo}_${w.poNo}_${w.colour}`;
      const existing = map.get(key) || {
        styleNo: w.styleNo,
        poNo: w.poNo,
        colour: w.colour,
        sewingReceivedQty: 0,
        plantSentQty: 0,
        plantReceivedQty: 0,
        damageQty: 0,
        plantBalanceQty: 0,
        dispatchedToFinishingQty: 0,
        washFloorWip: 0
      };
      existing.plantSentQty += w.sentQty || 0;
      existing.plantReceivedQty += w.receivedQty || 0;
      existing.damageQty += (w.damageQty || 0) + (w.rejectQty || 0);
      existing.plantBalanceQty = Math.max(0, existing.plantSentQty - existing.plantReceivedQty - existing.damageQty);
      map.set(key, existing);
    });

    // From finishing transfers
    washingToFinishingTransfers.forEach(t => {
      const key = `${t.styleNo}_${t.poNo}_${t.colour}`;
      const existing = map.get(key);
      if (existing) {
        existing.dispatchedToFinishingQty += t.quantity || 0;
      }
    });

    // Calculate current Wash section Floor WIP
    map.forEach(item => {
      item.washFloorWip = Math.max(0, item.plantReceivedQty - item.dispatchedToFinishingQty);
    });

    return Array.from(map.values());
  }, [sewingInboundTransfers, washing, washingToFinishingTransfers]);

  // Modal States
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedSewingTransfer, setSelectedSewingTransfer] = useState<InterDeptTransfer | null>(null);

  const [isInwardModalOpen, setIsInwardModalOpen] = useState(false);
  const [selectedWashRecordForReturn, setSelectedWashRecordForReturn] = useState<WashingRecord | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferModalType, setTransferModalType] = useState<'Transfer' | 'Return'>('Transfer');
  const [transferDefaultToDept, setTransferDefaultToDept] = useState<'Sewing' | 'Finishing'>('Finishing');
  const [transferTargetItem, setTransferTargetItem] = useState<{
    styleNo: string;
    poNo: string;
    colour: string;
    size: string;
    qty: number;
    sizeItems?: Array<{ size: string; quantity: number }>;
    items?: TransferChallanItem[];
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<WashingRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Finishing Transfer Eligibility Matrix Filter States
  const [finishingFilterStyle, setFinishingFilterStyle] = useState<string>('ALL');
  const [finishingFilterPo, setFinishingFilterPo] = useState<string>('ALL');
  const [finishingFilterColour, setFinishingFilterColour] = useState<string>('ALL');
  const [finishingSearch, setFinishingSearch] = useState<string>('');

  // Collect distinct style/PO/colour combinations relevant to Washing
  const washingEligibleCombos = useMemo(() => {
    const combosMap = new Map<string, { buyer: string; styleNo: string; poNo: string; colour: string }>();
    
    // From all orders
    orders.forEach(o => {
      const isWash = o.isWashGarment || supabaseDataService.isStyleWashGarment(o.styleNo);
      if (isWash) {
        o.purchaseOrders?.forEach(po => {
          po.colours?.forEach(c => {
            const key = `${o.styleNo}__${po.poNo}__${c.colour}`;
            combosMap.set(key, { buyer: o.buyer, styleNo: o.styleNo, poNo: po.poNo, colour: c.colour });
          });
        });
      }
    });

    // Also from received sewing transfers
    sewingInboundTransfers.forEach(t => {
      const key = `${t.styleNo}__${t.poNo}__${t.colour}`;
      if (!combosMap.has(key)) {
        combosMap.set(key, { buyer: t.buyer || 'Buyer', styleNo: t.styleNo, poNo: t.poNo, colour: t.colour });
      }
    });

    // Also from washing plant records
    washing.forEach(w => {
      const key = `${w.styleNo}__${w.poNo}__${w.colour}`;
      if (!combosMap.has(key)) {
        combosMap.set(key, { buyer: w.buyer || 'Buyer', styleNo: w.styleNo, poNo: w.poNo, colour: w.colour });
      }
    });

    return Array.from(combosMap.values());
  }, [orders, sewingInboundTransfers, washing]);

  // Compute size-wise items for all or filtered combos
  const finishingSizeBreakdownList = useMemo(() => {
    const result: WashingToFinishingSizeItem[] = [];
    
    const filteredCombos = washingEligibleCombos.filter(combo => {
      if (finishingFilterStyle !== 'ALL' && !matchesStyle(combo.styleNo, finishingFilterStyle)) return false;
      if (finishingFilterPo !== 'ALL' && !matchesPo(combo.poNo, finishingFilterPo)) return false;
      if (finishingFilterColour !== 'ALL' && !matchesColour(combo.colour, finishingFilterColour)) return false;
      if (finishingSearch) {
        const q = finishingSearch.toLowerCase();
        return (
          combo.styleNo.toLowerCase().includes(q) ||
          combo.poNo.toLowerCase().includes(q) ||
          combo.colour.toLowerCase().includes(q) ||
          combo.buyer.toLowerCase().includes(q)
        );
      }
      return true;
    });

    filteredCombos.forEach(combo => {
      const items = getWashingToFinishingSizeBreakdown(combo.styleNo, combo.poNo, combo.colour);
      result.push(...items);
    });

    return result;
  }, [washingEligibleCombos, finishingFilterStyle, finishingFilterPo, finishingFilterColour, finishingSearch, washing, transfers]);

  // Size & Colour items breakdown state for Outward Dispatch and Inward Return
  const [dispatchSizeItems, setDispatchSizeItems] = useState<Array<{
    size: string;
    colour?: string;
    poNo?: string;
    buyer?: string;
    sentQty: number;
    inboundQty?: number;
  }>>([]);
  const [returnSizeItems, setReturnSizeItems] = useState<Array<{
    size: string;
    colour?: string;
    poNo?: string;
    buyer?: string;
    sentQty: number;
    prevReceived: number;
    prevDamage: number;
    prevReject: number;
    pendingAtPlant: number;
    goodReceivedQty: number;
    damageQty: number;
    rejectQty: number;
  }>>([]);

  // Outward Plant Dispatch Form State
  const [dispatchVendor, setDispatchVendor] = useState(PRESET_WASH_VENDORS[0].name);
  const [dispatchVendorAddress, setDispatchVendorAddress] = useState(PRESET_WASH_VENDORS[0].address);
  const [dispatchCustomVendor, setDispatchCustomVendor] = useState('');
  const [dispatchWashType, setDispatchWashType] = useState<any>('Enzyme');
  const [dispatchChallanNo, setDispatchChallanNo] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().substring(0, 10));
  const [dispatchVehicleNo, setDispatchVehicleNo] = useState('DHAKA METRO-TA-14-9921');
  const [dispatchDriverName, setDispatchDriverName] = useState('Md. Rafiqul Islam');
  const [dispatchDriverPhone, setDispatchDriverPhone] = useState('+880 1712-345678');
  const [dispatchExpectedReturnDate, setDispatchExpectedReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().substring(0, 10);
  });
  const [dispatchQty, setDispatchQty] = useState<number>(0);
  const [dispatchStyleNo, setDispatchStyleNo] = useState('');
  const [dispatchPoNo, setDispatchPoNo] = useState('');
  const [dispatchColour, setDispatchColour] = useState('');
  const [dispatchSize, setDispatchSize] = useState('All Sizes');
  const [dispatchBuyer, setDispatchBuyer] = useState('');
  const [dispatchProcessInstructions, setDispatchProcessInstructions] = useState('Enzyme wash cycle 35 mins. Maintain approved wash shade swatch, avoid puckering.');
  const [dispatchRemarks, setDispatchRemarks] = useState('');
  const [dispatchAuthorizedBy, setDispatchAuthorizedBy] = useState('Md Myeedul Islam (GM)');

  // Inward Return Form State
  const [returnDate, setReturnDate] = useState(new Date().toISOString().substring(0, 10));
  const [goodReceivedQty, setGoodReceivedQty] = useState<number>(0);
  const [damageQty, setDamageQty] = useState<number>(0);
  const [rejectQty, setRejectQty] = useState<number>(0);
  const [returnVehicleNo, setReturnVehicleNo] = useState('');
  const [receiverName, setReceiverName] = useState(currentUser?.name || 'Md. Shahinur Alam (Wash Incharge)');
  const [qcWashGrade, setQcWashGrade] = useState<'Pass (Grade A)' | 'Minor Shading (Pass)' | 'Rework Needed' | 'Rejected'>('Pass (Grade A)');
  const [returnRemarks, setReturnRemarks] = useState('');

  // Helper to extract sizes from string or order
  const extractSizeList = (sizeStr?: string): string[] => {
    if (!sizeStr || sizeStr === 'All Sizes' || sizeStr === 'All') return [];
    return sizeStr
      .split(/[,/|+]+/)
      .map(s => s.trim())
      .filter(Boolean);
  };

  const resolveTransferSizeBreakdown = (
    transfer: InterDeptTransfer,
    ordersList: OrderStyle[],
    targetColourFilter?: string
  ): Array<{ size: string; sentQty: number; inboundQty?: number; colour?: string; poNo?: string; buyer?: string }> => {
    // 1. Check if transfer has explicit items with size, quantity, and colour
    let rawItems = transfer.items;
    if ((!rawItems || rawItems.length === 0) && transfer.remarks && typeof transfer.remarks === 'string' && transfer.remarks.includes('__ITEMS_JSON__:')) {
      try {
        const jsonStr = transfer.remarks.split('__ITEMS_JSON__:')[1]?.trim();
        if (jsonStr) {
          rawItems = JSON.parse(jsonStr);
        }
      } catch (err) {
        console.warn('Could not parse items JSON from transfer remarks', err);
      }
    }

    if (rawItems && Array.isArray(rawItems) && rawItems.length > 0) {
      const colToFilter = (targetColourFilter || transfer.colour || '').trim();
      const isMultiColour = !colToFilter || colToFilter.toLowerCase() === 'all colours';

      const matchingItems = isMultiColour
        ? rawItems
        : rawItems.filter(it => !it.colour || matchesColour(it.colour, colToFilter));

      const itemsToUse = matchingItems.length > 0 ? matchingItems : rawItems.filter(it => !it.colour || matchesColour(it.colour, colToFilter));

      // Group and preserve distinct (colour, size) pairs
      const map = new Map<string, { size: string; colour: string; poNo?: string; buyer?: string; qty: number }>();
      itemsToUse.forEach(it => {
        const sz = (it.size || 'All Sizes').trim();
        const col = (it.colour || transfer.colour || 'Standard').trim();
        const k = `${col}___${sz}`;
        const existing = map.get(k);
        if (existing) {
          existing.qty += (Number(it.quantity) || 0);
        } else {
          map.set(k, {
            size: sz,
            colour: col,
            poNo: it.poNo || transfer.poNo,
            buyer: it.buyer || transfer.buyer,
            qty: Number(it.quantity) || 0
          });
        }
      });

      return Array.from(map.values()).map(data => ({
        size: data.size,
        colour: data.colour,
        poNo: data.poNo,
        buyer: data.buyer,
        sentQty: data.qty,
        inboundQty: data.qty
      }));
    }

    const sStyle = (transfer.styleNo || '').trim().toUpperCase();
    const sPo = (transfer.poNo || '').trim().toUpperCase();
    const rawCol = (targetColourFilter || transfer.colour || '').trim();

    const foundOrder = ordersList.find(o => (o.styleNo || '').trim().toUpperCase() === sStyle);
    const foundPo = foundOrder?.purchaseOrders?.find(p => !sPo || (p.poNo || '').trim().toUpperCase() === sPo);
    
    // Check if transfer colour has comma or matches multiple order colours
    const parsedColours = rawCol.includes(',') 
      ? rawCol.split(',').map(c => c.trim()).filter(Boolean)
      : (rawCol ? [rawCol] : []);

    const targetColours = foundPo?.colours?.filter(c => 
      parsedColours.length === 0 || parsedColours.some(pc => pc.toUpperCase() === c.colour.trim().toUpperCase())
    ) || [];

    if (targetColours.length > 0) {
      // Collect size breakdowns for each matching colour
      const result: Array<{ size: string; colour: string; poNo?: string; buyer?: string; sentQty: number; inboundQty?: number }> = [];
      const parsedSizes = extractSizeList(transfer.size);

      targetColours.forEach(c => {
        if (c.sizeQuantities && Object.keys(c.sizeQuantities).length > 0) {
          const allOrderSizes = Object.entries(c.sizeQuantities).filter(([, q]) => (Number(q) || 0) > 0);
          const targetSizes = parsedSizes.length > 0
            ? allOrderSizes.filter(([sz]) => parsedSizes.some(ps => ps.toLowerCase() === sz.toLowerCase()))
            : allOrderSizes;
          const useSizes = targetSizes.length > 0 ? targetSizes : allOrderSizes;
          
          useSizes.forEach(([sz, oQty]) => {
            result.push({
              size: sz,
              colour: c.colour,
              poNo: foundPo?.poNo || transfer.poNo,
              buyer: foundOrder?.buyer || transfer.buyer,
              sentQty: Number(oQty) || 0,
              inboundQty: Number(oQty) || 0
            });
          });
        }
      });

      if (result.length > 0) {
        const totalAllocated = result.reduce((s, i) => s + i.sentQty, 0);
        if (totalAllocated === transfer.quantity) {
          return result;
        }
        // Scale proportionally to transfer.quantity
        if (totalAllocated > 0) {
          let running = 0;
          return result.map((item, idx) => {
            let portion: number;
            if (idx === result.length - 1) {
              portion = Math.max(0, transfer.quantity - running);
            } else {
              portion = Math.round((transfer.quantity * item.sentQty) / totalAllocated);
              running += portion;
            }
            return {
              ...item,
              sentQty: portion,
              inboundQty: portion
            };
          });
        }
      }
    }

    // 3. Fallback: single colour lookup if not multiple
    const foundCol = foundPo?.colours?.find(c => !rawCol || (c.colour || '').trim().toUpperCase() === rawCol.toUpperCase());
    const parsedSizes = extractSizeList(transfer.size);

    if (foundCol?.sizeQuantities && Object.keys(foundCol.sizeQuantities).length > 0) {
      const allOrderSizes = Object.entries(foundCol.sizeQuantities).filter(([, q]) => (Number(q) || 0) > 0);
      const targetSizes = parsedSizes.length > 0
        ? allOrderSizes.filter(([sz]) => parsedSizes.some(ps => ps.toLowerCase() === sz.toLowerCase()))
        : allOrderSizes;

      const useSizes = targetSizes.length > 0 ? targetSizes : allOrderSizes;
      const totalOrderQty = useSizes.reduce((sum, [, q]) => sum + (Number(q) || 0), 0);

      if (totalOrderQty === transfer.quantity) {
        return useSizes.map(([sz, oQty]) => ({
          size: sz,
          sentQty: Number(oQty) || 0,
          inboundQty: Number(oQty) || 0,
          colour: foundCol.colour,
          poNo: foundPo?.poNo || transfer.poNo,
          buyer: foundOrder?.buyer || transfer.buyer
        }));
      }

      let allocated = 0;
      return useSizes.map(([sz, oQty], idx) => {
        let portion: number;
        if (idx === useSizes.length - 1) {
          portion = Math.max(0, transfer.quantity - allocated);
        } else {
          portion = totalOrderQty > 0
            ? Math.round((transfer.quantity * (Number(oQty) || 0)) / totalOrderQty)
            : Math.floor(transfer.quantity / useSizes.length);
          allocated += portion;
        }
        return {
          size: sz,
          sentQty: portion,
          inboundQty: portion,
          colour: foundCol.colour,
          poNo: foundPo?.poNo || transfer.poNo,
          buyer: foundOrder?.buyer || transfer.buyer
        };
      });
    }

    // 4. If size string had comma-separated sizes like "30, 32, 34, 36"
    if (parsedSizes.length > 0) {
      const perSize = Math.floor(transfer.quantity / parsedSizes.length);
      const rem = transfer.quantity % parsedSizes.length;
      return parsedSizes.map((sz, idx) => {
        const portion = perSize + (idx === 0 ? rem : 0);
        return {
          size: sz,
          sentQty: portion,
          inboundQty: portion,
          colour: transfer.colour,
          poNo: transfer.poNo,
          buyer: transfer.buyer
        };
      });
    }

    // 5. Single size or fallback
    const singleSz = transfer.size && transfer.size !== 'All Sizes' ? transfer.size : 'All Sizes';
    return [{
      size: singleSz,
      sentQty: transfer.quantity,
      inboundQty: transfer.quantity,
      colour: transfer.colour,
      poNo: transfer.poNo,
      buyer: transfer.buyer
    }];
  };

  const handleUpdateDispatchSizeQty = (index: number, val: number) => {
    const next = [...dispatchSizeItems];
    next[index] = { ...next[index], sentQty: Math.max(0, val) };
    setDispatchSizeItems(next);
    const total = next.reduce((sum, s) => sum + (s.sentQty || 0), 0);
    setDispatchQty(total);
  };

  const handleUpdateDispatchSizeName = (index: number, name: string) => {
    const next = [...dispatchSizeItems];
    next[index] = { ...next[index], size: name };
    setDispatchSizeItems(next);
  };

  const handleUpdateDispatchSizeColour = (index: number, col: string) => {
    const next = [...dispatchSizeItems];
    next[index] = { ...next[index], colour: col };
    setDispatchSizeItems(next);
  };

  const handleAddDispatchSize = () => {
    setDispatchSizeItems(prev => [...prev, { size: `Size ${prev.length + 1}`, colour: dispatchColour, sentQty: 0, inboundQty: 0 }]);
  };

  const handleRemoveDispatchSize = (index: number) => {
    const next = dispatchSizeItems.filter((_, i) => i !== index);
    setDispatchSizeItems(next);
    setDispatchQty(next.reduce((sum, s) => sum + (s.sentQty || 0), 0));
  };

  const handleUpdateReturnSize = (
    index: number,
    field: 'goodReceivedQty' | 'damageQty' | 'rejectQty',
    val: number
  ) => {
    const next = [...returnSizeItems];
    next[index] = { ...next[index], [field]: Math.max(0, val) };
    setReturnSizeItems(next);
    setGoodReceivedQty(next.reduce((sum, r) => sum + (r.goodReceivedQty || 0), 0));
    setDamageQty(next.reduce((sum, r) => sum + (r.damageQty || 0), 0));
    setRejectQty(next.reduce((sum, r) => sum + (r.rejectQty || 0), 0));
  };

  const handleSyncReturnWithSewingTransfer = () => {
    if (!selectedWashRecordForReturn) return;
    const item = selectedWashRecordForReturn;
    const sStyle = (item.styleNo || '').trim().toUpperCase();
    const sPo = (item.poNo || '').trim().toUpperCase();
    const sCol = (item.colour || '').trim().toUpperCase();

    // Look for matching sewing transfer
    const matchingSewingTransfer = transfers.find(t =>
      (item.sourceTransferId && t.id === item.sourceTransferId) ||
      (t.challanNo && t.challanNo === item.challanNo) ||
      ((t.toDepartment === 'Washing' || t.fromDepartment === 'Sewing') &&
       (t.styleNo || '').trim().toUpperCase() === sStyle &&
       (!sPo || (t.poNo || '').trim().toUpperCase() === sPo) &&
       (!sCol || (t.colour || '').trim().toUpperCase() === sCol))
    );

    if (matchingSewingTransfer) {
      const resolvedFromSewing = resolveTransferSizeBreakdown(matchingSewingTransfer, orders, item.colour);
      if (resolvedFromSewing && resolvedFromSewing.length > 0) {
        const rItems = resolvedFromSewing.map(si => ({
          size: si.size,
          colour: si.colour || item.colour,
          poNo: si.poNo || item.poNo,
          buyer: si.buyer || item.buyer,
          sentQty: si.sentQty || 0,
          prevReceived: 0,
          prevDamage: 0,
          prevReject: 0,
          pendingAtPlant: si.sentQty || 0,
          goodReceivedQty: si.sentQty || 0,
          damageQty: 0,
          rejectQty: 0
        }));
        setReturnSizeItems(rItems);
        setGoodReceivedQty(rItems.reduce((sum, r) => sum + r.goodReceivedQty, 0));
        setDamageQty(0);
        setRejectQty(0);
        return;
      }
    }

    // Fallback: match from order size quantities
    const matchedOrder = orders.find(o => (o.styleNo || '').trim().toUpperCase() === sStyle);
    const foundPo = matchedOrder?.purchaseOrders?.find(p => !sPo || (p.poNo || '').trim().toUpperCase() === sPo);
    const foundCol = foundPo?.colours?.find(c => !sCol || (c.colour || '').trim().toUpperCase() === sCol);
    if (foundCol?.sizeQuantities && Object.keys(foundCol.sizeQuantities).length > 0) {
      const allSizes = Object.entries(foundCol.sizeQuantities);
      const rItems = allSizes.map(([sz, oQty]) => ({
        size: sz,
        colour: foundCol.colour,
        poNo: foundPo?.poNo || item.poNo,
        buyer: matchedOrder?.buyer || item.buyer,
        sentQty: Number(oQty) || 0,
        prevReceived: 0,
        prevDamage: 0,
        prevReject: 0,
        pendingAtPlant: Number(oQty) || 0,
        goodReceivedQty: Number(oQty) || 0,
        damageQty: 0,
        rejectQty: 0
      }));
      setReturnSizeItems(rItems);
      setGoodReceivedQty(rItems.reduce((sum, r) => sum + r.goodReceivedQty, 0));
      setDamageQty(0);
      setRejectQty(0);
    }
  };

  // Handle open outward dispatch modal from incoming sewing transfer
  const handleOpenDispatchFromSewing = (transfer: InterDeptTransfer) => {
    setSelectedSewingTransfer(transfer);
    setDispatchStyleNo(transfer.styleNo);
    setDispatchPoNo(transfer.poNo);
    setDispatchColour(transfer.colour);
    setDispatchSize(transfer.size || 'All Sizes');
    setDispatchQty(transfer.quantity);
    setDispatchBuyer(transfer.buyer || '');
    setDispatchChallanNo(`WSH-EXT-${Math.floor(100000 + Math.random() * 900000)}`);
    setDispatchDate(new Date().toISOString().substring(0, 10));
    setDispatchVendor(PRESET_WASH_VENDORS[0].name);
    setDispatchVendorAddress(PRESET_WASH_VENDORS[0].address);
    setDispatchCustomVendor('');
    setDispatchWashType('Enzyme');
    setDispatchVehicleNo('DHAKA METRO-TA-14-9921');
    setDispatchDriverName('Md. Rafiqul Islam');
    setDispatchDriverPhone('+880 1712-345678');
    setDispatchProcessInstructions('Standard Enzyme & Softener wash. Maintain shade tolerance within +/- 5% of buyer approved lap-dip.');
    setDispatchRemarks(`Transferred from Sewing (Ref Challan: ${transfer.challanNo}, Line: ${transfer.lineNo || 'Sewing Floor'})`);

    // Populate size-wise items for review & adjustment
    const sizeItems = resolveTransferSizeBreakdown(transfer, orders);
    setDispatchSizeItems(sizeItems);
    const sumSizeQty = sizeItems.reduce((sum, s) => sum + (s.sentQty || 0), 0);
    if (sumSizeQty > 0) {
      setDispatchQty(sumSizeQty);
    }

    setErrorMessage(null);
    setIsDispatchModalOpen(true);
  };

  // Handle open manual outward dispatch
  const handleOpenManualDispatch = () => {
    setSelectedSewingTransfer(null);
    let initSizes: Array<{ size: string; sentQty: number; inboundQty?: number }> = [];
    if (orders.length > 0) {
      const first = orders[0];
      setDispatchStyleNo(first.styleNo);
      setDispatchBuyer(first.buyer);
      const firstPo = first.purchaseOrders[0];
      const firstCol = firstPo?.colours[0];
      setDispatchPoNo(firstPo?.poNo || '');
      setDispatchColour(firstCol?.colour || '');

      if (firstCol?.sizeQuantities && Object.keys(firstCol.sizeQuantities).length > 0) {
        initSizes = Object.entries(firstCol.sizeQuantities).map(([sz, q]) => ({
          size: sz,
          sentQty: Number(q) || 0,
          inboundQty: Number(q) || 0
        }));
      }
    } else {
      setDispatchStyleNo('');
      setDispatchBuyer('');
      setDispatchPoNo('');
      setDispatchColour('');
    }

    if (initSizes.length === 0) {
      initSizes = [
        { size: '30', sentQty: 250, inboundQty: 250 },
        { size: '32', sentQty: 250, inboundQty: 250 },
        { size: '34', sentQty: 250, inboundQty: 250 },
        { size: '36', sentQty: 250, inboundQty: 250 }
      ];
    }
    setDispatchSizeItems(initSizes);
    const sumQty = initSizes.reduce((s, i) => s + (i.sentQty || 0), 0);
    setDispatchSize(initSizes.map(s => s.size).join(', '));
    setDispatchQty(sumQty || 1000);
    setDispatchChallanNo(`WSH-EXT-${Math.floor(100000 + Math.random() * 900000)}`);
    setDispatchDate(new Date().toISOString().substring(0, 10));
    setDispatchVendor(PRESET_WASH_VENDORS[0].name);
    setDispatchVendorAddress(PRESET_WASH_VENDORS[0].address);
    setDispatchCustomVendor('');
    setDispatchWashType('Enzyme');
    setDispatchVehicleNo('DHAKA METRO-TA-14-9921');
    setDispatchDriverName('Md. Rafiqul Islam');
    setDispatchDriverPhone('+880 1712-345678');
    setDispatchProcessInstructions('30 min Enzyme Wash with silicone softener finish.');
    setDispatchRemarks('Outward batch for third-party wet processing.');
    setErrorMessage(null);
    setIsDispatchModalOpen(true);
  };

  // Confirm outward dispatch to 3rd-party plant
  const handleConfirmDispatchToPlant = async () => {
    if (!dispatchStyleNo || !dispatchPoNo || !dispatchColour) {
      setErrorMessage('Please select Style, PO and Colour.');
      return;
    }

    const calculatedTotalQty = dispatchSizeItems.length > 0
      ? dispatchSizeItems.reduce((sum, s) => sum + (s.sentQty || 0), 0)
      : dispatchQty;

    if (!calculatedTotalQty || calculatedTotalQty <= 0) {
      setErrorMessage('Please enter a valid quantity greater than 0.');
      return;
    }

    const finalVendor = (dispatchVendor || dispatchCustomVendor || '').trim();
    if (!finalVendor) {
      setErrorMessage('Please type or specify a 3rd-party washing plant name.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const recordId = 'wash-' + Date.now();
    const itemizedSizes: WashingSizeItem[] = dispatchSizeItems.length > 0
      ? dispatchSizeItems.map(si => ({
          size: si.size,
          colour: si.colour || dispatchColour,
          poNo: si.poNo || dispatchPoNo,
          buyer: si.buyer || dispatchBuyer,
          sentQty: si.sentQty || 0,
          receivedQty: 0,
          damageQty: 0,
          rejectQty: 0,
          balanceQty: si.sentQty || 0
        }))
      : [{
          size: dispatchSize || 'All Sizes',
          colour: dispatchColour,
          poNo: dispatchPoNo,
          buyer: dispatchBuyer,
          sentQty: calculatedTotalQty,
          receivedQty: 0,
          damageQty: 0,
          rejectQty: 0,
          balanceQty: calculatedTotalQty
        }];

    const sizeSummary = itemizedSizes.map(s => s.size).join(', ');
    const itemsJsonTag = `__ITEMS_JSON__:${JSON.stringify(itemizedSizes)}`;
    const fullRemarks = dispatchRemarks
      ? `${dispatchRemarks} | ${itemsJsonTag}`
      : itemsJsonTag;

    const newWashRecord: WashingRecord = {
      id: recordId,
      challanNo: dispatchChallanNo,
      date: dispatchDate,
      vendorName: finalVendor,
      vendorAddress: dispatchVendorAddress,
      washType: dispatchWashType,
      buyer: dispatchBuyer,
      styleNo: dispatchStyleNo,
      poNo: dispatchPoNo,
      colour: dispatchColour,
      size: sizeSummary || dispatchSize,
      items: itemizedSizes,
      sentQty: calculatedTotalQty,
      receivedQty: 0,
      damageQty: 0,
      rejectQty: 0,
      balanceQty: calculatedTotalQty,
      status: 'Sent',
      vehicleNo: dispatchVehicleNo,
      driverName: dispatchDriverName,
      driverPhone: dispatchDriverPhone,
      expectedReturnDate: dispatchExpectedReturnDate,
      sourceTransferId: selectedSewingTransfer?.id,
      authorizedBy: dispatchAuthorizedBy,
      processInstructions: dispatchProcessInstructions,
      remarks: fullRemarks
    };

    // 1. Save Washing Record
    const saveRes = await supabaseDataService.saveWashingRecord(newWashRecord, currentUser?.name);
    if (!saveRes.success) {
      setErrorMessage(saveRes.error || 'Failed to save outward washing record.');
      setIsLoading(false);
      return;
    }

    // 2. If this dispatch is from a pending sewing transfer, mark that transfer as Received by Washing Coordinator (supports partial quantity)
    if (selectedSewingTransfer && selectedSewingTransfer.status === 'Dispatched') {
      await supabaseDataService.receiveTransfer(
        selectedSewingTransfer.id,
        `${currentUser?.name || 'Washing Coordinator'} (Sent to ${finalVendor})`,
        currentUser?.name,
        calculatedTotalQty
      );
    }

    setIsLoading(false);
    setIsDispatchModalOpen(false);
    setSuccessMessage(`Outward Challan ${dispatchChallanNo} successfully issued to ${finalVendor} for ${calculatedTotalQty.toLocaleString()} pcs with itemized size counts.`);
    setTimeout(() => setSuccessMessage(null), 6000);
    setActiveTab('plant_outward');
  };

  // Handle open inward return modal with full Buyer, PO, Style, Colour & Size breakdown resolution
  const handleOpenInwardReturnModal = (item: WashingRecord) => {
    // 1. Resolve Buyer if missing
    let buyerName = item.buyer;
    const sStyle = (item.styleNo || '').trim().toUpperCase();
    const sPo = (item.poNo || '').trim().toUpperCase();
    const sCol = (item.colour || '').trim().toUpperCase();

    const matchedOrder = orders.find(o => (o.styleNo || '').trim().toUpperCase() === sStyle);
    if (!buyerName && matchedOrder?.buyer) {
      buyerName = matchedOrder.buyer;
    }
    if (!buyerName) {
      const matchedTransfer = transfers.find(t =>
        (item.sourceTransferId && t.id === item.sourceTransferId) ||
        ((t.styleNo || '').trim().toUpperCase() === sStyle && (!sPo || (t.poNo || '').trim().toUpperCase() === sPo))
      );
      if (matchedTransfer?.buyer) {
        buyerName = matchedTransfer.buyer;
      }
    }

    const itemWithBuyer: WashingRecord = {
      ...item,
      buyer: buyerName || item.buyer || 'Direct Garment Order'
    };
    setSelectedWashRecordForReturn(itemWithBuyer);
    setReturnDate(new Date().toISOString().substring(0, 10));

    // 2. Resolve Size Breakdown items
    let rawItems: WashingSizeItem[] | undefined = item.items;

    // Check remarks for embedded JSON
    if ((!rawItems || rawItems.length === 0) && item.remarks && typeof item.remarks === 'string' && item.remarks.includes('__ITEMS_JSON__:')) {
      try {
        const parts = item.remarks.split('__ITEMS_JSON__:');
        const parsed = JSON.parse(parts[1]?.trim() || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          rawItems = parsed;
        }
      } catch (err) {
        console.warn('Error parsing items JSON from wash record remarks', err);
      }
    }

    // Check source transfer for items if not found
    if ((!rawItems || rawItems.length === 0) && item.sourceTransferId) {
      const srcTransfer = transfers.find(t => t.id === item.sourceTransferId);
      if (srcTransfer?.items && srcTransfer.items.length > 0) {
        rawItems = srcTransfer.items.map(si => ({
          size: si.size,
          sentQty: Number(si.quantity) || 0,
          receivedQty: 0,
          damageQty: 0,
          rejectQty: 0,
          balanceQty: Number(si.quantity) || 0
        }));
      }
    }

    // Check matching order colour sizeQuantities if still not found or if only 'All Sizes'
    if (!rawItems || rawItems.length === 0 || (rawItems.length === 1 && (rawItems[0].size === 'All Sizes' || rawItems[0].size === 'All'))) {
      const foundPo = matchedOrder?.purchaseOrders?.find(p => !sPo || (p.poNo || '').trim().toUpperCase() === sPo);
      const foundCol = foundPo?.colours?.find(c => !sCol || (c.colour || '').trim().toUpperCase() === sCol);

      if (foundCol?.sizeQuantities && Object.keys(foundCol.sizeQuantities).length > 0) {
        const allSizes = Object.entries(foundCol.sizeQuantities);
        const totalOrderColQty = allSizes.reduce((s, [, q]) => s + (Number(q) || 0), 0) || 1;
        const totalSent = item.sentQty || totalOrderColQty;
        const totalPrevRec = item.receivedQty || 0;
        const totalPrevDam = item.damageQty || 0;
        const totalPrevRej = item.rejectQty || 0;

        let allocatedSent = 0;
        let allocatedRec = 0;
        let allocatedDam = 0;
        let allocatedRej = 0;

        rawItems = allSizes.map(([sz, oQty], idx) => {
          const isLast = idx === allSizes.length - 1;
          const numOQty = Number(oQty) || 0;

          const sizeSent = isLast
            ? Math.max(0, totalSent - allocatedSent)
            : Math.round((totalSent * numOQty) / totalOrderColQty);
          allocatedSent += sizeSent;

          const sizeRec = isLast
            ? Math.max(0, totalPrevRec - allocatedRec)
            : Math.round((totalPrevRec * numOQty) / totalOrderColQty);
          allocatedRec += sizeRec;

          const sizeDam = isLast
            ? Math.max(0, totalPrevDam - allocatedDam)
            : Math.round((totalPrevDam * numOQty) / totalOrderColQty);
          allocatedDam += sizeDam;

          const sizeRej = isLast
            ? Math.max(0, totalPrevRej - allocatedRej)
            : Math.round((totalPrevRej * numOQty) / totalOrderColQty);
          allocatedRej += sizeRej;

          const sizeBal = Math.max(0, sizeSent - sizeRec - sizeDam - sizeRej);

          return {
            size: sz,
            sentQty: sizeSent,
            receivedQty: sizeRec,
            damageQty: sizeDam,
            rejectQty: sizeRej,
            balanceQty: sizeBal
          };
        });
      }
    }

    if (rawItems && rawItems.length > 0) {
      const rItems = rawItems.map(si => {
        const prevRec = si.receivedQty || 0;
        const prevDam = si.damageQty || 0;
        const prevRej = si.rejectQty || 0;
        const pend = si.balanceQty !== undefined
          ? si.balanceQty
          : Math.max(0, (si.sentQty || 0) - prevRec - prevDam - prevRej);
        return {
          size: si.size,
          colour: si.colour || item.colour,
          poNo: si.poNo || item.poNo,
          buyer: si.buyer || item.buyer,
          sentQty: si.sentQty || 0,
          prevReceived: prevRec,
          prevDamage: prevDam,
          prevReject: prevRej,
          pendingAtPlant: pend,
          goodReceivedQty: pend,
          damageQty: 0,
          rejectQty: 0
        };
      });
      setReturnSizeItems(rItems);
      setGoodReceivedQty(rItems.reduce((sum, r) => sum + r.goodReceivedQty, 0));
      setDamageQty(0);
      setRejectQty(0);
    } else {
      const pendingBalance = Math.max(0, (item.sentQty || 0) - (item.receivedQty || 0) - (item.damageQty || 0) - (item.rejectQty || 0));
      const parsedSizes = extractSizeList(item.size);
      if (parsedSizes.length > 1) {
        const perSz = Math.floor(pendingBalance / parsedSizes.length);
        const rem = pendingBalance % parsedSizes.length;
        const rItems = parsedSizes.map((sz, i) => {
          const szPend = perSz + (i === 0 ? rem : 0);
          return {
            size: sz,
            colour: item.colour,
            poNo: item.poNo,
            buyer: item.buyer,
            sentQty: szPend,
            prevReceived: 0,
            prevDamage: 0,
            prevReject: 0,
            pendingAtPlant: szPend,
            goodReceivedQty: szPend,
            damageQty: 0,
            rejectQty: 0
          };
        });
        setReturnSizeItems(rItems);
      } else {
        setReturnSizeItems([{
          size: item.size || 'All Sizes',
          colour: item.colour,
          poNo: item.poNo,
          buyer: item.buyer,
          sentQty: item.sentQty || 0,
          prevReceived: item.receivedQty || 0,
          prevDamage: item.damageQty || 0,
          prevReject: item.rejectQty || 0,
          pendingAtPlant: pendingBalance,
          goodReceivedQty: pendingBalance,
          damageQty: 0,
          rejectQty: 0
        }]);
      }
      setGoodReceivedQty(pendingBalance);
      setDamageQty(0);
      setRejectQty(0);
    }

    setReturnVehicleNo(item.vehicleNo || 'DHAKA METRO-TA-14-9921');
    setReceiverName(currentUser?.name || 'Md. Shahinur Alam (Wash Incharge)');
    setQcWashGrade('Pass (Grade A)');
    setReturnRemarks(`Return from ${item.vendorName}. Checked & passed QC.`);
    setErrorMessage(null);
    setIsInwardModalOpen(true);
  };

  // Confirm inward return from 3rd-party plant
  const handleConfirmInwardReturn = async () => {
    if (!selectedWashRecordForReturn) return;

    if (goodReceivedQty < 0 || damageQty < 0 || rejectQty < 0) {
      setErrorMessage('Quantities cannot be negative.');
      return;
    }

    const totalIncoming = Number(goodReceivedQty) + Number(damageQty) + Number(rejectQty);
    if (totalIncoming <= 0) {
      setErrorMessage('Please enter at least some received quantity or damage/reject count.');
      return;
    }

    const currentRec = selectedWashRecordForReturn;

    // Calculate updated items
    let updatedItems: WashingSizeItem[];
    if (returnSizeItems.length > 0) {
      updatedItems = returnSizeItems.map(ri => {
        const newRec = ri.prevReceived + (ri.goodReceivedQty || 0);
        const newDam = ri.prevDamage + (ri.damageQty || 0);
        const newRej = ri.prevReject + (ri.rejectQty || 0);
        const newBal = Math.max(0, ri.sentQty - newRec - newDam - newRej);
        return {
          size: ri.size,
          colour: ri.colour || currentRec.colour,
          poNo: ri.poNo || currentRec.poNo,
          buyer: ri.buyer || currentRec.buyer,
          sentQty: ri.sentQty,
          receivedQty: newRec,
          damageQty: newDam,
          rejectQty: newRej,
          balanceQty: newBal
        };
      });
    } else {
      const newTotalReceived = (currentRec.receivedQty || 0) + Number(goodReceivedQty);
      const newTotalDamage = (currentRec.damageQty || 0) + Number(damageQty);
      const newTotalReject = (currentRec.rejectQty || 0) + Number(rejectQty);
      const newBalance = Math.max(0, currentRec.sentQty - newTotalReceived - newTotalDamage - newTotalReject);
      updatedItems = [{
        size: currentRec.size || 'All Sizes',
        colour: currentRec.colour,
        poNo: currentRec.poNo,
        buyer: currentRec.buyer,
        sentQty: currentRec.sentQty,
        receivedQty: newTotalReceived,
        damageQty: newTotalDamage,
        rejectQty: newTotalReject,
        balanceQty: newBalance
      }];
    }

    const newTotalSent = updatedItems.reduce((s, i) => s + (i.sentQty || 0), 0);
    const newTotalReceived = updatedItems.reduce((s, i) => s + (i.receivedQty || 0), 0);
    const newTotalDamage = updatedItems.reduce((s, i) => s + (i.damageQty || 0), 0);
    const newTotalReject = updatedItems.reduce((s, i) => s + (i.rejectQty || 0), 0);
    const finalSentQty = newTotalSent > 0 ? newTotalSent : currentRec.sentQty;
    const newBalance = Math.max(0, finalSentQty - newTotalReceived - newTotalDamage - newTotalReject);

    const isFullyReturned = newBalance === 0 || (newTotalReceived + newTotalDamage + newTotalReject >= finalSentQty);
    const updatedStatus: WashingRecord['status'] = isFullyReturned ? 'Completed' : 'Partial';

    setIsLoading(true);
    setErrorMessage(null);

    // Strip previous __ITEMS_JSON__ if present to keep remarks clean
    const baseRemarks = currentRec.remarks
      ? currentRec.remarks.split('__ITEMS_JSON__:')[0].trim().replace(/\|\s*$/, '').trim()
      : '';
    const itemsJsonTag = `__ITEMS_JSON__:${JSON.stringify(updatedItems)}`;
    const fullRemarks = baseRemarks
      ? `${baseRemarks} | Inward: ${goodReceivedQty} pcs on ${returnDate} (QC: ${qcWashGrade}). ${returnRemarks} | ${itemsJsonTag}`
      : `Inward: ${goodReceivedQty} pcs on ${returnDate} (QC: ${qcWashGrade}). ${returnRemarks} | ${itemsJsonTag}`;

    const updatedRecord: WashingRecord = {
      ...currentRec,
      sentQty: finalSentQty,
      size: updatedItems.map(i => i.size).join(', '),
      items: updatedItems,
      receivedQty: newTotalReceived,
      damageQty: newTotalDamage,
      rejectQty: newTotalReject,
      balanceQty: newBalance,
      status: updatedStatus,
      returnDate: returnDate,
      receivedBy: receiverName,
      remarks: fullRemarks
    };

    const res = await supabaseDataService.saveWashingRecord(updatedRecord, currentUser?.name);
    setIsLoading(false);

    if (res.success) {
      setIsInwardModalOpen(false);
      setSuccessMessage(`Successfully recorded size-wise return of ${goodReceivedQty.toLocaleString()} pcs from ${currentRec.vendorName}. Goods are now ready in Washing Section for Finishing Handover.`);
      setTimeout(() => setSuccessMessage(null), 6000);
    } else {
      setErrorMessage(res.error || 'Failed to update wash return record.');
    }
  };

  // Handle open transfer modal to Finishing
  const handleOpenTransferModal = (type: 'Transfer' | 'Return', toDept: 'Sewing' | 'Finishing' = 'Finishing', item?: WashingRecord) => {
    setTransferModalType(type);
    setTransferDefaultToDept(toDept);
    if (item) {
      const cleanStyle = cleanStyleName(item.styleNo) || item.styleNo;
      const primaryColour = (item.colour || '').split(',')[0].trim();

      const matchingItems = (item.items && item.items.length > 0)
        ? (primaryColour ? item.items.filter(si => !si.colour || matchesColour(si.colour, primaryColour)) : item.items)
        : [];

      const distinctSizes = matchingItems
        .filter(si => (si.receivedQty || 0) > 0)
        .map(si => {
          const avail = getDepartmentTransferAvailability('Washing', cleanStyle, si.poNo || item.poNo, si.colour || primaryColour, si.size);
          const availQty = avail.availableOutputQty > 0 ? avail.availableOutputQty : (si.receivedQty || 0);
          return {
            size: si.size,
            quantity: availQty
          };
        })
        .filter(si => si.quantity > 0);

      const itemsList: TransferChallanItem[] = matchingItems
        .filter(si => (si.receivedQty || 0) > 0)
        .map(si => {
          const avail = getDepartmentTransferAvailability('Washing', cleanStyle, si.poNo || item.poNo, si.colour || primaryColour, si.size);
          const availQty = avail.availableOutputQty > 0 ? avail.availableOutputQty : (si.receivedQty || 0);
          return {
            id: generateUUID(),
            buyer: si.buyer || item.buyer || 'Buyer',
            styleNo: cleanStyle,
            poNo: si.poNo || item.poNo,
            colour: si.colour || primaryColour,
            size: si.size,
            garmentType: 'Garment',
            isWashGarment: true,
            quantity: availQty
          };
        })
        .filter(it => it.quantity > 0);

      const avail = getDepartmentTransferAvailability('Washing', cleanStyle, item.poNo, primaryColour || item.colour, 'All Sizes');
      const totalAvail = avail.availableOutputQty > 0 ? avail.availableOutputQty : (itemsList.reduce((s, it) => s + it.quantity, 0) || item.receivedQty || 0);

      setTransferTargetItem({
        styleNo: cleanStyle,
        poNo: item.poNo,
        colour: primaryColour || item.colour,
        size: 'All Sizes',
        qty: totalAvail,
        sizeItems: distinctSizes && distinctSizes.length > 0 ? distinctSizes : undefined,
        items: itemsList && itemsList.length > 0 ? itemsList : undefined
      });
    } else {
      setTransferTargetItem(null);
    }
    setIsTransferModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTarget) {
      await supabaseDataService.deleteWashingRecord(deleteTarget.id, currentUser?.name);
      setDeleteTarget(null);
    }
  };

  // Third-party plant outward log columns
  const plantColumns: Column<WashingRecord>[] = [
    {
      header: 'Challan / Gate Pass',
      accessorKey: 'challanNo',
      sortable: true,
      cell: w => (
        <div>
          <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400 block">{w.challanNo}</span>
          <span className="text-[10px] text-slate-500">Last Update: {w.lastUpdateDate || w.date}</span>
        </div>
      )
    },
    {
      header: '3rd-Party Plant & Recipe',
      cell: w => (
        <div>
          <div className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-bold text-slate-800 dark:text-slate-200">{w.vendorName}</span>
          </div>
          <span className="inline-block px-1.5 py-0.5 mt-0.5 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold text-[10px] rounded">
            {w.washType} Wash
          </span>
          {w.vehicleNo && <p className="text-[10px] text-slate-400">Truck: {w.vehicleNo}</p>}
        </div>
      )
    },
    {
      header: 'Style / PO / Colour',
      cell: w => (
        <div>
          <span className="font-bold text-blue-600 dark:text-blue-400 block">{w.styleNo}</span>
          <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
            {w.poNo} - {w.colour}
          </span>
          {w.items && w.items.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {w.items.map((si, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700"
                  title={`Sent: ${si.sentQty} pcs | Received: ${si.receivedQty || 0} pcs | Balance: ${si.balanceQty ?? Math.max(0, (si.sentQty || 0) - (si.receivedQty || 0))}`}
                >
                  <span className="font-bold text-slate-900 dark:text-slate-100">{si.size}:</span> {si.receivedQty && si.receivedQty > 0 ? `${si.receivedQty}/${si.sentQty}` : `${si.sentQty}`}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-slate-400">Size: {w.size || 'All Sizes'}</span>
          )}
        </div>
      )
    },
    {
      header: 'Outward Sent',
      cell: w => (
        <span className="font-black text-slate-800 dark:text-slate-200">
          {(w.sentQty || 0).toLocaleString()} pcs
        </span>
      )
    },
    {
      header: 'Good Received Back',
      cell: w => (
        <div>
          <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
            {(w.receivedQty || 0).toLocaleString()} pcs
          </span>
          {w.returnDate && <span className="text-[10px] text-slate-400">Last: {w.returnDate}</span>}
        </div>
      )
    },
    {
      header: 'Damage / Reject',
      cell: w => (
        <span className="font-semibold text-rose-600 dark:text-rose-400">
          {((w.damageQty || 0) + (w.rejectQty || 0)).toLocaleString()} pcs
        </span>
      )
    },
    {
      header: 'At Plant Balance',
      cell: w => {
        const bal = w.balanceQty !== undefined ? w.balanceQty : Math.max(0, (w.sentQty || 0) - (w.receivedQty || 0));
        return (
          <span className={`font-black ${bal > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-400'}`}>
            {bal.toLocaleString()} pcs
          </span>
        );
      }
    },
    {
      header: 'Status',
      cell: w => {
        const bal = w.balanceQty !== undefined ? w.balanceQty : Math.max(0, (w.sentQty || 0) - (w.receivedQty || 0));
        if (w.status === 'Completed' || (bal === 0 && w.receivedQty > 0)) {
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1 w-fit">
              <CheckCircle2 className="w-3 h-3" /> Fully Returned
            </span>
          );
        }
        if (w.receivedQty > 0) {
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 flex items-center gap-1 w-fit">
              <Clock className="w-3 h-3" /> Partial ({bal} at plant)
            </span>
          );
        }
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 flex items-center gap-1 w-fit animate-pulse">
            <Truck className="w-3 h-3" /> At 3rd-Party Plant
          </span>
        );
      }
    },
    {
      header: 'Actions',
      cell: w => {
        const bal = w.balanceQty !== undefined ? w.balanceQty : Math.max(0, (w.sentQty || 0) - (w.receivedQty || 0));
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Receive from Plant Action */}
            {bal > 0 && (
              <PermissionGuard dept="Washing" permission="CREATE">
                <button
                  type="button"
                  onClick={() => handleOpenInwardReturnModal(w)}
                  title="Log Return of Goods from 3rd-Party Wash Plant"
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Receive Return</span>
                </button>
              </PermissionGuard>
            )}

            {/* Handover to Finishing Shortcut */}
            {w.receivedQty > 0 && (
              <PermissionGuard dept="Washing" permission="CREATE">
                <button
                  type="button"
                  onClick={() => handleOpenTransferModal('Transfer', 'Finishing', w)}
                  title="Issue Handover Challan to Finishing Department"
                  className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[11px] font-bold shadow-xs flex items-center gap-1 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>To Finishing</span>
                </button>
              </PermissionGuard>
            )}

            {/* Print Outward Send Gate Pass Challan */}
            <button
              type="button"
              onClick={() => printThirdPartyWashChallanPDF(w)}
              title="Print Outward Send Gate Pass & Delivery Challan PDF"
              className="p-1.5 text-slate-600 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            {/* Print Inward Return Challan if received */}
            {w.receivedQty > 0 && (
              <button
                type="button"
                onClick={() => printThirdPartyWashReturnChallanPDF(w)}
                title="Print Inward Receive Return Challan PDF"
                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete */}
            <PermissionGuard dept="Washing" permission="DELETE">
              <button
                type="button"
                onClick={() => setDeleteTarget(w)}
                title="Delete Outward Record"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </PermissionGuard>
          </div>
        );
      }
    }
  ];

  const renderPlantOutwardFooter = (data: WashingRecord[]) => {
    const totalSent = data.reduce((sum, w) => sum + (w.sentQty || 0), 0);
    const totalRecv = data.reduce((sum, w) => sum + (w.receivedQty || 0), 0);
    const totalDamage = data.reduce((sum, w) => sum + ((w.damageQty || 0) + (w.rejectQty || 0)), 0);
    const totalBal = data.reduce((sum, w) => {
      const b = w.balanceQty !== undefined ? w.balanceQty : Math.max(0, (w.sentQty || 0) - (w.receivedQty || 0));
      return sum + b;
    }, 0);

    return (
      <tr className="bg-slate-950 text-white font-black text-xs">
        <td className="px-2.5 py-3 text-white uppercase tracking-wider" colSpan={3}>
          TOTAL SUMMARY ({data.length} GATE PASSES)
        </td>
        <td className="px-2.5 py-3 text-white font-mono">
          {totalSent.toLocaleString()} pcs
        </td>
        <td className="px-2.5 py-3 text-emerald-400 font-mono">
          {totalRecv.toLocaleString()} pcs
        </td>
        <td className="px-2.5 py-3 text-rose-300 font-mono">
          {totalDamage.toLocaleString()} pcs
        </td>
        <td className="px-2.5 py-3 text-amber-400 font-mono">
          {totalBal.toLocaleString()} pcs
        </td>
        <td className="px-2.5 py-3 text-slate-400" colSpan={2}>
          -
        </td>
      </tr>
    );
  };

  // Overall KPI statistics
  const totalPlantSent = washing.reduce((acc, w) => acc + (w.sentQty || 0), 0);
  const totalPlantReceived = washing.reduce((acc, w) => acc + (w.receivedQty || 0), 0);
  const totalPlantBalance = washing.reduce((acc, w) => {
    const b = w.balanceQty !== undefined ? w.balanceQty : Math.max(0, (w.sentQty || 0) - (w.receivedQty || 0));
    return acc + b;
  }, 0);
  const totalWashFloorWip = styleWiseSummary.reduce((acc, s) => acc + s.washFloorWip, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Third-Party Washing & Wet Process Operations"
        description="Review Sewing Inbound Lots ➔ Issue 3rd-Party Plant Outward Challans ➔ Receive Inward Return ➔ Handover to Finishing"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <ExportPrintToolbar title="3rd-Party Washing Records" data={washing} filename="MJAL_Outsourced_Washing_Log" />

            {/* Handover to Finishing */}
            <PermissionGuard dept="Washing" permission="CREATE">
              <button
                type="button"
                onClick={() => handleOpenTransferModal('Transfer', 'Finishing')}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Wash to Finishing Handover</span>
              </button>
            </PermissionGuard>
          </div>
        }
      />

      {/* Top Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pending Sewing Inbound */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sewing Inbound Review</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {pendingSewingInbound.length}
            </span>
            <span className="text-xs font-semibold text-amber-600">Lots Awaiting Plant Dispatch</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total {pendingSewingInbound.reduce((acc, t) => acc + t.quantity, 0).toLocaleString()} pcs ready for outward gate pass
          </p>
        </div>

        {/* KPI 2: At 3rd-Party Wash Plants */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">At 3rd-Party Plants (WIP)</span>
            <div className="p-2 bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 rounded-lg">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
              {totalPlantBalance.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-500">pcs at plants</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Total Outward: {totalPlantSent.toLocaleString()} pcs dispatched
          </p>
        </div>

        {/* KPI 3: Returned & Verified */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Received Back from Plants</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {totalPlantReceived.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-500">pcs good washed</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Factory return verified by Washing QC
          </p>
        </div>

        {/* KPI 4: Ready for Finishing Floor Handover */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Wash Floor WIP Balance</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {totalWashFloorWip.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-slate-500">pcs ready</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Washed goods in queue to send to Finishing
          </p>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center gap-2 animate-fade-in font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-center gap-2 animate-fade-in font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: SEWING INBOUND REVIEW & 3RD-PARTY PLANT DISPATCH */}
      {/* ========================================================================= */}
      {activeTab === 'sewing_inbound' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                <span>Incoming Garments from Sewing (Awaiting Wash Review & Gate Pass Dispatch)</span>
                {pendingSewingInbound.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded text-xs font-bold">
                    {pendingSewingInbound.length} Action Needed
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Washing Coordinator reviews lot quantity and directly generates the Outward Gate Pass Challan to external wash plants (Apex, Ananta, Tusuka, etc.).
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Sewing Challan No & Date</th>
                  <th className="p-3">Buyer & Style No</th>
                  <th className="p-3">PO & Colour</th>
                  <th className="p-3">Size & Sewing Line</th>
                  <th className="p-3 text-right">Transfer Qty</th>
                  <th className="p-3">Authorized Sign</th>
                  <th className="p-3">Review Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {sewingInboundTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Waves className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                        <p className="font-medium text-slate-600 dark:text-slate-400">No incoming wash transfers from Sewing floor.</p>
                        <p className="text-[11px] text-slate-400">When Sewing completes wash-type garments and issues a handover to Washing, they will appear here for review and plant dispatch.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sewingInboundTransfers.map(item => {
                    const isPending = item.status === 'Dispatched';
                    const isRemainingBalance = item.remarks?.toLowerCase().includes('remaining balance') || item.remarks?.toLowerCase().includes('partial receive');
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 block">{item.challanNo}</span>
                          <span className="text-[11px] text-slate-500">{item.transferDate}</span>
                          {isRemainingBalance && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 mt-1">
                              Partial Remaining
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">{item.styleNo}</span>
                          <span className="text-[11px] text-slate-500">{item.buyer || 'N/A'}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">{item.poNo}</span>
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">{item.colour}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-700 dark:text-slate-300 block">{item.size || 'All Sizes'}</span>
                          <span className="text-[10px] text-slate-400">{item.lineNo || 'Sewing Section'}</span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-black text-sm text-slate-900 dark:text-slate-100 block">
                            {item.quantity.toLocaleString()} pcs
                          </span>
                          {isRemainingBalance && (
                            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                              Pending Balance
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-[11px]">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{item.authorizedBy || 'GM / Authority'}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <Clock className="w-3 h-3" /> {isRemainingBalance ? 'Awaiting Next Batch Dispatch' : 'Awaiting Wash Review'}
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> Reviewed & Sent to Plant
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">By: {item.receiverName}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isPending ? (
                              <PermissionGuard dept="Washing" permission="CREATE">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDispatchFromSewing(item)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>Review & Send to Plant</span>
                                </button>
                              </PermissionGuard>
                            ) : (
                              <button
                                type="button"
                                onClick={() => printTransferChallanPDF(item)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-bold flex items-center gap-1"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Sewing Challan</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-slate-950 text-white font-black text-xs sticky bottom-0">
                <tr>
                  <td className="p-3 text-white uppercase tracking-wider" colSpan={4}>
                    TOTAL SUMMARY ({sewingInboundTransfers.length} CHALLANS)
                  </td>
                  <td className="p-3 text-right text-emerald-400 font-mono text-sm">
                    {sewingInboundTransfers.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-slate-400" colSpan={3}>
                    {pendingSewingInbound.length} Awaiting Dispatch / {sewingInboundTransfers.length - pendingSewingInbound.length} Dispatched
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 3RD-PARTY PLANT OUTWARD & INWARD RETURN LOG */}
      {/* ========================================================================= */}
      {activeTab === 'plant_outward' && (
        <div className="space-y-4">
          <DataTable
            data={washing}
            columns={plantColumns}
            keyExtractor={w => w.id}
            searchPlaceholder="Search Challan, Plant Vendor, Style, PO, Colour, Wash Type..."
            footerRow={renderPlantOutwardFooter}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: HANDOVER TO FINISHING */}
      {/* ========================================================================= */}
      {activeTab === 'to_finishing' && (
        <div className="space-y-4">
          {/* Rule Guidance Banner */}
          <div className="p-4 bg-gradient-to-r from-cyan-900 via-sky-900 to-slate-900 text-white rounded-xl shadow-xs border border-cyan-700/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
                  <h3 className="font-bold text-sm text-cyan-100">
                    Washing ➔ Finishing Transfer Control & Eligibility Matrix
                  </h3>
                  <span className="px-2 py-0.5 bg-cyan-500/30 text-cyan-200 border border-cyan-400/30 text-[10px] font-bold rounded-full">
                    Strict 3P Received Rule Active
                  </span>
                </div>
                <p className="text-xs text-cyan-200/90 leading-relaxed max-w-4xl">
                  <strong>Business Rule:</strong> Washing ➔ Finishing transfer is strictly restricted based on goods <em>actually received back from Third-Party Wash Plants</em>.<br />
                  <span className="font-mono text-[11px] text-cyan-300">Available Transfer Qty = 3rd-Party Wash Received Qty − Already Transferred to Finishing Qty</span>. If 3P Wash Received is 0, transfer is strictly blocked.
                </p>
              </div>
              <PermissionGuard dept="Washing" permission="CREATE">
                <button
                  type="button"
                  onClick={() => handleOpenTransferModal('Transfer', 'Finishing')}
                  className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4 text-slate-950" />
                  <span>Issue Handover Challan</span>
                </button>
              </PermissionGuard>
            </div>
          </div>

          {/* Size-Wise Eligibility Matrix Filters & Search */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-600" />
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Size-Wise Finishing Transfer Eligibility Matrix ({finishingSizeBreakdownList.length} Size Items)
                </h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                  Total Available to Transfer: {finishingSizeBreakdownList.reduce((acc, it) => acc + it.availableTransferQty, 0).toLocaleString()} pcs
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Filter Style</label>
                <select
                  value={finishingFilterStyle}
                  onChange={e => {
                    setFinishingFilterStyle(e.target.value);
                    setFinishingFilterPo('ALL');
                    setFinishingFilterColour('ALL');
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold"
                >
                  <option value="ALL">All Washing Styles ({Array.from(new Set(washingEligibleCombos.map(c => c.styleNo))).length})</option>
                  {Array.from(new Set(washingEligibleCombos.map(c => c.styleNo))).map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Filter PO</label>
                <select
                  value={finishingFilterPo}
                  onChange={e => setFinishingFilterPo(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold"
                >
                  <option value="ALL">All POs</option>
                  {Array.from(new Set(
                    washingEligibleCombos
                      .filter(c => finishingFilterStyle === 'ALL' || matchesStyle(c.styleNo, finishingFilterStyle))
                      .map(c => c.poNo)
                  )).map(po => (
                    <option key={po} value={po}>{po}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Filter Colour</label>
                <select
                  value={finishingFilterColour}
                  onChange={e => setFinishingFilterColour(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold"
                >
                  <option value="ALL">All Colours</option>
                  {Array.from(new Set(
                    washingEligibleCombos
                      .filter(c => (finishingFilterStyle === 'ALL' || matchesStyle(c.styleNo, finishingFilterStyle)) && (finishingFilterPo === 'ALL' || matchesPo(c.poNo, finishingFilterPo)))
                      .map(c => c.colour)
                  )).map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Search Matrix</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={finishingSearch}
                    onChange={e => setFinishingSearch(e.target.value)}
                    placeholder="Search style, PO, colour..."
                    className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-[11px]">
                  <tr>
                    <th className="p-2.5">Buyer / Style</th>
                    <th className="p-2.5">PO / Colour</th>
                    <th className="p-2.5 font-black">Size</th>
                    <th className="p-2.5 text-right">Sewing Received</th>
                    <th className="p-2.5 text-right">3P Wash Sent</th>
                    <th className="p-2.5 text-right text-indigo-700 dark:text-indigo-300 font-black">3P Wash Received</th>
                    <th className="p-2.5 text-right text-amber-700 dark:text-amber-300">Transferred to Fin</th>
                    <th className="p-2.5 text-right text-emerald-700 dark:text-emerald-300 font-black">Available for Fin</th>
                    <th className="p-2.5 text-center">Eligibility Status</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {finishingSizeBreakdownList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-slate-400">
                        No washing styles match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    finishingSizeBreakdownList.map((item, idx) => {
                      const isZeroReceived = item.thirdPartyWashReceivedQty === 0;
                      const isEligible = item.isEligible && item.availableTransferQty > 0;
                      const isFullyTransferred = !isEligible && item.thirdPartyWashReceivedQty > 0 && item.availableTransferQty === 0;

                      return (
                        <tr
                          key={`${item.styleNo}_${item.poNo}_${item.colour}_${item.size}_${idx}`}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                            isEligible ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                          }`}
                        >
                          <td className="p-2.5">
                            <span className="font-bold text-blue-600 dark:text-blue-400 block">{item.styleNo}</span>
                            <span className="text-[10px] text-slate-400">{item.buyer}</span>
                          </td>
                          <td className="p-2.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">{item.poNo}</span>
                            <span className="text-[11px] text-slate-500">{item.colour}</span>
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100 font-mono text-xs">
                            {item.size}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                            {item.sewingReceiveQty.toLocaleString()} pcs
                          </td>
                          <td className="p-2.5 text-right font-mono text-cyan-600 dark:text-cyan-400">
                            {item.thirdPartyWashSentQty.toLocaleString()} pcs
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {item.thirdPartyWashReceivedQty.toLocaleString()} pcs
                          </td>
                          <td className="p-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                            {item.alreadyTransferredQty.toLocaleString()} pcs
                          </td>
                          <td className="p-2.5 text-right font-mono font-black">
                            <span className={item.availableTransferQty > 0 ? 'text-emerald-600 dark:text-emerald-400 text-sm' : 'text-slate-400'}>
                              {item.availableTransferQty.toLocaleString()} pcs
                            </span>
                          </td>
                          <td className="p-2.5 text-center">
                            {isZeroReceived ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800" title="Washing → Finishing Transfer is blocked because 0 pcs have been received from the 3rd-Party Wash Plant.">
                                <AlertCircle className="w-3 h-3 text-rose-500" /> Pending 3P Wash Receive
                              </span>
                            ) : isEligible ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Available for Transfer
                              </span>
                            ) : isFullyTransferred ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <Check className="w-3 h-3 text-slate-500" /> Fully Transferred
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                0 Available
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {isEligible ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferTargetItem({
                                    styleNo: item.styleNo,
                                    poNo: item.poNo,
                                    colour: item.colour,
                                    size: item.size,
                                    qty: item.availableTransferQty
                                  });
                                  setTransferModalType('Transfer');
                                  setTransferDefaultToDept('Finishing');
                                  setIsTransferModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md text-[11px] font-bold shadow-2xs flex items-center justify-center gap-1 transition-colors mx-auto"
                              >
                                <Send className="w-3 h-3" />
                                <span>Transfer</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-md text-[11px] font-semibold cursor-not-allowed mx-auto block"
                                title={item.blockReason || 'Not eligible for transfer'}
                              >
                                Blocked
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-950 text-white font-bold text-xs sticky bottom-0">
                  <tr>
                    <td className="p-2.5 uppercase tracking-wider text-cyan-300" colSpan={3}>
                      TOTAL MATRIX SUMMARY ({finishingSizeBreakdownList.length} SIZES)
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-300">
                      {finishingSizeBreakdownList.reduce((s, it) => s + it.sewingReceiveQty, 0).toLocaleString()} pcs
                    </td>
                    <td className="p-2.5 text-right font-mono text-cyan-300">
                      {finishingSizeBreakdownList.reduce((s, it) => s + it.thirdPartyWashSentQty, 0).toLocaleString()} pcs
                    </td>
                    <td className="p-2.5 text-right font-mono text-indigo-300 font-black">
                      {finishingSizeBreakdownList.reduce((s, it) => s + it.thirdPartyWashReceivedQty, 0).toLocaleString()} pcs
                    </td>
                    <td className="p-2.5 text-right font-mono text-amber-300">
                      {finishingSizeBreakdownList.reduce((s, it) => s + it.alreadyTransferredQty, 0).toLocaleString()} pcs
                    </td>
                    <td className="p-2.5 text-right font-mono text-emerald-400 font-black">
                      {finishingSizeBreakdownList.reduce((s, it) => s + it.availableTransferQty, 0).toLocaleString()} pcs
                    </td>
                    <td className="p-2.5 text-center text-slate-400" colSpan={2}>
                      {finishingSizeBreakdownList.filter(it => it.isEligible).length} sizes ready
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Dispatched Finishing Handover Challans Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-cyan-600" />
                Dispatched Finishing Handover Challans ({washingToFinishingTransfers.length} Challans)
              </h4>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Challan No & Date</th>
                    <th className="p-3">Destination Section</th>
                    <th className="p-3">Style / PO / Colour</th>
                    <th className="p-3">Size</th>
                    <th className="p-3 text-right">Quantity</th>
                    <th className="p-3">Authorized Sign</th>
                    <th className="p-3">Finishing Approval Status</th>
                    <th className="p-3 text-center">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {washingToFinishingTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Send className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                          <p className="font-medium text-slate-600 dark:text-slate-400">No handovers dispatched to Finishing yet.</p>
                          <p className="text-[11px] text-slate-400">Once washed goods return from the plant, click "Transfer" on an eligible size or "Issue Handover Challan" to dispatch them to Finishing.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    washingToFinishingTransfers.map(item => {
                      const isReceived = item.status === 'Received';
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3">
                            <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400 block">{item.challanNo}</span>
                            <span className="text-[11px] text-slate-500">{item.transferDate}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 font-bold rounded">
                              {item.toDepartment}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">Sender: {item.senderName}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-blue-600 dark:text-blue-400 block">{item.styleNo}</span>
                            <span className="text-[11px] text-slate-600 dark:text-slate-400">{item.poNo} - {item.colour}</span>
                          </td>
                          <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                            {item.size || 'All Sizes'}
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                              {item.quantity.toLocaleString()} pcs
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1 text-[11px]">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{item.authorizedBy || 'GM / Authority'}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            {isReceived ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" /> Received in Finishing
                                </span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Approved By: {item.receiverName} ({item.receiveDate})
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                                <Clock className="w-3 h-3" /> Awaiting Finishing Approval
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => printTransferChallanPDF(item)}
                              className="p-1.5 text-slate-600 hover:text-cyan-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 rounded-lg transition-colors"
                              title="Print Handover Challan PDF"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-slate-950 text-white font-black text-xs sticky bottom-0">
                  <tr>
                    <td className="p-3 text-white uppercase tracking-wider" colSpan={4}>
                      TOTAL SUMMARY ({washingToFinishingTransfers.length} CHALLANS)
                    </td>
                    <td className="p-3 text-right text-emerald-400 font-mono text-sm">
                      {washingToFinishingTransfers.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString()} pcs
                    </td>
                    <td className="p-3 text-slate-400" colSpan={3}>
                      {washingToFinishingTransfers.filter(t => t.status === 'Received').length} Received in Finishing
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STYLE-WISE OUTSOURCED WASH SUMMARY */}
      {/* ========================================================================= */}
      {activeTab === 'style_summary' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                Style / PO / Colour 3rd-Party Wash Lifecycle Balance
              </h3>
              <p className="text-[11px] text-slate-500">
                Track complete flow: Received from Sewing ➔ Sent to 3rd-Party Plants ➔ Returned & Verified ➔ Handover to Finishing
              </p>
            </div>
            <ExportPrintToolbar
              title="Style Wise Outsourced Washing Summary"
              data={styleWiseSummary}
              filename="Style_Wise_Outsourced_Washing_Summary"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                  <th className="p-3">Style No</th>
                  <th className="p-3">PO No</th>
                  <th className="p-3">Colour</th>
                  <th className="p-3 text-right">Sewing Received</th>
                  <th className="p-3 text-right">Sent to Plant</th>
                  <th className="p-3 text-right">Received from Plant</th>
                  <th className="p-3 text-right">Damage / Loss</th>
                  <th className="p-3 text-right">At Plant Balance</th>
                  <th className="p-3 text-right">Sent to Finishing</th>
                  <th className="p-3 text-right">Wash Floor WIP</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {styleWiseSummary.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-6 text-center text-slate-400">
                      No washing records found to summarize.
                    </td>
                  </tr>
                ) : (
                  styleWiseSummary.map((item, idx) => {
                    const isComplete = item.plantBalanceQty === 0 && item.plantReceivedQty > 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-extrabold text-blue-600 dark:text-blue-400">{item.styleNo}</td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{item.poNo}</td>
                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{item.colour}</td>
                        <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-300">
                          {(item.sewingReceivedQty || 0).toLocaleString()} pcs
                        </td>
                        <td className="p-3 text-right font-bold text-cyan-700 dark:text-cyan-400">
                          {(item.plantSentQty || 0).toLocaleString()} pcs
                        </td>
                        <td className="p-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400">
                          {(item.plantReceivedQty || 0).toLocaleString()} pcs
                        </td>
                        <td className="p-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                          {(item.damageQty || 0).toLocaleString()} pcs
                        </td>
                        <td className="p-3 text-right font-extrabold text-amber-600 dark:text-amber-400">
                          {(item.plantBalanceQty || 0).toLocaleString()} pcs
                        </td>
                        <td className="p-3 text-right font-bold text-blue-600 dark:text-blue-400">
                          {(item.dispatchedToFinishingQty || 0).toLocaleString()} pcs
                        </td>
                        <td className="p-3 text-right font-black text-purple-700 dark:text-purple-300">
                          {(item.washFloorWip || 0).toLocaleString()} pcs
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              isComplete
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                            }`}
                          >
                            {isComplete ? 'Plant Return Complete' : 'In Wet Processing'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-slate-950 text-white font-black text-xs sticky bottom-0">
                <tr>
                  <td className="p-3 text-white uppercase tracking-wider" colSpan={3}>
                    TOTAL SUMMARY ({styleWiseSummary.length} ITEMS)
                  </td>
                  <td className="p-3 text-right text-white font-mono">
                    {styleWiseSummary.reduce((sum, s) => sum + (s.sewingReceivedQty || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-right text-cyan-300 font-mono">
                    {styleWiseSummary.reduce((sum, s) => sum + (s.plantSentQty || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-right text-emerald-400 font-mono">
                    {styleWiseSummary.reduce((sum, s) => sum + (s.plantReceivedQty || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-right text-rose-300 font-mono">
                    {styleWiseSummary.reduce((sum, s) => sum + (s.damageQty || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-right text-amber-400 font-mono">
                    {styleWiseSummary.reduce((sum, s) => sum + (s.plantBalanceQty || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-right text-blue-300 font-mono">
                    {styleWiseSummary.reduce((sum, s) => sum + (s.dispatchedToFinishingQty || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-right text-purple-300 font-mono">
                    {styleWiseSummary.reduce((sum, s) => sum + (s.washFloorWip || 0), 0).toLocaleString()} pcs
                  </td>
                  <td className="p-3 text-slate-400 text-center">
                    -
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: INTER-DEPT TRANSFER QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'transfer_queue' && (
        <DepartmentTransferQueue
          department="Washing"
          title="Washing Inter-Department Transfer & Handover Queue"
          defaultToDept="Finishing"
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: OUTWARD PLANT DISPATCH & GATE PASS */}
      {/* ========================================================================= */}
      {isDispatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 pt-3 sm:pt-6 md:pt-8 pb-6 bg-black/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] flex flex-col min-h-0 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-blue-700 via-cyan-700 to-teal-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5" />
                <div>
                  <h3 className="font-black text-sm">Issue 3rd-Party Outward Washing Challan & Gate Pass</h3>
                  <p className="text-[11px] text-cyan-100">Accredited External Wet Processing Dispatch & Logistics Tracking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Order Info Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Style No</label>
                  <p className="font-extrabold text-blue-600 dark:text-blue-400 text-xs">{dispatchStyleNo || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">PO No</label>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{dispatchPoNo || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Colour</label>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{dispatchColour || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Size</label>
                  <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{dispatchSize}</p>
                </div>
              </div>

              {/* 3rd-Party Plant & Wash Process Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    3rd-Party Washing Plant Name *
                  </label>
                  <input
                    type="text"
                    list="wash-plant-vendor-list"
                    value={dispatchVendor}
                    onChange={e => {
                      const val = e.target.value;
                      setDispatchVendor(val);
                      const found = PRESET_WASH_VENDORS.find(v => (v.name || '').toLowerCase() === (val || '').toLowerCase());
                      if (found) setDispatchVendorAddress(found.address);
                    }}
                    placeholder="Type or select plant name (e.g. Apex Washing Plant)"
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="wash-plant-vendor-list">
                    {PRESET_WASH_VENDORS.map(v => (
                      <option key={v.name} value={v.name}>{v.address}</option>
                    ))}
                    <option value="Ananta Denim Washing Ltd" />
                    <option value="Tusuka Washing & Dyeing" />
                    <option value="Standard Group Washing Unit" />
                    <option value="Impress-Newtex Washing" />
                    <option value="Dada Washing & Garments" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Wash Type / Process Name *
                  </label>
                  <input
                    type="text"
                    list="wash-process-recipe-list"
                    value={dispatchWashType}
                    onChange={e => setDispatchWashType(e.target.value)}
                    placeholder="Type wash name (e.g. Enzyme Wash, Silicone Wash)"
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="wash-process-recipe-list">
                    <option value="Enzyme Wash" />
                    <option value="Silicone Softener Wash" />
                    <option value="Bleach Wash" />
                    <option value="Stone Wash" />
                    <option value="Acid Wash" />
                    <option value="Softener Wash" />
                    <option value="Tint / Over-Dye Wash" />
                    <option value="Normal Garment Wash" />
                    <option value="Raw Denim Rinse" />
                    <option value="Heavy Enzyme + Resins" />
                  </datalist>
                </div>
              </div>

              {/* Plant Address & Challan No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Wash Plant Address / Location
                  </label>
                  <input
                    type="text"
                    value={dispatchVendorAddress}
                    onChange={e => setDispatchVendorAddress(e.target.value)}
                    placeholder="e.g., Kachpur, Narayanganj"
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Outward Gate Pass Challan No
                  </label>
                  <input
                    type="text"
                    value={dispatchChallanNo}
                    onChange={e => setDispatchChallanNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-cyan-700 dark:text-cyan-400 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Dispatch Quantity & Expected Return Date */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Total Dispatched Qty (Pcs) *
                      </label>
                      {selectedSewingTransfer && (
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold">
                          Max: {selectedSewingTransfer.quantity.toLocaleString()} pcs
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={dispatchQty}
                      max={selectedSewingTransfer?.quantity}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setDispatchQty(val);
                        if (dispatchSizeItems.length > 0) {
                          const totalInbound = dispatchSizeItems.reduce((s, i) => s + (i.inboundQty ?? i.sentQty ?? 0), 0) || 1;
                          let allocated = 0;
                          setDispatchSizeItems(prev => prev.map((s, i) => {
                            const baseQty = s.inboundQty ?? s.sentQty ?? 0;
                            let share: number;
                            if (i === prev.length - 1) {
                              share = Math.max(0, val - allocated);
                            } else {
                              share = Math.round((val * baseQty) / totalInbound);
                              allocated += share;
                            }
                            return {
                              ...s,
                              sentQty: share
                            };
                          }));
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-black focus:ring-2 focus:ring-blue-500"
                    />
                    {selectedSewingTransfer && selectedSewingTransfer.quantity > 0 && (
                      <div className="flex gap-1.5 mt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedSewingTransfer) {
                              const reset = resolveTransferSizeBreakdown(selectedSewingTransfer, orders, dispatchColour);
                              setDispatchSizeItems(reset);
                              setDispatchQty(reset.reduce((s, i) => s + (i.sentQty || 0), 0));
                            }
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 transition-colors"
                        >
                          Full ({selectedSewingTransfer.quantity.toLocaleString()} pcs)
                        </button>
                        {selectedSewingTransfer.quantity > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const half = Math.floor(selectedSewingTransfer.quantity / 2);
                              setDispatchQty(half);
                              if (dispatchSizeItems.length > 0) {
                                const totalInbound = dispatchSizeItems.reduce((s, i) => s + (i.inboundQty ?? i.sentQty ?? 0), 0) || 1;
                                let allocated = 0;
                                setDispatchSizeItems(prev => prev.map((s, i) => {
                                  const baseQty = s.inboundQty ?? s.sentQty ?? 0;
                                  let share: number;
                                  if (i === prev.length - 1) {
                                    share = Math.max(0, half - allocated);
                                  } else {
                                    share = Math.round((half * baseQty) / totalInbound);
                                    allocated += share;
                                  }
                                  return {
                                    ...s,
                                    sentQty: share
                                  };
                                }));
                              }
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                          >
                            50% ({Math.floor(selectedSewingTransfer.quantity / 2).toLocaleString()} pcs)
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Dispatched Date
                    </label>
                    <input
                      type="date"
                      value={dispatchDate}
                      onChange={e => setDispatchDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Expected Return Date
                    </label>
                    <input
                      type="date"
                      value={dispatchExpectedReturnDate}
                      onChange={e => setDispatchExpectedReturnDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 font-medium"
                    />
                  </div>
                </div>

                {/* Size-Wise Garment Count & Review Section */}
                <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 dark:from-slate-800/80 dark:to-slate-800/40 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                          Size-Wise Garment Count & Review
                        </h4>
                        {dispatchColour && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Colour: {dispatchColour}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {selectedSewingTransfer
                          ? `Review size quantities from Sewing (${dispatchColour || 'All Colours'}). Adjust exact piece count per size to send to wash plant.`
                          : 'Specify exact product quantities per size for this outward washing batch.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedSewingTransfer && (
                        <button
                          type="button"
                          onClick={() => {
                            const reset = resolveTransferSizeBreakdown(selectedSewingTransfer, orders, dispatchColour);
                            setDispatchSizeItems(reset);
                            setDispatchQty(reset.reduce((s, i) => s + (i.sentQty || 0), 0));
                          }}
                          className="px-2 py-1 text-[10.5px] font-bold bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-1 shadow-xs"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset to Sewing</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddDispatchSize}
                        className="px-2 py-1 text-[10.5px] font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Size</span>
                      </button>
                    </div>
                  </div>

                  {/* Size Table */}
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-3 py-2">Size</th>
                          <th className="px-2 py-2 text-center text-slate-600 dark:text-slate-400">Colour</th>
                          {selectedSewingTransfer && (
                            <th className="px-3 py-2 text-center text-slate-500">Sewing Inbound</th>
                          )}
                          <th className="px-3 py-2 text-right">Outward Dispatch Qty (Pcs) *</th>
                          {selectedSewingTransfer && (
                            <th className="px-3 py-2 text-center text-purple-600">Remaining Inbound</th>
                          )}
                          <th className="px-2 py-2 text-center w-10">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dispatchSizeItems.map((item, idx) => {
                          const inbound = item.inboundQty ?? item.sentQty;
                          const remaining = Math.max(0, inbound - (item.sentQty || 0));
                          return (
                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                              <td className="px-3 py-1.5 font-bold">
                                <input
                                  type="text"
                                  value={item.size}
                                  onChange={e => handleUpdateDispatchSizeName(idx, e.target.value)}
                                  className="w-20 px-2 py-1 text-xs border rounded bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-extrabold text-blue-600 dark:text-blue-400"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <input
                                  type="text"
                                  value={item.colour || dispatchColour}
                                  onChange={e => handleUpdateDispatchSizeColour(idx, e.target.value)}
                                  className="w-24 px-2 py-1 text-xs border rounded bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-semibold text-center text-slate-800 dark:text-slate-200"
                                />
                              </td>
                              {selectedSewingTransfer && (
                                <td className="px-3 py-1.5 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                                  {inbound.toLocaleString()} pcs
                                </td>
                              )}
                              <td className="px-3 py-1.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.sentQty}
                                    onChange={e => handleUpdateDispatchSizeQty(idx, parseInt(e.target.value) || 0)}
                                    className="w-24 px-2 py-1 text-xs font-black text-right border rounded-lg bg-white dark:bg-slate-800 border-blue-300 dark:border-blue-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                                  />
                                  <span className="text-[10px] text-slate-400 font-medium">pcs</span>
                                </div>
                              </td>
                              {selectedSewingTransfer && (
                                <td className="px-3 py-1.5 text-center font-mono text-[11px]">
                                  {remaining > 0 ? (
                                    <span className="text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                                      {remaining} pcs
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0 pcs</span>
                                  )}
                                </td>
                              )}
                              <td className="px-2 py-1.5 text-center">
                                {dispatchSizeItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDispatchSize(idx)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                                    title="Remove this size"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-800 font-black text-xs border-t-2 border-slate-200 dark:border-slate-700">
                        <tr>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-200 uppercase" colSpan={2}>
                            Total ({dispatchSizeItems.length} Sizes):
                          </td>
                          {selectedSewingTransfer && (
                            <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-400 font-mono">
                              {selectedSewingTransfer.quantity.toLocaleString()} pcs
                            </td>
                          )}
                          <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400 font-mono text-sm">
                            {dispatchQty.toLocaleString()} pcs
                          </td>
                          {selectedSewingTransfer && (
                            <td className="px-3 py-2 text-center font-mono text-purple-600 dark:text-purple-400">
                              {Math.max(0, selectedSewingTransfer.quantity - dispatchQty).toLocaleString()} pcs
                            </td>
                          )}
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Partial Dispatch Guidance Alert */}
                {selectedSewingTransfer && dispatchQty > 0 && dispatchQty < selectedSewingTransfer.quantity && (
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2">
                    <Info className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Partial Dispatch Active: </span>
                      <span>
                        Sending <strong>{dispatchQty.toLocaleString()} pcs</strong> to plant. The remaining balance of{' '}
                        <strong className="text-purple-700 dark:text-purple-300 underline font-black">
                          {(selectedSewingTransfer.quantity - dispatchQty).toLocaleString()} pcs
                        </strong>{' '}
                        will automatically stay in the <strong>Sewing Inbound Review</strong> queue for your next review & dispatch.
                      </span>
                    </div>
                  </div>
                )}

                {selectedSewingTransfer && dispatchQty > selectedSewingTransfer.quantity && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Dispatch quantity ({dispatchQty.toLocaleString()} pcs) cannot exceed the available sewing handover quantity ({selectedSewingTransfer.quantity.toLocaleString()} pcs).
                    </span>
                  </div>
                )}
              </div>

              {/* Vehicle & Driver Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vehicle / Truck No
                  </label>
                  <input
                    type="text"
                    value={dispatchVehicleNo}
                    onChange={e => setDispatchVehicleNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    value={dispatchDriverName}
                    onChange={e => setDispatchDriverName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Authorized Signatory
                  </label>
                  <input
                    type="text"
                    value={dispatchAuthorizedBy}
                    onChange={e => setDispatchAuthorizedBy(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                  />
                </div>
              </div>

              {/* Process Recipe Instructions */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Process Recipe & Shade Matching Instructions
                </label>
                <textarea
                  rows={2}
                  value={dispatchProcessInstructions}
                  onChange={e => setDispatchProcessInstructions(e.target.value)}
                  placeholder="Enter specific recipe times, temperature, silicone dosage..."
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleConfirmDispatchToPlant}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Truck className="w-4 h-4" />
                <span>{isLoading ? 'Generating Gate Pass...' : 'Approve & Dispatch to 3rd-Party Plant'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INWARD RETURN FROM 3RD-PARTY WASH PLANT */}
      {/* ========================================================================= */}
      {isInwardModalOpen && selectedWashRecordForReturn && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 pt-3 sm:pt-6 md:pt-8 pb-6 bg-black/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] flex flex-col min-h-0 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-700 to-teal-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5" />
                <div>
                  <h3 className="font-black text-sm">Receive Inward Return from 3rd-Party Wash Plant</h3>
                  <p className="text-[11px] text-emerald-100">
                    Vendor: {selectedWashRecordForReturn.vendorName} | Challan: {selectedWashRecordForReturn.challanNo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInwardModalOpen(false)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Plant & Order Overview (Buyer, Style, PO, Colour, Wash Type) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Buyer Name</span>
                  <span className="font-extrabold text-indigo-700 dark:text-indigo-400 text-xs">
                    {selectedWashRecordForReturn.buyer || 'Direct Order'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Style No</span>
                  <span className="font-black text-blue-600 dark:text-blue-400 text-xs">
                    {selectedWashRecordForReturn.styleNo || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">PO No</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {selectedWashRecordForReturn.poNo || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Colour</span>
                  <span className="font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] inline-block">
                    {selectedWashRecordForReturn.colour || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Plant & Pending Overview Bar */}
              <div className="grid grid-cols-3 gap-3 bg-emerald-50/60 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">Wash Type</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedWashRecordForReturn.washType}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">Total Sent</span>
                  <span className="font-black text-slate-900 dark:text-slate-100">{selectedWashRecordForReturn.sentQty.toLocaleString()} pcs</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">Pending at Plant</span>
                  <span className="font-black text-amber-600 dark:text-amber-400">
                    {Math.max(0, (selectedWashRecordForReturn.sentQty || 0) - (selectedWashRecordForReturn.receivedQty || 0) - (selectedWashRecordForReturn.damageQty || 0) - (selectedWashRecordForReturn.rejectQty || 0)).toLocaleString()} pcs
                  </span>
                </div>
              </div>

              {/* Overall Return Quantities Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Total Good Received Qty (Pcs) *
                  </label>
                  <input
                    type="number"
                    value={goodReceivedQty}
                    onChange={e => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      setGoodReceivedQty(val);
                      if (returnSizeItems.length > 0) {
                        const totalPending = returnSizeItems.reduce((s, i) => s + (i.pendingAtPlant || 0), 0) || 1;
                        let allocated = 0;
                        setReturnSizeItems(prev => prev.map((s, i) => {
                          let share: number;
                          if (i === prev.length - 1) {
                            share = Math.max(0, val - allocated);
                          } else {
                            share = Math.round((val * (s.pendingAtPlant || 0)) / totalPending);
                            allocated += share;
                          }
                          return {
                            ...s,
                            goodReceivedQty: share
                          };
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-xl bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 font-black focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Wash Damage / Stain (Pcs)
                  </label>
                  <input
                    type="number"
                    value={damageQty}
                    onChange={e => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      setDamageQty(val);
                    }}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-rose-600 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Wash Reject / Shortage (Pcs)
                  </label>
                  <input
                    type="number"
                    value={rejectQty}
                    onChange={e => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      setRejectQty(val);
                    }}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-rose-600 font-bold"
                  />
                </div>
              </div>

              {/* Size-Wise Inward Receive & Inspection Table */}
              {returnSizeItems.length > 0 && (
                <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 dark:from-slate-800/80 dark:to-slate-800/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                          Size-Wise Inward Receive & Quality Inspection
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {selectedWashRecordForReturn.buyer || 'Buyer'} • Style: {selectedWashRecordForReturn.styleNo} • PO: {selectedWashRecordForReturn.poNo} • {selectedWashRecordForReturn.colour}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Inspect exact pieces received per size. Sent Qty is fixed according to the dispatch challan.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Sync with Sewing Transfer */}
                      <button
                        type="button"
                        onClick={handleSyncReturnWithSewingTransfer}
                        className="px-2.5 py-1 text-[10.5px] font-bold bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-1 shadow-xs"
                        title="Reload exact sizes & quantities transferred from Sewing Floor"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Sync with Sewing</span>
                      </button>

                      {/* Receive 100% Pending */}
                      <button
                        type="button"
                        onClick={() => {
                          setReturnSizeItems(prev => prev.map(s => ({
                            ...s,
                            goodReceivedQty: s.pendingAtPlant,
                            damageQty: 0,
                            rejectQty: 0
                          })));
                          const totalPend = returnSizeItems.reduce((sum, s) => sum + s.pendingAtPlant, 0);
                          setGoodReceivedQty(totalPend);
                          setDamageQty(0);
                          setRejectQty(0);
                        }}
                        className="px-2.5 py-1 text-[10.5px] font-bold bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <Check className="w-3 h-3" />
                        <span>Receive 100% Pending</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-3 py-2">Size</th>
                          <th className="px-2 py-2 text-center text-slate-500">Colour</th>
                          <th className="px-2 py-2 text-center text-slate-600 dark:text-slate-400">Sent Qty</th>
                          <th className="px-2 py-2 text-center text-amber-600">Pending at Plant</th>
                          <th className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-400">Good Received (Pcs) *</th>
                          <th className="px-2 py-2 text-right text-rose-600">Damage</th>
                          <th className="px-2 py-2 text-right text-rose-600">Reject</th>
                          <th className="px-2 py-2 text-center text-slate-500">New Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {returnSizeItems.map((item, idx) => {
                          const newBalance = Math.max(0, item.pendingAtPlant - (item.goodReceivedQty || 0) - (item.damageQty || 0) - (item.rejectQty || 0));
                          return (
                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                              <td className="px-3 py-1.5 font-bold text-slate-900 dark:text-slate-100">
                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 font-mono font-bold">
                                  {item.size}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-center text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                                <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold">
                                  {item.colour || selectedWashRecordForReturn.colour}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/50">
                                {item.sentQty.toLocaleString()}
                              </td>
                              <td className="px-2 py-1.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                                {item.pendingAtPlant.toLocaleString()}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.goodReceivedQty}
                                  onChange={e => handleUpdateReturnSize(idx, 'goodReceivedQty', parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 text-xs font-black text-right border rounded-lg bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 focus:ring-2 focus:ring-emerald-500"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.damageQty}
                                  onChange={e => handleUpdateReturnSize(idx, 'damageQty', parseInt(e.target.value) || 0)}
                                  className="w-16 px-1.5 py-1 text-xs font-bold text-right border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-rose-600"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.rejectQty}
                                  onChange={e => handleUpdateReturnSize(idx, 'rejectQty', parseInt(e.target.value) || 0)}
                                  className="w-16 px-1.5 py-1 text-xs font-bold text-right border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-rose-600"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-center font-mono text-[11px]">
                                {newBalance > 0 ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                                    {newBalance} pcs
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Done</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-800 font-black text-xs border-t-2 border-slate-200 dark:border-slate-700">
                        <tr>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-200 uppercase" colSpan={2}>
                            Total:
                          </td>
                          <td className="px-2 py-2 text-center text-slate-700 dark:text-slate-300 font-mono">
                            {returnSizeItems.reduce((s, i) => s + (i.sentQty || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-2 py-2 text-center text-amber-600 dark:text-amber-400 font-mono">
                            {returnSizeItems.reduce((s, i) => s + (i.pendingAtPlant || 0), 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                            {goodReceivedQty.toLocaleString()}
                          </td>
                          <td className="px-2 py-2 text-right text-rose-600 font-mono">
                            {damageQty.toLocaleString()}
                          </td>
                          <td className="px-2 py-2 text-right text-rose-600 font-mono">
                            {rejectQty.toLocaleString()}
                          </td>
                          <td className="px-2 py-2 text-center text-slate-600 dark:text-slate-400 font-mono">
                            {Math.max(0, returnSizeItems.reduce((s, i) => s + (i.pendingAtPlant || 0), 0) - goodReceivedQty - damageQty - rejectQty).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Return Date & QC Shade Grading */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Inward Return Date
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    QC Wash Shade Inspection
                  </label>
                  <select
                    value={qcWashGrade}
                    onChange={e => setQcWashGrade(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 font-bold"
                  >
                    <option value="Pass (Grade A)">Pass (Grade A - Exact Match)</option>
                    <option value="Minor Shading (Pass)">Minor Shading (Approved by Buyer QA)</option>
                    <option value="Rework Needed">Rework Needed (Re-wash required)</option>
                    <option value="Rejected">Rejected (Severe Colour Bleed / Damage)</option>
                  </select>
                </div>
              </div>

              {/* Receiver Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Factory Received By
                  </label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Delivery Vehicle No
                  </label>
                  <input
                    type="text"
                    value={returnVehicleNo}
                    onChange={e => setReturnVehicleNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Inward QC Remarks
                </label>
                <textarea
                  rows={2}
                  value={returnRemarks}
                  onChange={e => setReturnRemarks(e.target.value)}
                  placeholder="Notes regarding hand-feel, shade consistency, wash lot quality..."
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsInwardModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleConfirmInwardReturn}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isLoading ? 'Saving Inward Return...' : 'Confirm Inward Return to Factory'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Outward Washing Record"
        message={`Are you sure you want to delete outward Challan ${deleteTarget?.challanNo}?`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Inter-Dept Transfer Modal for Finishing Handover */}
      <TransferChallanModal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferTargetItem(null);
        }}
        defaultFromDept="Washing"
        defaultToDept={transferDefaultToDept}
        initialTransferType={transferModalType}
        initialStyleNo={transferTargetItem?.styleNo}
        initialPoNo={transferTargetItem?.poNo}
        initialColour={transferTargetItem?.colour}
        initialSize={transferTargetItem?.size}
        maxAvailableQty={transferTargetItem?.qty}
        initialSizeItems={transferTargetItem?.sizeItems}
        initialItems={transferTargetItem?.items}
        onSuccess={() => {
          setSuccessMessage('Handover Challan successfully issued to Finishing Department. Finishing section will review & confirm receive.');
          setTimeout(() => setSuccessMessage(null), 6000);
          setActiveTab('to_finishing');
        }}
      />
    </div>
  );
};
