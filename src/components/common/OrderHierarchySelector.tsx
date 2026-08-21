import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Layers,
  FileSpreadsheet,
  Palette,
  Ruler,
  Search,
  CheckCircle2,
  Calendar,
  PackageCheck,
  TrendingUp,
  AlertCircle,
  Scissors,
  Shirt,
  Sparkles,
  CheckSquare,
  Box,
  Truck,
  Info,
  Clock,
  ChevronDown
} from 'lucide-react';
import { supabaseDataService } from '../../services/supabaseDataService';
import { OrderStyle, PurchaseOrder, ColourQty, SizeProgressItem } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { canViewExecutiveOrderSummary } from '../../utils/authUtils';
import { SizeBreakdownMatrix } from './SizeBreakdownMatrix';

export interface OrderSelectionValue {
  buyer: string;
  brand?: string;
  styleNo: string;
  styleName: string;
  garmentType: string;
  season?: string;
  poNo: string;
  poDate?: string;
  deliveryDate?: string;
  shipmentDate?: string;
  unitPrice?: number;
  currency?: string;
  orderStatus?: string;
  colour: string;
  colourOrderQty: number;
  size?: string;
  availableSizes?: string[];
  sizeQuantities?: Record<string, number>;
  sizeBreakdown?: SizeProgressItem[];
  selectedSizeBreakdown?: SizeProgressItem | null;
  sizeOrderQty?: number;
  sizeCompletedQty?: number;
  sizeRemainingQty?: number;
  progress?: ReturnType<typeof supabaseDataService.getStylePoColourProgress>;
}

export interface OrderHierarchySelectorProps {
  selectedBuyer?: string;
  selectedStyleNo: string;
  selectedPoNo: string;
  selectedColour: string;
  selectedSize?: string;
  onSelect: (selection: OrderSelectionValue) => void;
  showSizeSelector?: boolean;
  showSizeMatrix?: boolean;
  requireSize?: boolean;
  disabled?: boolean;
  showSummaryCard?: boolean;
  showCompleted?: boolean;
  currentModule?: 'Cutting' | 'Sewing' | 'Washing' | 'Finishing' | 'QC' | 'Packing' | 'Shipment' | 'Sample' | 'Store' | 'Merchandising' | 'General';
  layout?: 'grid' | 'stacked' | 'compact';
  customTitle?: string;
}

