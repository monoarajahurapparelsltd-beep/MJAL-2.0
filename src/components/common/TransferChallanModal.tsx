import React, { useState, useEffect } from 'react';
import {
  Send,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Truck,
  Scissors,
  Shirt,
  Waves,
  Sparkles,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Plus,
  Trash2,
  ListPlus,
  Building,
  FileCheck
} from 'lucide-react';
import { InterDeptTransfer, TransferChallanItem } from '../../types';
import { supabaseDataService, generateUUID } from '../../services/supabaseDataService';
import { useAuth } from '../../context/AuthContext';
import { Modal } from './Modal';
import { printTransferChallanPDF } from '../../utils/printUtils';
import {
  resolveChallanAuthorities,
  getDepartmentIncharge,
  getDepartmentManager,
  DEPARTMENT_AUTHORITIES
} from '../../utils/authorityUtils';
import { normalizeSizeName } from '../../utils/sewingCalculationUtils';
import {
  getDepartmentTransferAvailability,
  validateDepartmentTransfer,
  DepartmentTransferAvailability,
  matchesStyle,
  matchesPo,
  matchesColour,
  cleanStyleName
} from '../../utils/transferValidationUtils';

const PRODUCT_CATEGORIES = [
  'Denim Bottom',
  'Chino Pants',
  'Knit T-Shirt',
  'Polo Shirt',
  'Woven Shirt',
  'Jacket / Outerwear',
  'Knit Top',
  'Bottoms / Pants',
  'Non-Denim Bottom',
  'Sweater / Cardigan',
  'Activewear / Sportswear',
  'Standard Apparel'
];

const RETURN_REASONS = [
  'Cut Panel / Fabric Defect (Recut Replacement)',
  'Sewing Stitch / Construction Alteration Rework',
  'Wash Shade Variation / Tone Discrepancy',
  'Re-Wash Process Required (Wash Defect)',
  'Finishing Spot / Stain Cleaning Rework',
  'Excess Quantity / Balance Reversal',
  'Quality Audit (QA) Rejection',
  'Customer / Buyer Sample Discrepancy'
];

const AUTHORIZED_SIGNATORIES = [
  { name: 'Engr. M. A. Rahman', designation: 'General Manager (Operations)' },
  { name: 'Md. Shahidul Islam', designation: 'Factory Manager & Production Head' },
  { name: 'Kazi Farhan Ahmed', designation: 'Head of Quality Assurance & Compliance' },
  { name: 'Md. Tariqul Hasan', designation: 'Head of Planning & Commercial' },
  { name: 'Factory GM / Management', designation: 'General Manager / Factory Head' }
];

export type DepartmentType = 'Cutting' | 'Sewing' | 'Washing' | 'Finishing' | 'Packing' | 'Shipment' | 'Store';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  defaultFromDept?: DepartmentType;
  defaultToDept?: DepartmentType;
  initialStyleNo?: string;
  initialPoNo?: string;
  initialColour?: string;
  initialSize?: string;
  maxAvailableQty?: number;
  initialTransferType?: 'Transfer' | 'Return';
  initialOriginalChallanNo?: string;
  initialItems?: TransferChallanItem[];
  initialSizeItems?: Array<{ size: string; quantity: number }>;
}

export const TransferChallanModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultFromDept = 'Cutting',
  defaultToDept,
  initialStyleNo = '',
  initialPoNo = '',
  initialColour = '',
  initialSize = 'All Sizes',
  maxAvailableQty = 0,
  initialTransferType = 'Transfer',
  initialOriginalChallanNo = '',
  initialItems,
  initialSizeItems
}) => {
  const safeClose = () => {
    if (typeof onClose === 'function') onClose();
  };
  const { currentUser } = useAuth();
  const [orders] = useState(supabaseDataService.getOrders());

  const computedDefaultTo: DepartmentType = defaultToDept || (
    defaultFromDept === 'Finishing' ? 'Shipment' :
    defaultFromDept === 'Cutting' ? 'Sewing' :
    defaultFromDept === 'Sewing' ? 'Washing' :
    defaultFromDept === 'Washing' ? 'Finishing' :
    defaultFromDept === 'Packing' ? 'Shipment' :
    'Sewing'
  );

  const [transferType, setTransferType] = useState<'Transfer' | 'Return'>(initialTransferType);
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [originalChallanNo, setOriginalChallanNo] = useState(initialOriginalChallanNo);

  const [fromDept, setFromDept] = useState<DepartmentType>(defaultFromDept);
  const [toDept, setToDept] = useState<DepartmentType>(computedDefaultTo);

  // Multi-item transfer list state
  const [transferItems, setTransferItems] = useState<TransferChallanItem[]>([]);

  // Current item selection inputs
  const [buyer, setBuyer] = useState('');
  const [styleNo, setStyleNo] = useState(initialStyleNo);
  const [poNo, setPoNo] = useState(initialPoNo);
  const [colour, setColour] = useState(initialColour);
  const [size, setSize] = useState(initialSize);
  const [garmentType, setGarmentType] = useState('');
  const [isWashGarment, setIsWashGarment] = useState(false);

  const [quantity, setQuantity] = useState<number | ''>(maxAvailableQty > 0 ? maxAvailableQty : '');
  const [bundleCount, setBundleCount] = useState<number | ''>('');
  const [itemRemarks, setItemRemarks] = useState('');

  // Challan general attributes
  const [lineNo, setLineNo] = useState('Line No 1');
  const [vendorName, setVendorName] = useState('Apex Washing Plant');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [senderName, setSenderName] = useState(currentUser?.name || 'Department In-charge');
  const [remarks, setRemarks] = useState('');

  const [challanNo, setChallanNo] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [viewPrintMode, setViewPrintMode] = useState(false);
  const [createdTransfer, setCreatedTransfer] = useState<InterDeptTransfer | null>(null);

  // Department shortcode helper
  const getDeptCode = (dept: string) => {
    switch (dept?.toLowerCase()) {
      case 'cutting': return 'CUT';
      case 'sewing': return 'SEW';
      case 'washing': return 'WSH';
      case 'finishing': return 'FIN';
      case 'packing': return 'PAK';
      case 'shipment': return 'SHP';
      case 'store': return 'STR';
      default: return (dept || 'GEN').substring(0, 3).toUpperCase();
    }
  };

  const generateChallanCode = (type: 'Transfer' | 'Return', from: string, to: string) => {
    const prefix = type === 'Return' ? 'RET' : 'CH';
    const fromCode = getDeptCode(from);
    const toCode = getDeptCode(to);
    const randomId = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${fromCode}-${toCode}-${randomId}`;
  };

  // Auto-generate Challan No on open or when parameters change
  useEffect(() => {
    if (isOpen) {
      const activeType = initialTransferType === 'Return' ? 'Return' : 'Transfer';
      const effectiveTo = defaultToDept || (
        defaultFromDept === 'Finishing' ? 'Shipment' :
        defaultFromDept === 'Cutting' ? 'Sewing' :
        defaultFromDept === 'Sewing' ? 'Washing' :
        defaultFromDept === 'Washing' ? 'Finishing' :
        defaultFromDept === 'Packing' ? 'Shipment' :
        'Sewing'
      );
      setTransferType(activeType);
      setFromDept(defaultFromDept);
      setToDept(effectiveTo);
      setChallanNo(generateChallanCode(activeType, defaultFromDept, effectiveTo));
      setTransferDate(new Date().toISOString().split('T')[0]);
      setSenderName(currentUser?.name || 'Department In-charge');
      setViewPrintMode(false);
      setErrorMessage(null);
      setSuccessMsg(null);
      setOriginalChallanNo(initialOriginalChallanNo || '');

      if (initialItems && initialItems.length > 0) {
        const filtered = initialColour
          ? initialItems.filter(it => matchesColour(it.colour, initialColour))
          : initialItems;
        setTransferItems(filtered.length > 0 ? filtered : initialItems);
      } else if (initialSizeItems && initialSizeItems.length > 0) {
        const ord = orders.find(o => matchesStyle(o.styleNo, initialStyleNo));
        const isWash = supabaseDataService.isStyleWashGarment(initialStyleNo || '');
        const itemsFromSizes: TransferChallanItem[] = initialSizeItems.map(si => ({
          id: generateUUID(),
          buyer: ord?.buyer || 'Monoara Buyer',
          styleNo: initialStyleNo || '',
          poNo: initialPoNo || '',
          colour: initialColour || '',
          size: si.size,
          garmentType: ord?.garmentType || 'Garment',
          isWashGarment: isWash,
          quantity: si.quantity
        }));
        setTransferItems(itemsFromSizes);
      } else {
        setTransferItems([]);
      }

      if (initialStyleNo) {
        handleStyleSelect(initialStyleNo, initialPoNo, initialColour, initialSize);
        if (maxAvailableQty > 0) {
          setQuantity(maxAvailableQty);
        }
      } else if (orders.length > 0) {
        handleStyleSelect(orders[0].styleNo);
      }
    }
  }, [isOpen, defaultFromDept, defaultToDept, initialStyleNo, initialPoNo, initialColour, initialSize, maxAvailableQty, initialTransferType, initialOriginalChallanNo, initialItems, initialSizeItems]);

  // Dynamically update Challan No whenever fromDept, toDept or transferType changes
  const handleDepartmentChange = (newFrom: DepartmentType, newTo: DepartmentType, newType = transferType) => {
    let targetTo = newTo;
    if (targetTo === newFrom) {
      if (newFrom === 'Cutting') targetTo = 'Sewing';
      else if (newFrom === 'Sewing') targetTo = 'Washing';
      else if (newFrom === 'Washing') targetTo = 'Finishing';
      else if (newFrom === 'Finishing') targetTo = 'Shipment';
      else if (newFrom === 'Packing') targetTo = 'Shipment';
      else targetTo = 'Cutting';
    } else if (newFrom === 'Finishing' && (newTo === 'Sewing' || newTo === 'Cutting')) {
      targetTo = 'Shipment';
    }
    setFromDept(newFrom);
    setToDept(targetTo);
    setChallanNo(generateChallanCode(newType, newFrom, targetTo));
  };

  const handleTransferTypeToggle = (type: 'Transfer' | 'Return') => {
    setTransferType(type);
    setChallanNo(generateChallanCode(type, fromDept, toDept));
  };

  const getOrderQtyForSelection = (selectedStyle: string, selectedPo: string, selectedCol: string, selectedSz: string) => {
    const ord = orders.find(o => matchesStyle(o.styleNo, selectedStyle));
    if (!ord) return 0;
    const poObj = ord.purchaseOrders.find(p => matchesPo(p.poNo, selectedPo));
    if (!poObj) return 0;
    const colObj = poObj.colours.find(c => matchesColour(c.colour, selectedCol));
    if (!colObj) return 0;

    const colAllowancePct = Number(colObj.allowancePct ?? poObj.allowancePct ?? ord.allowancePct ?? 0);
    const normSz = normalizeSizeName(selectedSz);

    if (normSz === 'All Sizes') {
      let colFactoryQty = Number(colObj.factoryQty) || 0;
      if (!colFactoryQty) {
        if (colObj.factorySizeQuantities && Object.keys(colObj.factorySizeQuantities).length > 0) {
          colFactoryQty = Object.values(colObj.factorySizeQuantities).reduce<number>((sum, q) => sum + (Number(q) || 0), 0);
        } else if (colAllowancePct > 0) {
          colFactoryQty = Math.round((colObj.totalQty || 0) * (1 + colAllowancePct / 100));
        } else {
          colFactoryQty = colObj.totalQty || 0;
        }
      }
      return colFactoryQty > 0 ? colFactoryQty : (colObj.totalQty || 0);
    }

    if (colObj.factorySizeQuantities && typeof colObj.factorySizeQuantities === 'object') {
      for (const [k, v] of Object.entries(colObj.factorySizeQuantities)) {
        if (normalizeSizeName(k) === normSz) {
          return Number(v) || 0;
        }
      }
    }

    if (colObj.sizeQuantities && typeof colObj.sizeQuantities === 'object') {
      for (const [k, v] of Object.entries(colObj.sizeQuantities)) {
        if (normalizeSizeName(k) === normSz) {
          const baseQty = Number(v) || 0;
          return colAllowancePct > 0 ? baseQty + Math.round(baseQty * (colAllowancePct / 100)) : baseQty;
        }
      }
    }
    return 0;
  };

  // Live Department Transfer Availability Engine (Style, PO, Colour, Size-wise)
  const currentAvailability: DepartmentTransferAvailability = React.useMemo(() => {
    if (!styleNo || !poNo || !colour) {
      return {
        department: fromDept,
        styleNo,
        poNo,
        colour,
        size: size || 'All Sizes',
        orderQty: 0,
        actualOutputQty: 0,
        alreadyTransferredQty: 0,
        pendingTransferQty: 0,
        availableOutputQty: 0,
        isTransferBlocked: true,
        unit: 'pcs'
      };
    }
    return getDepartmentTransferAvailability(fromDept, styleNo, poNo, colour, size || 'All Sizes');
  }, [fromDept, styleNo, poNo, colour, size, isOpen]);

  const handleBuyerSelect = (selectedBuyer: string) => {
    setBuyer(selectedBuyer);
    const buyerPOs = supabaseDataService.getBuyerPOs(selectedBuyer, transferType === 'Return');
    if (buyerPOs.length === 1) {
      handlePoChange(buyerPOs[0].poNo, selectedBuyer);
    } else {
      setPoNo('');
      setStyleNo('');
      setColour('');
      setSize('All Sizes');
      setQuantity('');
    }
  };

  const handlePoChange = (newPo: string, buyerContext?: string) => {
    setPoNo(newPo);
    const activeBuyer = buyerContext || buyer;
    const poStyles = supabaseDataService.getPOStyles(newPo, activeBuyer, transferType === 'Return');
    if (poStyles.length === 1) {
      handleStyleSelect(poStyles[0].styleNo, newPo, undefined, undefined, activeBuyer);
    } else {
      setStyleNo('');
      setColour('');
      setSize('All Sizes');
      setQuantity('');
    }
  };

  const handleStyleSelect = (selectedStyle: string, selectedPo?: string, selectedCol?: string, selectedSz?: string, buyerContext?: string) => {
    setStyleNo(selectedStyle);
    const ord = orders.find(o => matchesStyle(o.styleNo, selectedStyle));
    if (ord) {
      const activeBuyer = buyerContext || ord.buyer || buyer;
      setBuyer(activeBuyer);
      setGarmentType(ord.garmentType || 'Garment');
      const isWash = supabaseDataService.isStyleWashGarment(selectedStyle);
      setIsWashGarment(isWash);

      const activePo = selectedPo || poNo || ord.purchaseOrders[0]?.poNo || '';
      setPoNo(activePo);

      const cols = supabaseDataService.getColours(selectedStyle, activePo, transferType === 'Return');
      const activeCol = selectedCol && cols.some(c => matchesColour(c.colour, selectedCol))
        ? selectedCol
        : (cols[0]?.colour || '');
      setColour(activeCol);

      const targetSize = selectedSz || 'All Sizes';
      setSize(targetSize);

      // Auto-set suggested quantity based on Available Output Quantity
      const avail = getDepartmentTransferAvailability(fromDept, selectedStyle, activePo, activeCol, targetSize);
      if (avail.availableOutputQty > 0) {
        setQuantity(avail.availableOutputQty);
      } else {
        setQuantity('');
      }

      // Auto-adjust default destination based on department & wash garment status
      if (transferType === 'Transfer' && fromDept === 'Sewing') {
        const targetDept = isWash ? 'Washing' : 'Finishing';
        handleDepartmentChange('Sewing', targetDept, 'Transfer');
      }
    }
  };

  const handleColourChange = (newCol: string) => {
    setColour(newCol);
    const avail = getDepartmentTransferAvailability(fromDept, styleNo, poNo, newCol, size);
    if (avail.availableOutputQty > 0) {
      setQuantity(avail.availableOutputQty);
    } else {
      setQuantity('');
    }
  };

  const handleSizeChange = (newSize: string) => {
    setSize(newSize);
    const avail = getDepartmentTransferAvailability(fromDept, styleNo, poNo, colour, newSize);
    if (avail.availableOutputQty > 0) {
      setQuantity(avail.availableOutputQty);
    } else {
      setQuantity('');
    }
  };

  const expandAllSizesItems = (
    targetStyle: string,
    targetPo: string,
    targetColour: string,
    targetQty: number,
    targetBundleCount?: number,
    targetRemarks?: string
  ): TransferChallanItem[] => {
    const sStyle = (targetStyle || '').trim().toUpperCase();
    const sPo = (targetPo || '').trim().toUpperCase();
    const sCol = (targetColour || '').trim().toUpperCase();

    const ord = orders.find(o => matchesStyle(o.styleNo, targetStyle));
    const poObj = ord?.purchaseOrders.find(p => matchesPo(p.poNo, targetPo));
    const colObj = poObj?.colours.find(c => matchesColour(c.colour, targetColour));

    if (colObj && colObj.sizeQuantities && Object.keys(colObj.sizeQuantities).length > 0) {
      const orderSizes = Object.entries(colObj.sizeQuantities).filter(([_, q]) => (Number(q) || 0) > 0);

      // Calculate each size's exact live available quantity in the sending department (fromDept)
      const sizeAvailabilities = orderSizes.map(([rawSzName, szOrderQty]) => {
        const szName = normalizeSizeName(rawSzName);
        const avail = getDepartmentTransferAvailability(fromDept, targetStyle, targetPo, colObj.colour || targetColour, rawSzName);
        const availQty = Math.max(0, avail.availableOutputQty);
        return {
          rawSzName,
          szName,
          orderQty: Number(szOrderQty) || 0,
          availQty
        };
      });

      const totalAvail = sizeAvailabilities.reduce((sum, s) => sum + s.availQty, 0);
      const totalOrder = sizeAvailabilities.reduce((sum, s) => sum + s.orderQty, 0);

      // If we have positive available quantities in this department
      if (totalAvail > 0) {
        let sizeQuantitiesResult: number[] = [];

        if (targetQty === totalAvail) {
          // Exact full transfer of available quantity: assign EXACT available quantity per size!
          sizeQuantitiesResult = sizeAvailabilities.map(s => s.availQty);
        } else if (targetQty < totalAvail) {
          // Partial transfer: proportionally allocate based on each size's available quantity
          // and cap so no size exceeds its available quantity in sending department
          let allocated = 0;
          sizeQuantitiesResult = sizeAvailabilities.map((s, idx) => {
            if (idx === sizeAvailabilities.length - 1) {
              const remaining = Math.max(0, targetQty - allocated);
              return Math.min(s.availQty, remaining);
            }
            const share = Math.min(s.availQty, Math.round((targetQty * s.availQty) / totalAvail));
            allocated += share;
            return share;
          });

          // Re-balance any rounding difference if sum doesn't match targetQty
          let currentSum = sizeQuantitiesResult.reduce((a, b) => a + b, 0);
          let diff = targetQty - currentSum;
          if (diff !== 0) {
            for (let i = 0; i < sizeQuantitiesResult.length && diff !== 0; i++) {
              const s = sizeAvailabilities[i];
              if (diff > 0 && sizeQuantitiesResult[i] < s.availQty) {
                const add = Math.min(diff, s.availQty - sizeQuantitiesResult[i]);
                sizeQuantitiesResult[i] += add;
                diff -= add;
              } else if (diff < 0 && sizeQuantitiesResult[i] > 0) {
                const sub = Math.min(-diff, sizeQuantitiesResult[i]);
                sizeQuantitiesResult[i] -= sub;
                diff += sub;
              }
            }
          }
        } else {
          // targetQty > totalAvail: allocate full available, then distribute remainder
          const base = sizeAvailabilities.map(s => s.availQty);
          let remainingExtra = targetQty - totalAvail;
          for (let i = 0; i < base.length && remainingExtra > 0; i++) {
            const extraPortion = i === base.length - 1
              ? remainingExtra
              : Math.round((remainingExtra * (sizeAvailabilities[i].orderQty || 1)) / (totalOrder || 1));
            base[i] += extraPortion;
            remainingExtra -= extraPortion;
          }
          sizeQuantitiesResult = base;
        }

        return sizeAvailabilities
          .map((s, idx) => {
            const rawQty = sizeQuantitiesResult[idx] ?? 0;
            const maxAllowed = s.orderQty > 0 ? s.orderQty : (s.availQty > 0 ? s.availQty : Infinity);
            const itemQty = Math.min(maxAllowed, rawQty);
            return {
              id: generateUUID(),
              buyer: ord?.buyer || buyer || 'Monoara Buyer',
              styleNo: targetStyle,
              poNo: targetPo,
              colour: colObj.colour || targetColour,
              size: s.szName,
              garmentType: garmentType || 'Garment',
              isWashGarment,
              quantity: itemQty,
              bundleCount: targetBundleCount && targetQty > 0 ? Math.round((targetBundleCount * itemQty) / targetQty) : undefined,
              remarks: targetRemarks || undefined
            };
          })
          .filter(it => it.quantity > 0);
      }

      // Fallback if no specific department availability tracked
      if (totalOrder > 0) {
        let allocated = 0;
        return orderSizes
          .map(([rawSzName, szOrderQty], idx) => {
            const szName = normalizeSizeName(rawSzName);
            const maxSzOrder = Number(szOrderQty) || 0;
            let itemQty: number;
            if (idx === orderSizes.length - 1) {
              itemQty = Math.max(0, targetQty - allocated);
            } else {
              itemQty = Math.round((targetQty * (Number(szOrderQty) || 0)) / totalOrder);
              allocated += itemQty;
            }

            if (maxSzOrder > 0) {
              itemQty = Math.min(itemQty, maxSzOrder);
            }

            return {
              id: generateUUID(),
              buyer: ord?.buyer || buyer || 'Monoara Buyer',
              styleNo: targetStyle,
              poNo: targetPo,
              colour: colObj.colour || targetColour,
              size: szName,
              garmentType: garmentType || 'Garment',
              isWashGarment,
              quantity: itemQty,
              bundleCount: targetBundleCount ? Math.round((targetBundleCount * (Number(szOrderQty) || 0)) / totalOrder) : undefined,
              remarks: targetRemarks || undefined
            };
          })
          .filter(it => it.quantity > 0);
      }
    }

    // Fallback if no specific size breakdown in master order
    return [{
      id: generateUUID(),
      buyer: buyer || 'Monoara Buyer',
      styleNo: targetStyle,
      poNo: targetPo,
      colour: targetColour,
      size: 'All Sizes',
      garmentType: garmentType || 'Garment',
      isWashGarment,
      quantity: targetQty,
      bundleCount: targetBundleCount || undefined,
      remarks: targetRemarks || undefined
    }];
  };

  // Add current selected item (Style, PO, Colour, Size, Qty) to multi-item transfer list
  const handleAddItemToTransfer = () => {
    setErrorMessage(null);
    if (!styleNo) {
      setErrorMessage('Please select a Style No.');
      return;
    }
    if (!poNo) {
      setErrorMessage('Please select a PO No.');
      return;
    }
    if (!colour) {
      setErrorMessage('Please select a Colour.');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      setErrorMessage('Please enter a valid transfer quantity greater than 0.');
      return;
    }

    const qtyNum = Number(quantity);
    const bundlesNum = bundleCount ? Number(bundleCount) : undefined;

    // Strict Department-to-Department Transfer Control check
    if (transferType === 'Transfer') {
      const validation = validateDepartmentTransfer(fromDept, [{
        styleNo,
        poNo,
        colour,
        size: size || 'All Sizes',
        quantity: qtyNum
      }]);

      if (!validation.isValid) {
        setErrorMessage(validation.errors[0] || 'Transfer quantity exceeds available output quantity.');
        return;
      }
    }

    if (size === 'All Sizes' || size === 'All Sizes (Assorted)') {
      // Auto explode/detect all individual sizes for this Style, PO and Colour
      const expandedItems = expandAllSizesItems(styleNo, poNo, colour, qtyNum, bundlesNum, itemRemarks);
      setTransferItems(prev => [...prev, ...expandedItems]);
      setSuccessMsg(`Added ${styleNo} (${colour} - All Sizes expanded into ${expandedItems.length} individual size items: ${qtyNum} pcs) to challan!`);
    } else {
      const newItem: TransferChallanItem = {
        id: generateUUID(),
        buyer: buyer || 'Monoara Buyer',
        styleNo,
        poNo,
        colour,
        size: size || 'All Sizes',
        garmentType: garmentType || 'Garment',
        isWashGarment,
        quantity: qtyNum,
        bundleCount: bundlesNum,
        remarks: itemRemarks || undefined
      };
      setTransferItems(prev => [...prev, newItem]);
      setSuccessMsg(`Added ${newItem.styleNo} (${newItem.colour} - ${newItem.size}: ${newItem.quantity} pcs) to challan!`);
    }

    setTimeout(() => setSuccessMsg(null), 3000);

    // Reset current quantity and bundle inputs for next style/size entry
    setQuantity('');
    setBundleCount('');
    setItemRemarks('');
  };

  const handleRemoveItem = (id: string) => {
    setTransferItems(prev => prev.filter(it => it.id !== id));
  };

  const totalTransferQty = transferItems.length > 0
    ? transferItems.reduce((acc, it) => acc + (it.quantity || 0), 0)
    : (Number(quantity) || 0);

  const totalBundleCount = transferItems.length > 0
    ? transferItems.reduce((acc, it) => acc + (it.bundleCount || 0), 0)
    : (Number(bundleCount) || undefined);

  const currentAuth = resolveChallanAuthorities(fromDept, toDept, transferType);

  const handleSaveTransfer = async () => {
    setErrorMessage(null);

    // If user has added items to the list, use that list.
    // If not, validate the single active input and create item.
    let finalItems: TransferChallanItem[] = [...transferItems];

    if (finalItems.length === 0) {
      if (!styleNo || !poNo || !colour) {
        setErrorMessage('Please select Style, PO and Colour or add items to the Challan list.');
        return;
      }
      if (!quantity || Number(quantity) <= 0) {
        setErrorMessage('Please enter a valid transfer quantity greater than 0.');
        return;
      }
      
      const qtyNum = Number(quantity);
      const bundlesNum = bundleCount ? Number(bundleCount) : undefined;

      // Strict validation for single item
      if (transferType === 'Transfer') {
        const val = validateDepartmentTransfer(fromDept, [{
          styleNo,
          poNo,
          colour,
          size: size || 'All Sizes',
          quantity: qtyNum
        }]);
        if (!val.isValid) {
          setErrorMessage(val.errors[0] || 'Transfer quantity exceeds available output quantity.');
          return;
        }
      }

      if (size === 'All Sizes' || size === 'All Sizes (Assorted)') {
        // Auto explode/detect all individual sizes for this Style, PO and Colour
        finalItems = expandAllSizesItems(styleNo, poNo, colour, qtyNum, bundlesNum, itemRemarks);
      } else {
        finalItems = [{
          id: generateUUID(),
          buyer: buyer || 'Monoara Buyer',
          styleNo,
          poNo,
          colour,
          size: size || 'All Sizes',
          garmentType: garmentType || 'Garment',
          isWashGarment,
          quantity: qtyNum,
          bundleCount: bundlesNum,
          remarks: itemRemarks || undefined
        }];
      }
    } else {
      // Validate all items in the batch
      if (transferType === 'Transfer') {
        const val = validateDepartmentTransfer(fromDept, finalItems.map(it => ({
          styleNo: it.styleNo,
          poNo: it.poNo,
          colour: it.colour,
          size: it.size,
          quantity: it.quantity
        })));
        if (!val.isValid) {
          setErrorMessage(val.errors.join('\n'));
          return;
        }
      }
    }

    const primaryItem = finalItems[0];
    const totalQty = finalItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const totalBundles = finalItems.reduce((sum, it) => sum + (it.bundleCount || 0), 0) || undefined;

    // Distinct styles & colours summary for single-field backwards compatibility
    const distinctStyles = Array.from(new Set(finalItems.map(it => it.styleNo))).join(', ');
    const distinctPOs = Array.from(new Set(finalItems.map(it => it.poNo))).join(', ');
    const distinctColours = Array.from(new Set(finalItems.map(it => it.colour))).join(', ');
    const distinctSizes = Array.from(new Set(finalItems.map(it => it.size))).join(', ');

    const auth = resolveChallanAuthorities(fromDept, toDept, transferType);

    setIsLoading(true);

    const newTransfer: InterDeptTransfer = {
      id: generateUUID(),
      challanNo,
      transferType,
      returnReason: transferType === 'Return' ? returnReason : undefined,
      originalChallanNo: transferType === 'Return' && originalChallanNo ? originalChallanNo : undefined,
      transferDate,
      fromDepartment: fromDept,
      toDepartment: toDept,
      buyer: primaryItem.buyer,
      styleNo: finalItems.length === 1 ? primaryItem.styleNo : distinctStyles,
      poNo: finalItems.length === 1 ? primaryItem.poNo : distinctPOs,
      colour: finalItems.length === 1 ? primaryItem.colour : distinctColours,
      size: finalItems.length === 1 ? primaryItem.size : distinctSizes,
      garmentType: primaryItem.garmentType,
      isWashGarment: finalItems.some(it => it.isWashGarment),
      quantity: totalQty,
      bundleCount: totalBundles,
      items: finalItems,
      lineNo: (fromDept === 'Sewing' || toDept === 'Sewing') ? lineNo : undefined,
      vendorName: (fromDept === 'Washing' || toDept === 'Washing') ? vendorName : undefined,
      vehicleNo: vehicleNo || undefined,
      driverName: driverName || undefined,
      senderName: auth.senderIncharge.name,
      receiverName: auth.receiverIncharge.name,
      qcCheckedBy: auth.qualityIncharge.name,
      authorizedBy: auth.authorizedBy,
      authorizedDesignation: auth.authorizedDesignation,
      authorizedDate: transferDate,
      status: 'Dispatched',
      remarks: remarks || undefined,
      createdAt: new Date().toISOString()
    };

    const res = await supabaseDataService.saveTransfer(newTransfer, currentUser?.name);
    setIsLoading(false);

    if (res.success) {
      setCreatedTransfer(newTransfer);
      setViewPrintMode(true);
      if (onSuccess) onSuccess();
    } else {
      setErrorMessage(res.error || 'Failed to save transfer voucher.');
    }
  };

  const handlePrint = () => {
    if (createdTransfer) {
      printTransferChallanPDF(createdTransfer);
    } else {
      window.print();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={safeClose}
      title={
        viewPrintMode
          ? createdTransfer?.transferType === 'Return'
            ? 'Official Product Return Challan & Gate Pass'
            : 'Official Inter-Department Delivery Challan & Gate Pass'
          : 'Issue Multi-Item Transfer / Return Challan'
      }
      maxWidth="max-w-4xl"
    >
      <div id="transfer-challan-container" className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {!viewPrintMode ? (
          <div className="space-y-4 text-sm">
            {/* Transfer Type Selector: Standard Forward Transfer vs Product Return */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTransferTypeToggle('Transfer')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors ${
                    transferType === 'Transfer'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Standard Transfer Handover</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTransferTypeToggle('Return')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors ${
                    transferType === 'Return'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Product Return Handover</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Route & Challan No</span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      {fromDept} ➔ {toDept}
                    </span>
                    <span className="px-2 py-0.5 font-mono text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-blue-600 dark:text-blue-400">
                      {challanNo}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Route & Date Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  From Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={fromDept}
                  onChange={e => handleDepartmentChange(e.target.value as DepartmentType, toDept)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold"
                >
                  <option value="Cutting">Cutting</option>
                  <option value="Sewing">Sewing</option>
                  <option value="Washing">Washing</option>
                  <option value="Finishing">Finishing</option>
                  <option value="Packing">Packing</option>
                  <option value="Shipment">Shipment</option>
                  <option value="Store">Store</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  To Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={toDept}
                  onChange={e => handleDepartmentChange(fromDept, e.target.value as DepartmentType)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold"
                >
                  <option value="Cutting">Cutting</option>
                  <option value="Sewing">Sewing</option>
                  <option value="Washing">Washing</option>
                  <option value="Finishing">Finishing</option>
                  <option value="Packing">Packing</option>
                  <option value="Shipment">Shipment</option>
                  <option value="Store">Store</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold"
                />
              </div>
            </div>

            {/* Product Return Reason if Return Mode */}
            {transferType === 'Return' && (
              <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/80 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-rose-900 dark:text-rose-200 mb-1">
                    Defect / Return Reason <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    className="w-full px-3 py-1.5 border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold"
                  >
                    {RETURN_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-rose-900 dark:text-rose-200 mb-1">
                    Original Challan No (Reference)
                  </label>
                  <input
                    type="text"
                    value={originalChallanNo}
                    onChange={e => setOriginalChallanNo(e.target.value)}
                    placeholder="e.g. CH-CUT-SEW-4821"
                    className="w-full px-3 py-1.5 border border-rose-300 dark:border-rose-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}

            {/* Style / PO / Colour / Size Selection Box (Item Entry) */}
            <div className="p-3.5 bg-blue-50/50 dark:bg-slate-900/60 rounded-xl border border-blue-200 dark:border-blue-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <ListPlus className="w-4 h-4 text-blue-600" />
                  Select Style, PO, Colour & Size to Transfer
                </span>
                <span className="text-[11px] text-slate-500">
                  You can add multiple styles/sizes into this single challan
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Buyer
                  </label>
                  <select
                    value={buyer}
                    onChange={e => handleBuyerSelect(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold"
                  >
                    <option value="">All Buyers</option>
                    {supabaseDataService.getBuyers(transferType === 'Return').map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    PO No <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={poNo}
                    onChange={e => handlePoChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold"
                  >
                    <option value="">Select PO...</option>
                    {supabaseDataService.getBuyerPOs(buyer, transferType === 'Return').map(p => (
                      <option key={p.poNo} value={p.poNo}>{p.poNo} ({(p.factoryPoQty || p.totalPoQty).toLocaleString()} pcs)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Style No <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={styleNo}
                    onChange={e => handleStyleSelect(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold"
                  >
                    <option value="">Select Style...</option>
                    {supabaseDataService.getPOStyles(poNo, buyer, transferType === 'Return').map(o => (
                      <option key={o.id} value={o.styleNo}>{o.styleNo} ({o.buyer})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Colour <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={colour}
                    onChange={e => handleColourChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-semibold"
                  >
                    <option value="">Select Colour...</option>
                    {supabaseDataService.getColours(styleNo, poNo, transferType === 'Return').map(c => {
                      const colAvail = styleNo && poNo ? getDepartmentTransferAvailability(fromDept, styleNo, poNo, c.colour, 'All Sizes') : null;
                      const colFactQty = colAvail ? colAvail.orderQty : (c.factoryQty || (c.allowancePct ? Math.round(c.totalQty * (1 + c.allowancePct / 100)) : c.totalQty));
                      return (
                        <option key={c.colour} value={c.colour}>
                          {c.colour} ({colFactQty.toLocaleString()} pcs){colAvail ? ` - Avail: ${colAvail.availableOutputQty.toLocaleString()} pcs` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Size</label>
                  <select
                    value={size}
                    onChange={e => handleSizeChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                  >
                    {(() => {
                      const allSizesAvail = styleNo && colour ? getDepartmentTransferAvailability(fromDept, styleNo, poNo, colour, 'All Sizes') : null;
                      return (
                        <option value="All Sizes">
                          All Sizes (Assorted){allSizesAvail ? ` (Factory Order: ${allSizesAvail.orderQty.toLocaleString()} pcs) - Avail: ${allSizesAvail.availableOutputQty.toLocaleString()} pcs${allSizesAvail.availableOutputQty <= 0 ? ' (Transferred)' : ''}` : ''}
                        </option>
                      );
                    })()}
                    {(() => {
                      const colSizes = supabaseDataService.getSizes(styleNo, poNo, colour);
                      if (colSizes.sizeQuantities && Object.keys(colSizes.sizeQuantities).length > 0) {
                        return Object.entries(colSizes.sizeQuantities)
                          .filter(([_, ordQty]) => (Number(ordQty) || 0) > 0)
                          .map(([sz]) => {
                            const szAvail = getDepartmentTransferAvailability(fromDept, styleNo, poNo, colour, sz);
                            return (
                              <option key={sz} value={sz}>
                                {sz} (Factory Order: {szAvail.orderQty.toLocaleString()} pcs{szAvail.allowancePct ? ` +${szAvail.allowancePct}%` : ''}) - Avail: {szAvail.availableOutputQty.toLocaleString()} pcs {szAvail.availableOutputQty <= 0 ? '(0 Rem / Completed)' : ''}
                              </option>
                            );
                          });
                      }
                      return null;
                    })()}
                  </select>
                </div>
              </div>

              {/* Department Output & Transfer Control Status Indicator Panel */}
              {transferType === 'Transfer' && styleNo && (
                <div className="p-3 bg-white dark:bg-slate-800/90 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {fromDept} Output & Transfer Control
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ({styleNo} - {colour} - {size || 'All Sizes'})
                      </span>
                    </div>
                    <div>
                      {currentAvailability.isTransferBlocked ? (
                        <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[11px] font-bold rounded-full border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Transfer Limit Reached / Blocked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Available for Transfer
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-md border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
                        Factory Order Qty
                      </span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono block">
                        {currentAvailability.orderQty.toLocaleString()} <span className="text-[10px] font-normal">pcs</span>
                      </span>
                      {currentAvailability.allowancePct && currentAvailability.allowancePct > 0 ? (
                        <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-semibold block leading-tight">
                          (Incl. +{currentAvailability.allowancePct}% Allowance)
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-normal block leading-tight">
                          (Allowance Included)
                        </span>
                      )}
                    </div>

                    <div className="p-2 bg-blue-50/70 dark:bg-blue-950/40 rounded-md border border-blue-100 dark:border-blue-900/40">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-blue-300 block">
                        {fromDept === 'Washing' && currentAvailability.isThirdPartyWash ? '3P Wash Received' : 'Actual Output Qty'}
                      </span>
                      <span className="text-sm font-black text-blue-700 dark:text-blue-300 font-mono">
                        {currentAvailability.actualOutputQty.toLocaleString()} <span className="text-[10px] font-normal">pcs</span>
                      </span>
                    </div>

                    <div className="p-2 bg-amber-50/70 dark:bg-amber-950/40 rounded-md border border-amber-100 dark:border-amber-900/40">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-300 block">
                        {fromDept === 'Washing' ? 'Transferred to Fin' : 'Already Transferred Qty'}
                      </span>
                      <span className="text-sm font-black text-amber-700 dark:text-amber-300 font-mono">
                        {currentAvailability.alreadyTransferredQty.toLocaleString()} <span className="text-[10px] font-normal">pcs</span>
                      </span>
                    </div>

                    <div className={`p-2 rounded-md border ${
                      currentAvailability.availableOutputQty > 0
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200'
                    }`}>
                      <span className="text-[10px] uppercase font-black tracking-wider block">
                        {fromDept === 'Washing' ? 'Available for Fin' : 'Transfer Pending / Available'}
                      </span>
                      <span className="text-sm font-black font-mono">
                        {currentAvailability.availableOutputQty.toLocaleString()} <span className="text-[10px] font-normal">pcs</span>
                      </span>
                    </div>
                  </div>

                  {fromDept === 'Washing' && currentAvailability.isThirdPartyWash && (currentAvailability.thirdPartyWashReceivedQty ?? 0) === 0 && (
                    <div className="mt-2 p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-md">
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 font-bold flex items-start gap-1.5">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                        <span>
                          Pending Third-Party Receive: 0 pcs received from 3rd-Party Wash Plant for size "{size}". Washing ➔ Finishing Transfer is strictly blocked until goods are received back from the wash plant.
                        </span>
                      </p>
                    </div>
                  )}

                  {!(fromDept === 'Washing' && currentAvailability.isThirdPartyWash && (currentAvailability.thirdPartyWashReceivedQty ?? 0) === 0) && currentAvailability.availableOutputQty <= 0 && currentAvailability.actualOutputQty > 0 && (
                    <div className="mt-2 p-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-md">
                      <p className="text-[11px] text-rose-700 dark:text-rose-300 font-bold flex items-start gap-1.5">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                        <span>
                          {currentAvailability.totalColourPendingQty <= 0
                            ? `Full Output Qty (${currentAvailability.totalColourOutputQty.toLocaleString()} pcs) for Style "${styleNo}" (${colour}) has already been transferred across all sizes. No further size transfer is allowed.`
                            : `Full Output Qty for size "${size}" has already been transferred (${currentAvailability.alreadyTransferredQty.toLocaleString()} / ${currentAvailability.actualOutputQty.toLocaleString()} pcs). No further quantity can be transferred for this size.`}
                        </span>
                      </p>
                    </div>
                  )}
                  {fromDept !== 'Washing' && currentAvailability.actualOutputQty === 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>No production output recorded yet in {fromDept} for this selection.</span>
                    </p>
                  )}
                </div>
              )}

              {/* Quantity, Bundles, and Add Item Button */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Transfer Qty (Pcs) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={currentAvailability.availableOutputQty > 0 ? currentAvailability.availableOutputQty : undefined}
                    value={quantity}
                    disabled={currentAvailability.isTransferBlocked && transferType === 'Transfer'}
                    onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={currentAvailability.isTransferBlocked && transferType === 'Transfer' ? '0 (Limit reached)' : 'Enter quantity in pcs...'}
                    className={`w-full px-3 py-1.5 border rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 ${
                      currentAvailability.isTransferBlocked && transferType === 'Transfer'
                        ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    }`}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bundles / Bags
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={bundleCount}
                    disabled={currentAvailability.isTransferBlocked && transferType === 'Transfer'}
                    onChange={e => setBundleCount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 20"
                    className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50"
                  />
                </div>

                <div className="sm:col-span-5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddItemToTransfer}
                    disabled={currentAvailability.isTransferBlocked && transferType === 'Transfer'}
                    className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item to Challan</span>
                  </button>
                </div>
              </div>
            </div>

            {/* List of Added Items in this Challan */}
            {transferItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Challan Items ({transferItems.length} styles/sizes added)
                  </span>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                    Total Qty: {totalTransferQty.toLocaleString()} pcs
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2">#</th>
                        <th className="p-2">Buyer</th>
                        <th className="p-2">Style No</th>
                        <th className="p-2">PO No</th>
                        <th className="p-2">Colour</th>
                        <th className="p-2">Size</th>
                        <th className="p-2 text-center">Bundles</th>
                        <th className="p-2 text-right">Qty (Pcs)</th>
                        <th className="p-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {transferItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-750">
                          <td className="p-2 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2 font-semibold text-slate-800 dark:text-slate-200">{item.buyer}</td>
                          <td className="p-2 font-black text-blue-600 dark:text-blue-400">{item.styleNo}</td>
                          <td className="p-2 font-medium">{item.poNo}</td>
                          <td className="p-2">{item.colour}</td>
                          <td className="p-2 font-bold">{item.size}</td>
                          <td className="p-2 text-center">{item.bundleCount || '-'}</td>
                          <td className="p-2 text-right font-black text-slate-900 dark:text-slate-100">{item.quantity.toLocaleString()} pcs</td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50/80 dark:bg-slate-900/60 font-bold border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={6} className="p-2 text-right uppercase text-[11px]">Total Challan Items:</td>
                        <td className="p-2 text-center font-black">
                          {totalBundleCount ? `${totalBundleCount} bundles` : '-'}
                        </td>
                        <td className="p-2 text-right font-black text-sm text-emerald-600 dark:text-emerald-400">
                          {totalTransferQty.toLocaleString()} pcs
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Department Routing Logistics & Dispatch Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
              {fromDept === 'Cutting' || toDept === 'Sewing' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sewing Line No
                  </label>
                  <select
                    value={lineNo}
                    onChange={e => setLineNo(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                  >
                    <option value="Line No 1">Line No 1</option>
                    <option value="Line No 2">Line No 2</option>
                    <option value="Line No 3">Line No 3</option>
                    <option value="Line No 4">Line No 4</option>
                    <option value="Line No 5">Line No 5</option>
                    <option value="Line No 6">Line No 6</option>
                    <option value="Line No 7">Line No 7</option>
                    <option value="Line No 8">Line No 8</option>
                    <option value="Line No 9">Line No 9</option>
                    <option value="Line No 10">Line No 10</option>
                  </select>
                </div>
              ) : (fromDept === 'Sewing' && toDept === 'Washing') || (fromDept === 'Washing') ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Washing Vendor / Plant
                  </label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={e => setVendorName(e.target.value)}
                    placeholder="e.g. Apex Washing Plant"
                    className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dispatched By (Sender Name)
                  </label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={e => setSenderName(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vehicle / Carrier No (Optional)
                </label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value)}
                  placeholder="e.g. DM-TA-11-2045"
                  className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks / Special Instructions
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Shade lot #A, Handle with care..."
                  className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
                />
              </div>
            </div>

            {/* Sticky Actions Bar */}
            <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs pt-3 pb-1 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center z-20">
              <div className="text-xs text-slate-500 font-semibold">
                Total Items: {transferItems.length > 0 ? transferItems.length : (quantity ? 1 : 0)} | Total Qty: {totalTransferQty.toLocaleString()} pcs
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={safeClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTransfer}
                  disabled={isLoading}
                  className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 ${
                    transferType === 'Return'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {transferType === 'Return' ? <RotateCcw className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  <span>
                    {isLoading
                      ? 'Creating Challan...'
                      : transferType === 'Return'
                      ? 'Issue Return Challan & Gate Pass'
                      : `Dispatch Transfer (${totalTransferQty.toLocaleString()} pcs)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Printable Challan & Gate Pass View */
          <div className="space-y-4">
            <div className="p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl font-sans print:border-none print:p-0">
              {/* Factory Header */}
              <div className="text-center border-b pb-4 mb-4 border-slate-300 dark:border-slate-700">
                <h2 className="text-xl font-black tracking-tight uppercase">MONOARA JAHUR APPARELS LTD.</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Samair, Birulia, Savar, Dhaka-1340 | Ready-Made Garments Manufacturer & Exporter</p>
                <div className={`inline-block mt-2 px-3 py-1 text-white font-bold text-xs uppercase rounded ${
                  createdTransfer?.transferType === 'Return' ? 'bg-rose-700' : 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900'
                }`}>
                  {createdTransfer?.transferType === 'Return'
                    ? 'INTER-DEPARTMENT PRODUCT RETURN CHALLAN & GATE PASS'
                    : 'INTER-DEPARTMENT DELIVERY CHALLAN & GATE PASS'}
                </div>
              </div>

              {/* Challan Info Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg">
                <div>
                  <span className="text-slate-500 block">Challan No:</span>
                  <span className={`font-mono font-bold text-sm ${createdTransfer?.transferType === 'Return' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {createdTransfer?.challanNo}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Date:</span>
                  <span className="font-semibold">{createdTransfer?.transferDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">From Section:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{createdTransfer?.fromDepartment}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Destination:</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300">{createdTransfer?.toDepartment}</span>
                </div>
              </div>

              {/* Item Details Table (Multi-Item Support) */}
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs text-left border border-slate-300 dark:border-slate-700">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="p-2 border">#</th>
                      <th className="p-2 border">Buyer</th>
                      <th className="p-2 border">Style No</th>
                      <th className="p-2 border">PO No</th>
                      <th className="p-2 border">Colour</th>
                      <th className="p-2 border">Garment Type</th>
                      <th className="p-2 border">Size</th>
                      <th className="p-2 border text-center">Bundles</th>
                      <th className="p-2 border text-right">Quantity (Pcs)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {createdTransfer?.items && createdTransfer.items.length > 0 ? (
                      createdTransfer.items.map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="p-2 border text-slate-500">{idx + 1}</td>
                          <td className="p-2 border font-medium">{it.buyer || createdTransfer.buyer}</td>
                          <td className="p-2 border font-bold text-blue-600 dark:text-blue-400">{it.styleNo}</td>
                          <td className="p-2 border font-medium">{it.poNo}</td>
                          <td className="p-2 border">{it.colour}</td>
                          <td className="p-2 border">
                            {it.garmentType}
                            <span className="block text-[10px] text-slate-500">
                              ({it.isWashGarment ? 'Wash' : 'Non-Wash'})
                            </span>
                          </td>
                          <td className="p-2 border font-medium">{it.size}</td>
                          <td className="p-2 border text-center font-medium">{it.bundleCount || '-'}</td>
                          <td className="p-2 border text-right font-black text-sm text-emerald-600 dark:text-emerald-400">
                            {it.quantity?.toLocaleString()} pcs
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-2 border text-slate-500">1</td>
                        <td className="p-2 border font-medium">{createdTransfer?.buyer}</td>
                        <td className="p-2 border font-bold text-blue-600 dark:text-blue-400">{createdTransfer?.styleNo}</td>
                        <td className="p-2 border font-medium">{createdTransfer?.poNo}</td>
                        <td className="p-2 border">{createdTransfer?.colour}</td>
                        <td className="p-2 border">
                          {createdTransfer?.garmentType}
                          <span className="block text-[10px] text-slate-500">
                            ({createdTransfer?.isWashGarment ? 'Wash Garment' : 'Non-Wash Direct'})
                          </span>
                        </td>
                        <td className="p-2 border font-medium">{createdTransfer?.size}</td>
                        <td className="p-2 border text-center font-medium">{createdTransfer?.bundleCount || '-'}</td>
                        <td className="p-2 border text-right font-black text-sm text-emerald-600 dark:text-emerald-400">
                          {createdTransfer?.quantity?.toLocaleString()} pcs
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold">
                    <tr>
                      <td colSpan={7} className="p-2 border text-right uppercase">Total Challan Quantity:</td>
                      <td className="p-2 border text-center font-black">
                        {createdTransfer?.bundleCount ? `${createdTransfer.bundleCount} bundles` : '-'}
                      </td>
                      <td className="p-2 border text-right font-black text-sm text-emerald-700 dark:text-emerald-300">
                        {createdTransfer?.quantity?.toLocaleString()} pcs
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Remarks & Transport */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-8">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                    {createdTransfer?.transferType === 'Return' ? 'Return Reason & Instructions:' : 'Special Instructions / Remarks:'}
                  </span>
                  <span>
                    {createdTransfer?.transferType === 'Return' && createdTransfer.returnReason ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold block mb-1">
                        Reason: {createdTransfer.returnReason}
                      </span>
                    ) : null}
                    {createdTransfer?.remarks || (createdTransfer?.transferType === 'Return' ? 'Returned for rectification/rework.' : 'Standard inter-department bundle transfer. Checked & Passed QA Inspection.')}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">Carrier / Line Allocation:</span>
                  <span>
                    {createdTransfer?.lineNo ? `Sewing Line: ${createdTransfer.lineNo}` : ''}
                    {createdTransfer?.vendorName ? `Plant: ${createdTransfer.vendorName}` : ''}
                    {createdTransfer?.vehicleNo ? ` | Vehicle: ${createdTransfer.vehicleNo}` : ''}
                    {createdTransfer?.driverName ? ` | Driver: ${createdTransfer.driverName}` : ''}
                    {createdTransfer?.originalChallanNo ? ` | Ref Challan: ${createdTransfer.originalChallanNo}` : ''}
                  </span>
                </div>
              </div>

              {/* Official 6-Tier Department Authority Signatures */}
              {(() => {
                const previewAuth = createdTransfer
                  ? resolveChallanAuthorities(createdTransfer.fromDepartment, createdTransfer.toDepartment, createdTransfer.transferType)
                  : currentAuth;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-6 border-t border-slate-300 dark:border-slate-700 text-center text-xs">
                    {/* 1. Sender Section Incharge */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-h-[90px]">
                      <span className="text-[8px] font-bold text-slate-400 block mb-1">1. DISPATCHED BY</span>
                      <div className="h-6 border-b border-dashed border-slate-400 mb-1"></div>
                      <div>
                        <span className="font-bold block text-slate-800 dark:text-slate-200 text-[10px] leading-tight">
                          {createdTransfer?.senderName || previewAuth.senderIncharge.name}
                        </span>
                        <span className="text-[9px] text-slate-500 block leading-tight">
                          {previewAuth.senderIncharge.designation}
                        </span>
                      </div>
                    </div>

                    {/* 2. Quality Check Incharge */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-h-[90px]">
                      <span className="text-[8px] font-bold text-slate-400 block mb-1">2. QUALITY CHECK</span>
                      <div className="h-6 border-b border-dashed border-slate-400 mb-1"></div>
                      <div>
                        <span className="font-bold block text-slate-800 dark:text-slate-200 text-[10px] leading-tight">
                          {previewAuth.qualityIncharge.name}
                        </span>
                        <span className="text-[9px] text-slate-500 block leading-tight">
                          {previewAuth.qualityIncharge.designation}
                        </span>
                      </div>
                    </div>

                    {/* 3. Department / Production Manager */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-h-[90px]">
                      <span className="text-[8px] font-bold text-slate-400 block mb-1">3. DEPT. MANAGER</span>
                      <div className="h-6 border-b border-dashed border-slate-400 mb-1"></div>
                      <div>
                        <span className="font-bold block text-slate-800 dark:text-slate-200 text-[10px] leading-tight">
                          {previewAuth.deptManager.name}
                        </span>
                        <span className="text-[9px] text-slate-500 block leading-tight">
                          {previewAuth.deptManager.designation}
                        </span>
                      </div>
                    </div>

                    {/* 4. Security Assurance / Gate Pass */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-h-[90px]">
                      <span className="text-[8px] font-bold text-slate-400 block mb-1">4. SECURITY ASSURANCE</span>
                      <div className="h-6 border-b border-dashed border-slate-400 mb-1"></div>
                      <div>
                        <span className="font-bold block text-slate-800 dark:text-slate-200 text-[10px] leading-tight">
                          {previewAuth.securityAssurance.name}
                        </span>
                        <span className="text-[9px] text-slate-500 block leading-tight">
                          {previewAuth.securityAssurance.designation}
                        </span>
                      </div>
                    </div>

                    {/* 5. Receiver Section Incharge */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-h-[90px]">
                      <span className="text-[8px] font-bold text-slate-400 block mb-1">5. RECEIVED BY</span>
                      <div className="h-6 border-b border-dashed border-slate-400 mb-1"></div>
                      <div>
                        <span className="font-bold block text-slate-800 dark:text-slate-200 text-[10px] leading-tight">
                          {createdTransfer?.receiverName || previewAuth.receiverIncharge.name}
                        </span>
                        <span className="text-[9px] text-slate-500 block leading-tight">
                          {previewAuth.receiverIncharge.designation}
                        </span>
                      </div>
                    </div>

                    {/* 6. Authorized Signatory / General Manager */}
                    <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border-2 border-amber-600 dark:border-amber-500 shadow-xs flex flex-col justify-between min-h-[90px]">
                      <span className="inline-block text-[7.5px] font-black text-rose-700 dark:text-rose-400 border border-rose-600 bg-white dark:bg-slate-900 px-1 rounded uppercase mb-0.5">
                        ★ AUTHORIZED SIGN ★
                      </span>
                      <div className="h-4 border-b border-solid border-amber-700 dark:border-amber-400 mb-1"></div>
                      <div>
                        <span className="font-black block text-slate-900 dark:text-slate-100 text-[10px] leading-tight">
                          {createdTransfer?.authorizedBy || previewAuth.authorizedBy}
                        </span>
                        <span className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold block leading-tight">
                          {createdTransfer?.authorizedDesignation || previewAuth.authorizedDesignation}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Print & Done Actions */}
            <div className="flex justify-between items-center pt-2">
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Challan issued and verified with Authorized Signature!</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print PDF Challan</span>
                </button>
                <button
                  type="button"
                  onClick={safeClose}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