export const OrderHierarchySelector: React.FC<OrderHierarchySelectorProps> = ({
  selectedBuyer: propBuyer,
  selectedStyleNo,
  selectedPoNo,
  selectedColour,
  selectedSize,
  onSelect,
  showSizeSelector = true,
  showSizeMatrix = true,
  requireSize = false,
  disabled = false,
  showSummaryCard = true,
  showCompleted = false,
  currentModule = 'General',
  layout = 'grid',
  customTitle = 'Select Order Master (Cascading Master Data)'
}) => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<OrderStyle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [internalBuyer, setInternalBuyer] = useState<string>(propBuyer || 'ALL');

  // Executive & Admin visibility check (Only GM, MD, Director, and ADMIN roles can view the live production pipeline summary card)
  const canViewExecutiveSummary = useMemo(() => {
    return canViewExecutiveOrderSummary(currentUser);
  }, [currentUser]);

  // Department / Section / Line User check
  const isDeptUser = useMemo(() => {
    return !canViewExecutiveOrderSummary(currentUser);
  }, [currentUser]);

  const [showDeptSelector, setShowDeptSelector] = useState(false);

  // Load orders and subscribe to live changes
  useEffect(() => {
    setOrders(supabaseDataService.getOrders());
    const unsub = supabaseDataService.subscribe(() => {
      setOrders([...supabaseDataService.getOrders()]);
    });
    return unsub;
  }, []);

  // Update internal buyer if propBuyer changes
  useEffect(() => {
    if (propBuyer) {
      setInternalBuyer(propBuyer);
    }
  }, [propBuyer]);

  // Synchronize internal buyer if a style is selected
  useEffect(() => {
    if (selectedStyleNo) {
      const match = orders.find(o => o.styleNo.trim().toUpperCase() === selectedStyleNo.trim().toUpperCase());
      if (match && match.buyer && internalBuyer === 'ALL') {
        setInternalBuyer(match.buyer);
      }
    }
  }, [selectedStyleNo, orders]);

  const allowCompleted = showCompleted || currentModule === 'Merchandising';

  // 1. Available Buyers list
  const availableBuyers = useMemo(() => {
    return supabaseDataService.getBuyers(allowCompleted);
  }, [orders, allowCompleted]);

  // 2. Available POs (filtered by selected Buyer)
  const availablePOs = useMemo(() => {
    return supabaseDataService.getBuyerPOs(internalBuyer, allowCompleted);
  }, [orders, internalBuyer, allowCompleted]);

  // 3. Current Selected PO object
  const currentPoObj = useMemo(() => {
    if (!selectedPoNo) return null;
    return availablePOs.find(p => p.poNo.trim().toUpperCase() === selectedPoNo.trim().toUpperCase()) || null;
  }, [availablePOs, selectedPoNo]);

  // 4. Available Styles (strictly belonging to the selected PO and Buyer)
  const availableStyles = useMemo(() => {
    if (!selectedPoNo) {
      // If no PO selected yet, show styles for buyer (or all)
      return supabaseDataService.getStyles(internalBuyer, allowCompleted);
    }
    return supabaseDataService.getPOStyles(selectedPoNo, internalBuyer, allowCompleted);
  }, [orders, selectedPoNo, internalBuyer, allowCompleted]);

  // 5. Current Selected Style object
  const currentStyleObj = useMemo(() => {
    if (!selectedStyleNo) return null;
    return orders.find(o => o.styleNo.trim().toUpperCase() === selectedStyleNo.trim().toUpperCase()) || null;
  }, [orders, selectedStyleNo]);

  // 6. Available Colours (strictly belonging to the selected Style + PO)
  const availableColours = useMemo(() => {
    if (!selectedStyleNo || !selectedPoNo) return [];
    let cols = supabaseDataService.getColours(selectedStyleNo, selectedPoNo, allowCompleted);
    if (!allowCompleted) {
      cols = cols.filter(c => {
        if (c.colour === selectedColour) return true;
        const prog = supabaseDataService.getStylePoColourProgress(selectedStyleNo, selectedPoNo, c.colour);
        return !(prog.orderQty > 0 && prog.shippedQty >= prog.orderQty);
      });
    }
    return cols;
  }, [selectedStyleNo, selectedPoNo, allowCompleted, selectedColour, orders]);

  // 7. Current Selected Colour object
  const currentColourObj = useMemo(() => {
    if (!selectedColour || availableColours.length === 0) return null;
    return availableColours.find(
      c => c.colour.trim().toUpperCase() === selectedColour.trim().toUpperCase()
    ) || null;
  }, [availableColours, selectedColour]);

  // 8. Available Sizes for this Colour
  const availableSizes = useMemo(() => {
    if (!selectedStyleNo || !selectedPoNo || !selectedColour) {
      return ['All Sizes'];
    }
    const res = supabaseDataService.getSizes(selectedStyleNo, selectedPoNo, selectedColour);
    return res.sizes && res.sizes.length > 0 ? res.sizes : ['All Sizes'];
  }, [selectedStyleNo, selectedPoNo, selectedColour, orders]);

  // 9. Real-time Live Progress calculation from Supabase Service
  const liveProgress = useMemo(() => {
    if (!selectedStyleNo || !selectedPoNo || !selectedColour) return null;
    return supabaseDataService.getStylePoColourProgress(selectedStyleNo, selectedPoNo, selectedColour);
  }, [selectedStyleNo, selectedPoNo, selectedColour, orders]);

  // 10. Master combinations for quick search
  const allCombinations = useMemo(() => {
    return supabaseDataService.getAllOrderCombinations(allowCompleted);
  }, [orders, allowCompleted]);

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const query = searchQuery.toLowerCase().trim();
    return allCombinations.filter(c => c.searchText.includes(query)).slice(0, 8);
  }, [allCombinations, searchQuery]);

  // Handle cascading updates (Buyer -> PO -> Style -> Colour -> Size)
  const handleBuyerChange = (buyer: string) => {
    setInternalBuyer(buyer);
    const buyerPOs = supabaseDataService.getBuyerPOs(buyer, allowCompleted);
    if (buyerPOs.length === 1) {
      const po = buyerPOs[0];
      const poStyles = supabaseDataService.getPOStyles(po.poNo, buyer, allowCompleted);
      if (poStyles.length === 1) {
        const style = poStyles[0];
        const cols = supabaseDataService.getColours(style.styleNo, po.poNo, allowCompleted);
        if (cols.length === 1) {
          const col = cols[0];
          const sizeKeys = col.sizeQuantities ? Object.keys(col.sizeQuantities) : ['All Sizes'];
          triggerSelection(style.styleNo, po.poNo, col.colour, sizeKeys[0] || 'All Sizes', col.totalQty, buyer);
          return;
        }
        triggerSelection(style.styleNo, po.poNo, '', '', 0, buyer);
        return;
      }
      triggerSelection('', po.poNo, '', '', 0, buyer);
      return;
    }
    triggerSelection('', '', '', '', 0, buyer);
  };

  const handlePoChange = (poNo: string) => {
    if (!poNo) {
      triggerSelection('', '', '', '', 0, internalBuyer);
      return;
    }
    const poStyles = supabaseDataService.getPOStyles(poNo, internalBuyer, allowCompleted);
    const targetBuyer = (availablePOs.find(p => p.poNo === poNo)?.buyer) || internalBuyer;
    if (targetBuyer && targetBuyer !== 'ALL' && internalBuyer === 'ALL') {
      setInternalBuyer(targetBuyer);
    }

    if (poStyles.length === 1) {
      const style = poStyles[0];
      const cols = supabaseDataService.getColours(style.styleNo, poNo, allowCompleted);
      if (cols.length === 1) {
        const col = cols[0];
        const sizeKeys = col.sizeQuantities ? Object.keys(col.sizeQuantities) : ['All Sizes'];
        triggerSelection(style.styleNo, poNo, col.colour, sizeKeys[0] || 'All Sizes', col.totalQty, targetBuyer);
      } else {
        triggerSelection(style.styleNo, poNo, '', '', 0, targetBuyer);
      }
    } else {
      triggerSelection('', poNo, '', '', 0, targetBuyer);
    }
  };

  const handleStyleChange = (styleNo: string) => {
    if (!styleNo) {
      triggerSelection('', selectedPoNo, '', '', 0, internalBuyer);
      return;
    }
    const styleObj = orders.find(o => o.styleNo === styleNo);
    const buyer = styleObj?.buyer || internalBuyer;
    const cols = supabaseDataService.getColours(styleNo, selectedPoNo, allowCompleted);

    if (cols.length === 1) {
      const col = cols[0];
      const sizeKeys = col.sizeQuantities ? Object.keys(col.sizeQuantities) : ['All Sizes'];
      triggerSelection(styleNo, selectedPoNo, col.colour, sizeKeys[0] || 'All Sizes', col.totalQty, buyer);
    } else {
      triggerSelection(styleNo, selectedPoNo, '', '', 0, buyer);
    }
  };

  const handleColourChange = (colour: string) => {
    if (!colour) {
      triggerSelection(selectedStyleNo, selectedPoNo, '', '', 0, internalBuyer);
      return;
    }
    const colObj = availableColours.find(c => c.colour === colour);
    const sizeKeys = colObj?.sizeQuantities ? Object.keys(colObj.sizeQuantities) : ['All Sizes'];
    const chosenSize = selectedSize && sizeKeys.includes(selectedSize) ? selectedSize : (sizeKeys[0] || 'All Sizes');
    triggerSelection(selectedStyleNo, selectedPoNo, colour, chosenSize, colObj?.totalQty || 0, internalBuyer);
  };

  const handleSizeChange = (size: string) => {
    triggerSelection(selectedStyleNo, selectedPoNo, selectedColour, size, currentColourObj?.totalQty || 0, internalBuyer);
  };

  const triggerSelection = (
    styleNo: string,
    poNo: string,
    colour: string,
    size: string,
    colourOrderQty: number,
    buyerName?: string
  ) => {
    const details = supabaseDataService.getMasterOrderDetails(styleNo, poNo, colour, size);
    const sizeRem = supabaseDataService.getSizeRemaining(styleNo, poNo, colour, size, currentModule);
    onSelect({
      buyer: buyerName || details.buyer || internalBuyer,
      brand: details.brand,
      styleNo,
      styleName: details.styleName,
      garmentType: details.garmentType,
      season: details.season,
      poNo,
      poDate: details.poDate,
      deliveryDate: details.deliveryDate,
      shipmentDate: details.shipmentDate,
      unitPrice: details.unitPrice,
      currency: details.currency,
      orderStatus: details.orderStatus,
      colour,
      colourOrderQty: colourOrderQty || details.colourOrderQty || 0,
      size,
      availableSizes: details.availableSizes,
      sizeQuantities: details.sizeQuantities,
      sizeBreakdown: details.sizeBreakdown,
      selectedSizeBreakdown: details.selectedSizeBreakdown,
      sizeOrderQty: sizeRem.orderQty,
      sizeCompletedQty: sizeRem.completedQty,
      sizeRemainingQty: sizeRem.remainingQty,
      progress: details.progress
    });
  };

  // Active Size Info calculation
  const activeSizeInfo = useMemo(() => {
    if (!selectedStyleNo || !selectedPoNo || !selectedColour) return null;
    return supabaseDataService.getSizeRemaining(
      selectedStyleNo,
      selectedPoNo,
      selectedColour,
      selectedSize,
      currentModule
    );
  }, [selectedStyleNo, selectedPoNo, selectedColour, selectedSize, currentModule, liveProgress]);

  const handleSelectSearchResult = (combo: typeof allCombinations[0]) => {
    setInternalBuyer(combo.buyer);
    const details = supabaseDataService.getMasterOrderDetails(combo.styleNo, combo.poNo, combo.colour);
    const initialSize = combo.sizes.length > 0 ? combo.sizes[0] : 'All Sizes';
    triggerSelection(combo.styleNo, combo.poNo, combo.colour, initialSize, combo.orderQty, combo.buyer);
    setSearchQuery('');
    setIsSearchOpen(false);
    setShowDeptSelector(false);
  };

  // Compact Order Info badge for department users when an order is selected
  if (isDeptUser && selectedStyleNo && !showDeptSelector) {
    return (
      <div id="order-hierarchy-selector-container" className="p-2.5 px-3.5 bg-blue-50/90 border border-blue-200/90 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap text-slate-800 font-medium">
          <span className="font-extrabold text-blue-900 bg-blue-100/90 px-2 py-0.5 rounded text-[11px] uppercase tracking-wider">
            Active Order:
          </span>
          <span>Style: <strong className="text-blue-700 font-bold">{selectedStyleNo}</strong></span>
          {selectedPoNo && <span>• PO: <strong className="text-slate-900 font-bold">{selectedPoNo}</strong></span>}
          {selectedColour && <span>• Colour: <strong className="text-slate-900 font-bold">{selectedColour}</strong></span>}
          {selectedSize && <span>• Size: <strong className="text-purple-700 font-bold">{selectedSize}</strong></span>}
        </div>
        <button
          type="button"
          onClick={() => setShowDeptSelector(true)}
          className="text-[11px] font-bold text-blue-700 hover:text-blue-900 px-2.5 py-1 bg-white hover:bg-slate-50 rounded-lg border border-blue-200 shadow-2xs transition-colors flex items-center gap-1 shrink-0"
        >
          <span>Change Order</span>
        </button>
      </div>
    );
  }

  return (
    <div id="order-hierarchy-selector-container" className="space-y-3.5 bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 shadow-xs">
      {/* Header with Title, Active Breadcrumbs, Fast Typeahead Search & Reset */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200/80 pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-2xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                {customTitle}
                <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Master Data Linked
                </span>
              </h4>
              <p className="text-xs text-slate-500">
                Cascading selection: Buyer ➔ Style ➔ PO ➔ Colour ➔ Size
              </p>
            </div>
          </div>

          {/* Active Breadcrumb Chain */}
          {selectedStyleNo && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Selected Path:</span>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-bold border border-blue-200/80 text-[11px]">
                {internalBuyer || 'All Buyers'}
              </span>
              <span className="text-slate-400">➔</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-bold border border-indigo-200/80 text-[11px]">
                {selectedStyleNo}
              </span>
              {selectedPoNo && (
                <>
                  <span className="text-slate-400">➔</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80 text-[11px]">
                    PO: {selectedPoNo}
                  </span>
                </>
              )}
              {selectedColour && (
                <>
                  <span className="text-slate-400">➔</span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 font-bold border border-purple-200/80 text-[11px]">
                    {selectedColour}
                  </span>
                </>
              )}
              {selectedSize && (
                <>
                  <span className="text-slate-400">➔</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold border border-amber-200/80 text-[11px]">
                    Size: {selectedSize}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick Typeahead Search Box & Reset Action */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-80">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                id="order-quick-search-input"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                placeholder="Search Style, PO, Buyer, Color..."
                disabled={disabled}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 placeholder-slate-400 shadow-2xs font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 w-5 h-5 rounded-full flex items-center justify-center transition"
                >
                  ×
                </button>
              )}
            </div>

            {/* Search Dropdown Results */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100">
                <div className="p-2 bg-slate-50 text-[11px] font-bold text-slate-600 flex items-center justify-between">
                  <span>Matching Orders ({searchResults.length})</span>
                  <span className="text-[10px] text-slate-400">Click to select</span>
                </div>
                {searchResults.map(res => (
                  <button
                    key={res.key}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-blue-50/80 transition-colors flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-blue-700">{res.styleNo}</span>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{res.buyer}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>PO: <strong className="text-slate-900 font-bold">{res.poNo}</strong> | Color: <strong className="text-purple-700">{res.colour}</strong></span>
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                        {res.orderQty.toLocaleString()} pcs
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedStyleNo && (
            <button
              type="button"
              onClick={() => {
                setInternalBuyer('ALL');
                handleStyleChange('');
                setSearchQuery('');
              }}
              className="px-2.5 py-2 text-xs font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 rounded-xl transition shadow-2xs shrink-0 flex items-center gap-1"
              title="Reset All Selection"
            >
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Cascading Dropdowns Row with Refined Stepper Badges */}
      <div
        className={
          layout === 'compact'
            ? 'grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5'
            : showSizeSelector
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3'
            : 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3'
        }
      >
        {/* 1. Buyer Selector */}
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 transition-all">
          <label htmlFor="selector-buyer-dropdown" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-extrabold">1</span>
              Buyer
            </span>
            <span className="text-[10px] font-normal text-slate-400 font-mono">({availableBuyers.length})</span>
          </label>
          <div className="relative">
            <select
              id="selector-buyer-dropdown"
              value={internalBuyer}
              onChange={e => handleBuyerChange(e.target.value)}
              disabled={disabled}
              className="w-full text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold appearance-none transition"
            >
              <option value="ALL">All Buyers ({availableBuyers.length})</option>
              {availableBuyers.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* 2. PO Selector */}
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all">
          <label htmlFor="selector-po-dropdown" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-extrabold">2</span>
              PO No <span className="text-red-500">*</span>
            </span>
            <span className="text-[10px] font-normal text-slate-400 font-mono">({availablePOs.length})</span>
          </label>
          <div className="relative">
            <select
              id="selector-po-dropdown"
              value={selectedPoNo}
              onChange={e => handlePoChange(e.target.value)}
              disabled={disabled || availablePOs.length === 0}
              className="w-full text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold appearance-none disabled:bg-slate-100 disabled:text-slate-400 transition"
            >
              <option value="">
                {availablePOs.length === 0
                  ? 'No POs configured'
                  : `-- Select PO (${availablePOs.length}) --`}
              </option>
              {availablePOs.map(p => (
                <option key={p.id || p.poNo} value={p.poNo}>
                  {p.poNo} ({p.totalPoQty?.toLocaleString() || 0} pcs)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* 3. Style Selector */}
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition-all">
          <label htmlFor="selector-style-dropdown" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-extrabold">3</span>
              Style No <span className="text-red-500">*</span>
            </span>
            <span className="text-[10px] font-normal text-slate-400 font-mono">({availableStyles.length})</span>
          </label>
          <div className="relative">
            <select
              id="selector-style-dropdown"
              value={selectedStyleNo}
              onChange={e => handleStyleChange(e.target.value)}
              disabled={disabled || availableStyles.length === 0}
              className="w-full text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold appearance-none disabled:bg-slate-100 disabled:text-slate-400 transition"
            >
              <option value="">
                {availableStyles.length === 0
                  ? 'No Styles configured'
                  : `-- Select Style (${availableStyles.length}) --`}
              </option>
              {availableStyles.map(s => (
                <option key={s.id || s.styleNo} value={s.styleNo}>
                  {s.styleNo} - {s.styleName || s.garmentType}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* 4. Colour Selector */}
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-purple-300 transition-all">
          <label htmlFor="selector-colour-dropdown" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-extrabold">4</span>
              Colour <span className="text-red-500">*</span>
            </span>
            {selectedStyleNo && selectedPoNo && <span className="text-[10px] font-normal text-slate-400 font-mono">({availableColours.length})</span>}
          </label>
          <div className="relative">
            <select
              id="selector-colour-dropdown"
              value={selectedColour}
              onChange={e => handleColourChange(e.target.value)}
              disabled={disabled || !selectedStyleNo || !selectedPoNo || availableColours.length === 0}
              className="w-full text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold appearance-none disabled:bg-slate-100 disabled:text-slate-400 transition"
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
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* 5. Size Selector (Optional/Module dependent) */}
        {showSizeSelector && (
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs hover:border-amber-300 transition-all">
            <label htmlFor="selector-size-dropdown" className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-extrabold">5</span>
                Size {requireSize && <span className="text-red-500">*</span>}
              </span>
              {selectedColour && <span className="text-[10px] font-normal text-slate-400 font-mono">({availableSizes.length})</span>}
            </label>
            <div className="relative">
              <select
                id="selector-size-dropdown"
                value={selectedSize || 'All Sizes'}
                onChange={e => handleSizeChange(e.target.value)}
                disabled={disabled || !selectedColour}
                className="w-full text-xs bg-slate-50 hover:bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold appearance-none disabled:bg-slate-100 disabled:text-slate-400 transition"
              >
                {availableSizes.map(sz => {
                  const item = liveProgress?.sizeBreakdown?.find(s => s.size.trim().toUpperCase() === sz.trim().toUpperCase());
                  let balText = '';
                  if (item) {
                    if (currentModule === 'Cutting') {
                      balText = `Order: ${item.orderQty} | Done: ${item.cutQty} | Rem: ${item.cutBalance}`;
                    } else if (currentModule === 'Sewing') {
                      const rQty = item.sewingReceivedQty ?? item.receivedQty ?? item.orderQty;
                      balText = `Receive: ${rQty} | Done: ${item.sewOutput} | Rem: ${item.sewBalance}`;
                    } else if (currentModule === 'Finishing') {
                      const rQty = item.finishingReceivedQty ?? item.receivedQty ?? item.orderQty;
                      balText = `Receive: ${rQty} | Done: ${item.finQty} | Rem: ${item.finBalance}`;
                    } else if (currentModule === 'Packing') {
                      const rQty = item.packingReceivedQty ?? item.receivedQty ?? item.orderQty;
                      balText = `Receive: ${rQty} | Done: ${item.packedQty} | Rem: ${item.packBalance}`;
                    } else if (currentModule === 'Shipment') {
                      const rQty = item.shipmentReceivedQty ?? item.receivedQty ?? item.orderQty;
                      balText = `Receive: ${rQty} | Done: ${item.shippedQty} | Rem: ${item.shipBalance}`;
                    } else {
                      const rQty = item.receivedQty ?? item.orderQty;
                      balText = `Receive: ${rQty} | Rem: ${item.overallBalance}`;
                    }
                  } else {
                    const q = currentColourObj?.sizeQuantities?.[sz] || 0;
                    balText = q > 0 ? (currentModule === 'Cutting' ? `Order: ${q} pcs` : `Receive: ${q} pcs`) : 'Batch';
                  }

                  return (
                    <option key={sz} value={sz}>
                      {sz === 'All Sizes' ? `All Sizes (${balText})` : `Size ${sz} (${balText})`}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Active Size Context & Live Remaining Quantity Highlight Banner */}
      {selectedStyleNo && selectedPoNo && selectedColour && activeSizeInfo && (
        <div id="order-size-context-banner" className="rounded-xl border border-slate-800 bg-slate-900 text-white p-3 shadow-md space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Size Context Indicator & Master Info */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-black text-xs shadow-xs border border-blue-400/40 tracking-wider">
                {activeSizeInfo.size === 'All Sizes' ? 'ALL SIZES (BATCH)' : `SIZE ${activeSizeInfo.size}`}
              </span>
              <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                <span>Style: <strong className="text-white font-bold">{selectedStyleNo}</strong></span>
                <span className="text-slate-600">•</span>
                <span>PO: <strong className="text-white font-bold">{selectedPoNo}</strong></span>
                <span className="text-slate-600">•</span>
                <span className="text-purple-300 font-bold">{selectedColour}</span>
              </div>
            </div>

            {/* Right: Metrics Chips */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <div className="bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 shadow-2xs flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">{currentModule === 'Cutting' ? 'Order' : 'Receive'}</span>
                <span className="text-xs font-bold text-white font-mono">{((currentModule === 'Cutting' ? activeSizeInfo.orderQty : (activeSizeInfo.receiveQty ?? activeSizeInfo.orderQty)) || 0).toLocaleString()} pcs</span>
              </div>

              <div className="bg-slate-800/90 px-2.5 py-1 rounded-lg border border-blue-900/60 shadow-2xs flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-blue-400">{currentModule === 'General' ? 'Done' : currentModule}</span>
                <span className="text-xs font-bold text-blue-300 font-mono">{activeSizeInfo.completedQty.toLocaleString()} pcs</span>
              </div>

              <div className={`px-2.5 py-1 rounded-lg border shadow-2xs flex items-center gap-1.5 ${
                activeSizeInfo.remainingQty === 0
                  ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300'
                  : 'bg-rose-950/80 border-rose-800/60 text-rose-300'
              }`}>
                <span className="text-[10px] uppercase font-bold opacity-80">Remaining</span>
                <span className="text-xs font-black font-mono">{activeSizeInfo.remainingQty.toLocaleString()} pcs</span>
              </div>

              <div className="bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 shadow-2xs flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 font-mono">{activeSizeInfo.percentage}%</span>
                <div className="w-12 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, activeSizeInfo.percentage)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row: Fast One-Click Size Pills Carousel */}
          {availableSizes.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-800/80 pb-0.5 whitespace-nowrap">
              <span className="text-[10px] uppercase font-extrabold text-slate-400 shrink-0 mr-1">
                Quick Sizes:
              </span>
              {availableSizes.map(sz => {
                const isSzActive = (selectedSize || 'All Sizes') === sz;
                const szItem = liveProgress?.sizeBreakdown?.find(s => s.size.trim().toUpperCase() === sz.trim().toUpperCase());
                let szRem = 0;
                if (szItem) {
                  if (currentModule === 'Cutting') szRem = szItem.cutBalance;
                  else if (currentModule === 'Sewing') szRem = szItem.sewBalance;
                  else if (currentModule === 'Finishing') szRem = szItem.finBalance;
                  else if (currentModule === 'Packing') szRem = szItem.packBalance;
                  else if (currentModule === 'Shipment') szRem = szItem.shipBalance;
                  else szRem = szItem.overallBalance;
                }

                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => handleSizeChange(sz)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 shrink-0 ${
                      isSzActive
                        ? 'bg-blue-600 text-white shadow-xs ring-2 ring-white/50 scale-105'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                    }`}
                  >
                    <span>{sz}</span>
                    {szItem && szItem.orderQty > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-extrabold ${
                        szRem === 0 ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                      }`}>
                        {szRem === 0 ? '✓ Done' : `Rem:${szRem}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Size-Wise Breakdown Live Matrix */}
      {showSizeMatrix && selectedStyleNo && selectedPoNo && selectedColour && liveProgress?.sizeBreakdown && liveProgress.sizeBreakdown.length > 0 && (
        <SizeBreakdownMatrix
          sizeBreakdown={liveProgress.sizeBreakdown}
          selectedSize={selectedSize}
          onSelectSize={handleSizeChange}
          currentModule={currentModule}
          title={`Size-Wise Production Breakdown & Remaining Balances (${selectedStyleNo} - PO: ${selectedPoNo} - ${selectedColour})`}
        />
      )}

      {/* Real-time Supabase Auto-Fill & Production Context Banner (Restricted: Visible strictly to GM, MD, Director, and ADMIN) */}
      {showSummaryCard && canViewExecutiveSummary && selectedStyleNo && selectedPoNo && selectedColour && liveProgress && (
        <div id="order-autofill-summary-card" className="mt-3 bg-white border border-blue-200/80 rounded-xl p-3.5 shadow-sm">
          {/* Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                {liveProgress.buyer}
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {liveProgress.styleName || currentStyleObj?.garmentType}
              </span>
              {currentStyleObj?.season && (
                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {currentStyleObj.season}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded uppercase tracking-wider">
                GM / MD / Admin View
              </span>
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Delivery: <strong>{liveProgress.deliveryDate || currentPoObj?.deliveryDate || 'TBD'}</strong>
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[11px]">
                {liveProgress.orderStatus || 'Running'}
              </span>
            </div>
          </div>

          {/* Master Quantity & Size Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2.5 border-b border-slate-100 text-xs">
            <div>
              <div className="text-slate-400 text-[11px]">Booked Order Qty</div>
              <div className="font-bold text-slate-900 text-sm">
                {liveProgress.orderQty.toLocaleString()} pcs
              </div>
            </div>

            <div>
              <div className="text-slate-400 text-[11px]">Current Milestone</div>
              <div className="font-semibold text-blue-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {liveProgress.currentStage}
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="text-slate-400 text-[11px] mb-1">Defined Size Quantities</div>
              <div className="flex flex-wrap gap-1">
                {currentColourObj?.sizeQuantities &&
                Object.keys(currentColourObj.sizeQuantities).length > 0 ? (
                  Object.entries(currentColourObj.sizeQuantities).map(([sz, qty]) => (
                    <span
                      key={sz}
                      className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono"
                    >
                      <strong>{sz}:</strong> {qty}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px]">Standard size breakdown applied</span>
                )}
              </div>
            </div>
          </div>

          {/* Live Progress Bar Across All Production Stages */}
          <div className="pt-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1.5">
              <span>Live Factory Pipeline (Auto-Calculated from Transactions)</span>
              <span className="text-blue-600">
                Packed: {liveProgress.packedQty.toLocaleString()} / {liveProgress.orderQty.toLocaleString()} pcs ({liveProgress.overallProgressPct}%)
              </span>
            </div>

            {/* Department Progress Badges */}
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5 text-center text-[10px]">
              <div className="bg-slate-50 border border-slate-200 rounded p-1">
                <div className="text-slate-500 flex items-center justify-center gap-0.5 font-medium">
                  <Scissors className="w-2.5 h-2.5" /> Cut
                </div>
                <div className="font-bold text-slate-800">{liveProgress.cutQty.toLocaleString()}</div>
                <div className="text-[9px] text-slate-400">Bal: {liveProgress.cutBalance}</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-1">
                <div className="text-slate-500 flex items-center justify-center gap-0.5 font-medium">
                  <Shirt className="w-2.5 h-2.5" /> Sew
                </div>
                <div className="font-bold text-blue-700">{liveProgress.sewOutput.toLocaleString()}</div>
                <div className="text-[9px] text-slate-400">Bal: {liveProgress.sewBalance}</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-1">
                <div className="text-slate-500 flex items-center justify-center gap-0.5 font-medium">
                  <Sparkles className="w-2.5 h-2.5" /> Wash
                </div>
                <div className="font-bold text-indigo-700">{liveProgress.washReceivedQty.toLocaleString()}</div>
                <div className="text-[9px] text-slate-400">Bal: {liveProgress.washBalance}</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-1">
                <div className="text-slate-500 flex items-center justify-center gap-0.5 font-medium">
                  <CheckSquare className="w-2.5 h-2.5" /> Finish
                </div>
                <div className="font-bold text-purple-700">{liveProgress.finQty.toLocaleString()}</div>
                <div className="text-[9px] text-slate-400">Bal: {liveProgress.finBalance}</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-1">
                <div className="text-slate-500 flex items-center justify-center gap-0.5 font-medium">
                  <TrendingUp className="w-2.5 h-2.5" /> QC Pass
                </div>
                <div className="font-bold text-emerald-700">{liveProgress.qcPassedQty.toLocaleString()}</div>
                <div className="text-[9px] text-slate-400">{liveProgress.qcPassRatePct}% pass</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-1">
                <div className="text-slate-500 flex items-center justify-center gap-0.5 font-medium">
                  <Box className="w-2.5 h-2.5" /> Pack
                </div>
                <div className="font-bold text-amber-700">{liveProgress.packedQty.toLocaleString()}</div>
                <div className="text-[9px] text-slate-400">Bal: {liveProgress.packBalance}</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded p-1">
                <div className="text-slate-500 flex items-center justify-center gap-0.5 font-medium">
                  <Truck className="w-2.5 h-2.5" /> Ship
                </div>
                <div className="font-bold text-slate-800">{liveProgress.shippedQty.toLocaleString()}</div>
                <div className="text-[9px] text-slate-400">Bal: {liveProgress.shipBalance}</div>
              </div>
            </div>

            {/* Department Guidance Pill */}
            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50/80 px-2.5 py-1.5 rounded-lg border border-blue-100">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>
                {currentModule === 'Cutting' && `Order Qty: ${liveProgress.orderQty} pcs. Fabric allocation will be verified against Store.`}
                {currentModule === 'Sewing' && `Available Cut Input: ${liveProgress.cutQty} pcs. Prior Output: ${liveProgress.sewOutput} pcs. WIP: ${liveProgress.sewWip} pcs.`}
                {currentModule === 'Washing' && `Sewing Completed: ${liveProgress.sewOutput} pcs available to send for washing.`}
                {currentModule === 'Finishing' && `Washing Received: ${liveProgress.washReceivedQty} pcs available to finish.`}
                {currentModule === 'QC' && `Production Output: ${liveProgress.sewOutput} pcs ready for inline / endline quality inspection.`}
                {currentModule === 'Packing' && `Finished Goods: ${liveProgress.finQty} pcs ready for carton packaging.`}
                {currentModule === 'Shipment' && `Packed Goods: ${liveProgress.packedQty} pcs (${liveProgress.cartonCount} cartons) ready for container dispatch.`}
                {currentModule === 'Store' && `Linked to Style ${liveProgress.styleNo} | PO ${liveProgress.poNo} | ${liveProgress.colour}.`}
                {currentModule === 'Sample' && `Developing pre-production / size set sample for Buyer ${liveProgress.buyer}.`}
                {currentModule === 'Merchandising' && `BOM & T&A active for ${liveProgress.styleNo} (${liveProgress.orderQty} pcs).`}
                {currentModule === 'General' && `Connected to Master Order ${liveProgress.styleNo} (${liveProgress.buyer}).`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
