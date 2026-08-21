import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit,
  Eye,
  Trash2,
  AlertCircle,
  Building2,
  Layers,
  FileSpreadsheet,
  Palette,
  Ruler,
  CheckCircle2,
  Calendar,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  Scissors,
  Shirt,
  Sparkles,
  CheckSquare,
  Box,
  Truck,
  ArrowRight,
  PlusCircle,
  X,
  ChevronDown,
  ChevronRight,
  Percent,
  Calculator,
  Tag,
  Minimize2,
  Maximize2,
  Copy,
  ExternalLink,
  Save,
  Check,
  ChevronUp,
  AlertTriangle,
  FolderOpen,
  ArrowUpDown,
  Lock,
  UserCheck,
  Shield,
  Database,
  ShieldCheck,
  Activity,
  Scale,
  CheckCheck,
  RefreshCw,
  Droplets
} from 'lucide-react';
import { supabaseDataService, generateUUID } from '../../../services/supabaseDataService';
import { OrderStyle, PurchaseOrder, ColourQty, OrderStatus, MasterDataItem } from '../../../types';
import { calculateSizeWiseAllowance, calculateSingleSizeFactoryQty } from '../../../utils/allowanceUtils';
import { PageHeader } from '../../common/PageHeader';
import { DataTable, Column } from '../../common/DataTable';
import { StatusBadge } from '../../common/StatusBadge';
import { Modal } from '../../common/Modal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { PermissionGuard } from '../../common/PermissionGuard';
import { useAuth } from '../../../context/AuthContext';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import {
  filterOrdersForUser,
  canAccessOrder,
  isGlobalUser,
  canUserAddPoForBuyer,
  getBuyerCreatorInfo,
  isMD
} from '../../../utils/authUtils';

export interface FormPOStyle {
  id?: string;
  styleNo: string;
  styleName: string;
  garmentType: string;
  season: string;
  isWashGarment?: boolean;
  washType?: string;
  allowancePct: number;
  allowanceQty?: number;
  factoryOrderQty?: number;
  unitPrice: number | ''; // Style-specific FOB override
  selectedMatrixId?: string;
  colours: Array<{
    colour: string;
    totalQty: number;
    allowancePct?: number;
    allowanceQty?: number;
    factoryQty?: number;
    sizeQuantities: Record<string, number>;
    factorySizeQuantities?: Record<string, number>;
    allowanceSizeQuantities?: Record<string, number>;
  }>;
}

export interface POEditorCardState {
  id: string; // unique draft/card id
  isNew: boolean;
  isCollapsed: boolean;
  originalPoNo?: string;
  buyer: string;
  brand: string;
  poNo: string;
  poDate: string;
  deliveryDate: string;
  shipmentDate: string;
  unitPrice: number | ''; // FOB Rate ($)
  currency: 'USD' | 'BDT' | 'EUR';
  allowancePct?: number; // PO Default Factory Allowance %
  status: OrderStatus;
  remarks: string;
  selectedMatrixId: string;
  styles: FormPOStyle[];
  isSaving?: boolean;
}

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  'Running',
  'Confirmed',
  'Hold',
  'Completed',
  'Shipped',
  'Draft',
  'Cancelled'
];

export const OrderManagement: React.FC = () => {
  const { currentUser, canOperate, canDelete } = useAuth();
  const [orders, setOrders] = useState<OrderStyle[]>(supabaseDataService.getOrders());
  const [masterVersion, setMasterVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<'buyer_workspace' | 'pos' | 'styles' | 'hierarchy_explorer'>('buyer_workspace');

  // Master Data lists from Master Data Configuration
  const masterBuyers = useMemo(() => supabaseDataService.getMasterBuyers(), [masterVersion]);
  const masterBrands = useMemo(() => supabaseDataService.getMasterBrands(), [masterVersion]);
  const masterGarmentTypes = useMemo(() => supabaseDataService.getMasterGarmentTypes(), [masterVersion]);
  const masterSeasons = useMemo(() => supabaseDataService.getMasterSeasons(), [masterVersion]);
  const masterColours = useMemo(() => supabaseDataService.getMasterColours(), [masterVersion]);
  const masterSizeMatrices = useMemo(() => supabaseDataService.getMasterSizeMatrices(), [masterVersion]);
  const masterWashTypes = useMemo(() => supabaseDataService.getMasterWashTypes(), [masterVersion]);
  const allBuyerMasterData = useMemo(() => supabaseDataService.getMasterDataByCategory('Buyer'), [masterVersion]);

  // Structured PO list (Buyer -> PO -> Multiple Styles -> Colours -> Sizes)
  const structuredPOs = useMemo(() => {
    return supabaseDataService.getStructuredPurchaseOrders(undefined, true);
  }, [orders, masterVersion]);

  // User-based order privacy filtering
  const visibleOrders = useMemo(() => {
    return filterOrdersForUser(orders, currentUser);
  }, [orders, currentUser]);

  const visiblePOs = useMemo(() => {
    return filterOrdersForUser(structuredPOs, currentUser);
  }, [structuredPOs, currentUser]);

  const isExecutiveOrAdmin = useMemo(() => isGlobalUser(currentUser), [currentUser]);

  // Group structured POs by Buyer for Buyer-Centric Multi-PO View
  const buyerGroups = useMemo(() => {
    const map = new Map<string, {
      buyer: string;
      brand: string;
      pos: typeof visiblePOs;
      totalOrderQty: number;
      totalFactoryQty: number;
      totalValue: number;
      stylesCount: number;
    }>();

    visiblePOs.forEach(p => {
      const bKey = (p.buyer || 'Unknown Buyer').trim();
      if (!map.has(bKey)) {
        map.set(bKey, {
          buyer: bKey,
          brand: p.brand || '',
          pos: [],
          totalOrderQty: 0,
          totalFactoryQty: 0,
          totalValue: 0,
          stylesCount: 0
        });
      }
      const grp = map.get(bKey)!;
      grp.pos.push(p);
      grp.totalOrderQty += p.totalOrderQty || 0;
      grp.totalFactoryQty += p.totalFactoryQty || p.totalOrderQty || 0;
      grp.totalValue += p.totalValue || 0;
      grp.stylesCount += p.stylesCount || p.styles?.length || 0;
    });

    return Array.from(map.values()).sort((a, b) => b.totalOrderQty - a.totalOrderQty);
  }, [visiblePOs]);

  // Selected Buyer in the Workspace
  const [selectedWorkspaceBuyer, setSelectedWorkspaceBuyer] = useState<string>('');

  // Initialize selected buyer if empty
  useEffect(() => {
    if (!selectedWorkspaceBuyer && buyerGroups.length > 0) {
      setSelectedWorkspaceBuyer(buyerGroups[0].buyer);
    } else if (!selectedWorkspaceBuyer && masterBuyers.length > 0) {
      setSelectedWorkspaceBuyer(masterBuyers[0]);
    }
  }, [buyerGroups, masterBuyers, selectedWorkspaceBuyer]);

  // --- STACKED PO EDITORS FOR SELECTED BUYER ---
  const [buyerPoCards, setBuyerPoCards] = useState<POEditorCardState[]>([]);

  // Load existing POs of the selected buyer into cards or synchronize
  useEffect(() => {
    if (!selectedWorkspaceBuyer) return;

    const buyerData = buyerGroups.find(
      b => b.buyer.trim().toLowerCase() === selectedWorkspaceBuyer.trim().toLowerCase()
    );

    if (buyerData && buyerData.pos.length > 0) {
      setBuyerPoCards(prev => {
        // Keep unsaved newly added cards
        const newUnsavedCards = prev.filter(c => c.isNew && c.buyer === selectedWorkspaceBuyer);

        // Convert existing POs to cards with latest database state
        const existingCards: POEditorCardState[] = buyerData.pos.map(po => {
          const existingInPrev = prev.find(p => p.originalPoNo === po.poNo || p.poNo === po.poNo);
          const isCollapsed = existingInPrev ? existingInPrev.isCollapsed : true;
          const selectedMatrixId = existingInPrev?.selectedMatrixId || masterSizeMatrices[0]?.id || '';

          return {
            id: `po-card-${po.poNo}`,
            isNew: false,
            isCollapsed,
            originalPoNo: po.poNo,
            buyer: po.buyer,
            brand: po.brand || '',
            poNo: po.poNo,
            poDate: po.poDate || new Date().toISOString().substring(0, 10),
            deliveryDate: po.deliveryDate || '',
            shipmentDate: po.shipmentDate || '',
            unitPrice: po.unitPrice || 0,
            currency: po.currency || 'USD',
            allowancePct: Number((po as any).allowancePct ?? (po.styles && po.styles[0]?.allowancePct) ?? 3),
            status: po.status,
            remarks: po.remarks || '',
            selectedMatrixId,
            styles: (po.styles && po.styles.length > 0)
              ? po.styles.map(st => {
                  const styleAllowance = Number(st.allowancePct ?? 3);
                  const isWash = st.isWashGarment !== undefined ? Boolean(st.isWashGarment) : supabaseDataService.isStyleWashGarment(st.styleNo);
                  const wType = st.washType || (isWash ? 'Enzyme Wash' : undefined);
                  const cleanColours = st.colours.map(c => {
                    const colAllowance = Number(c.allowancePct ?? styleAllowance);
                    const sizeWise = calculateSizeWiseAllowance(c.sizeQuantities || {}, colAllowance);
                    const colOrderQty = sizeWise.totalOrderQty > 0 ? sizeWise.totalOrderQty : (Number(c.totalQty) || 0);
                    const colFactoryQty = sizeWise.totalFactoryQty > 0 ? sizeWise.totalFactoryQty : (Number(c.factoryQty) || Math.round(colOrderQty * (1 + colAllowance / 100)));
                    const colAllowanceQty = Math.max(0, colFactoryQty - colOrderQty);

                    return {
                      colour: c.colour,
                      totalQty: colOrderQty,
                      allowancePct: colAllowance,
                      allowanceQty: colAllowanceQty,
                      factoryQty: colFactoryQty,
                      sizeQuantities: sizeWise.sizeQuantities,
                      factorySizeQuantities: sizeWise.factorySizeQuantities,
                      allowanceSizeQuantities: sizeWise.allowanceSizeQuantities
                    };
                  });

                  const styleOrderQty = cleanColours.reduce((sum, c) => sum + c.totalQty, 0);
                  const styleFactoryQty = cleanColours.reduce((sum, c) => sum + (c.factoryQty || c.totalQty), 0);
                  const styleAllowanceQty = Math.max(0, styleFactoryQty - styleOrderQty);

                  return {
                    styleNo: st.styleNo,
                    styleName: st.styleName,
                    garmentType: st.garmentType,
                    season: st.season,
                    isWashGarment: isWash,
                    washType: wType,
                    allowancePct: styleAllowance,
                    allowanceQty: styleAllowanceQty,
                    factoryOrderQty: styleFactoryQty,
                    unitPrice: st.unitPrice || '',
                    colours: cleanColours
                  };
                })
              : [
                  (() => {
                    const defaultSizeWise = calculateSizeWiseAllowance({ '32': po.totalOrderQty || 1000 }, 3);
                    return {
                      styleNo: 'STYLE-DEFAULT',
                      styleName: 'Default Garment Style',
                      garmentType: 'Denim Bottom',
                      season: 'SS 2026',
                      isWashGarment: true,
                      washType: 'Enzyme Wash',
                      allowancePct: 3,
                      allowanceQty: defaultSizeWise.totalAllowanceQty,
                      factoryOrderQty: defaultSizeWise.totalFactoryQty,
                      unitPrice: '',
                      colours: [
                        {
                          colour: 'Standard',
                          totalQty: defaultSizeWise.totalOrderQty,
                          allowancePct: 3,
                          allowanceQty: defaultSizeWise.totalAllowanceQty,
                          factoryQty: defaultSizeWise.totalFactoryQty,
                          sizeQuantities: defaultSizeWise.sizeQuantities,
                          factorySizeQuantities: defaultSizeWise.factorySizeQuantities,
                          allowanceSizeQuantities: defaultSizeWise.allowanceSizeQuantities
                        }
                      ]
                    };
                  })()
                ]
          };
        });

        return [...existingCards, ...newUnsavedCards];
      });
    } else {
      // If buyer has no existing POs yet and no cards exist, initialize an empty list
      setBuyerPoCards(prev => prev.filter(c => c.isNew && c.buyer === selectedWorkspaceBuyer));
    }
  }, [selectedWorkspaceBuyer, buyerGroups, masterSizeMatrices]);

  // Expanded PO cards in PO Directory
  const [expandedDirectoryPOs, setExpandedDirectoryPOs] = useState<Record<string, boolean>>({});
  const [directorySearchFilter, setDirectorySearchFilter] = useState('');

  const toggleExpandDirectoryPO = (poNo: string) => {
    setExpandedDirectoryPOs(prev => ({ ...prev, [poNo]: !prev[poNo] }));
  };

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [poToDelete, setPoToDelete] = useState<{ poNo: string; buyer: string; historyInfo?: any } | null>(null);

  // Quick FOB Edit Modal State
  const [quickFobModalOpen, setQuickFobModalOpen] = useState(false);
  const [quickFobTarget, setQuickFobTarget] = useState<{
    poNo: string;
    buyer: string;
    styleNo?: string;
    currentFob: number;
    newFob: number | '';
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add Buyer to Master Data Modal State
  const [showAddBuyerModal, setShowAddBuyerModal] = useState(false);
  const [newBuyerForm, setNewBuyerForm] = useState({
    name: '',
    code: '',
    brand: '',
    country: '',
    description: ''
  });
  const [isSavingBuyer, setIsSavingBuyer] = useState(false);
  const [addBuyerError, setAddBuyerError] = useState<string | null>(null);

  // Handler to persist new buyer to Supabase / Master Data
  const handleSaveNewBuyer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newBuyerForm.name.trim();
    if (!cleanName) {
      setAddBuyerError('Please enter a valid Buyer Name.');
      return;
    }

    // Check if buyer already exists in Master Data or visible list
    const alreadyExists = masterBuyers.some(
      b => b.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (alreadyExists) {
      setAddBuyerError(`Buyer "${cleanName}" already exists in Master Data.`);
      return;
    }

    setIsSavingBuyer(true);
    setAddBuyerError(null);

    try {
      const buyerCode = newBuyerForm.code.trim()
        ? (newBuyerForm.code.trim().toUpperCase().startsWith('BUY-') ? newBuyerForm.code.trim().toUpperCase() : `BUY-${newBuyerForm.code.trim().toUpperCase()}`)
        : `BUY-${cleanName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;

      const descParts: string[] = [];
      if (newBuyerForm.brand.trim()) descParts.push(`Brand: ${newBuyerForm.brand.trim()}`);
      if (newBuyerForm.country.trim()) descParts.push(`Country: ${newBuyerForm.country.trim()}`);
      if (newBuyerForm.description.trim()) descParts.push(newBuyerForm.description.trim());
      const finalDesc = descParts.join(' | ') || 'Master Buyer created from Order Management';

      const newBuyerItem: MasterDataItem = {
        id: generateUUID(),
        category: 'Buyer',
        code: buyerCode,
        name: cleanName,
        description: finalDesc,
        status: 'Active',
        createdBy: currentUser?.name || currentUser?.username || currentUser?.email || 'Merchandising',
        creatorEmail: currentUser?.email,
        createdDepartment: currentUser?.department || 'Merchandising'
      };

      const res = await supabaseDataService.saveMasterItem(
        newBuyerItem,
        currentUser?.name || currentUser?.email,
        currentUser?.email,
        currentUser?.department
      );

      // If associated brand is provided, also register the Brand in Master Data if not already present
      if (newBuyerForm.brand.trim()) {
        const brandName = newBuyerForm.brand.trim();
        const brandExists = masterBrands.some(b => b.trim().toLowerCase() === brandName.toLowerCase());
        if (!brandExists) {
          await supabaseDataService.saveMasterItem({
            id: generateUUID(),
            category: 'Brand',
            code: `BRD-${brandName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`,
            name: brandName,
            description: `Associated with Buyer: ${cleanName}`,
            status: 'Active',
            createdBy: currentUser?.name || currentUser?.username || currentUser?.email || 'Merchandising',
            creatorEmail: currentUser?.email,
            createdDepartment: currentUser?.department || 'Merchandising'
          }, currentUser?.name || currentUser?.email, currentUser?.email, currentUser?.department);
        }
      }

      if (res.success) {
        setMasterVersion(v => v + 1);
        setSelectedWorkspaceBuyer(cleanName);
        setShowAddBuyerModal(false);
        setNewBuyerForm({ name: '', code: '', brand: '', country: '', description: '' });
        setSuccessMessage(`Buyer "${cleanName}" has been successfully added to Master Data and selected.`);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setAddBuyerError(res.error || 'Failed to save buyer to Master Data.');
      }
    } catch (err: any) {
      setAddBuyerError(err.message || 'An unexpected error occurred while saving buyer.');
    } finally {
      setIsSavingBuyer(false);
    }
  };

  // Hierarchy Explorer States (Buyer -> PO -> Style -> Colour -> Size)
  const [explorerBuyer, setExplorerBuyer] = useState<string>('');
  const [explorerPoNo, setExplorerPoNo] = useState<string>('');
  const [explorerStyleNo, setExplorerStyleNo] = useState<string>('');

  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [isRefreshingRealtime, setIsRefreshingRealtime] = useState(false);

  useEffect(() => {
    setOrders(supabaseDataService.getOrders());
    setLastSyncTime(new Date().toLocaleTimeString());
    const unsub = supabaseDataService.subscribe(() => {
      setOrders([...supabaseDataService.getOrders()]);
      setMasterVersion(v => v + 1);
      setLastSyncTime(new Date().toLocaleTimeString());
    });
    return unsub;
  }, []);

  const handleTriggerRealtimeRefresh = async () => {
    setIsRefreshingRealtime(true);
    await supabaseDataService.initializeFromSupabase();
    setOrders([...supabaseDataService.getOrders()]);
    setMasterVersion(v => v + 1);
    setLastSyncTime(new Date().toLocaleTimeString());
    setTimeout(() => setIsRefreshingRealtime(false), 500);
  };

  // Real-Time Summary & Aggregation Metrics (Real-Time Database Sanity Check)
  const stats = useMemo(() => {
    let totalOrderQty = 0;
    let totalFactoryQty = 0;
    let totalValue = 0;
    let activeOrderQty = 0;
    let activeOrderValue = 0;
    let sizeBreakdownTotal = 0;
    let totalSizesCount = 0;
    const buyersSet = new Set<string>();
    const stylesSet = new Set<string>();

    visiblePOs.forEach(p => {
      if (p.buyer) buyersSet.add(p.buyer);
      const poQty = Number(p.totalOrderQty || 0);
      const poVal = Number(p.totalValue || 0);
      const poFactQty = Number(p.totalFactoryQty || poQty);

      totalOrderQty += poQty;
      totalFactoryQty += poFactQty;
      totalValue += poVal;

      const isRunningOrActive = p.status === 'Running' || p.status === 'Active' || p.status === 'Cutting' || p.status === 'Sewing';
      if (isRunningOrActive) {
        activeOrderQty += poQty;
        activeOrderValue += poVal;
      }

      (p.styles || []).forEach(s => {
        if (s.styleNo) stylesSet.add(s.styleNo);
        (s.colours || []).forEach(c => {
          if (c.sizeQuantities && typeof c.sizeQuantities === 'object') {
            Object.values(c.sizeQuantities).forEach(q => {
              const num = Number(q);
              if (!isNaN(num) && num > 0) {
                sizeBreakdownTotal += num;
                totalSizesCount += 1;
              }
            });
          }
        });
      });
    });

    const avgFob = totalOrderQty > 0 ? totalValue / totalOrderQty : 0;
    const allowanceBufferQty = Math.max(0, totalFactoryQty - totalOrderQty);
    const avgAllowancePct = totalOrderQty > 0 ? (allowanceBufferQty / totalOrderQty) * 100 : 0;

    return {
      totalBuyers: buyersSet.size,
      totalPOs: visiblePOs.length,
      totalStyles: stylesSet.size,
      currentTotalQty: totalOrderQty,
      netOrderVolume: totalValue,
      totalOrderQty,
      totalFactoryQty,
      totalValue,
      activeOrderQty,
      activeOrderValue,
      avgFob,
      allowanceBufferQty,
      avgAllowancePct,
      sizeBreakdownTotal,
      totalSizesCount,
      isSizeReconciled: sizeBreakdownTotal === totalOrderQty || totalOrderQty === 0
    };
  }, [visiblePOs]);

  // Helper to determine sizes for a given style in a PO card
  const getSelectedMatrixIdForStyle = (card: POEditorCardState, styleIdx: number) => {
    const st = card.styles[styleIdx];
    if (st?.selectedMatrixId) return st.selectedMatrixId;
    const gt = (st?.garmentType || '').toLowerCase();
    if (gt.includes('knit') || gt.includes('t-shirt') || gt.includes('top') || gt.includes('polo') || gt.includes('jacket')) {
      const alpha = masterSizeMatrices.find(m => m.name.toLowerCase().includes('alpha') || m.code.includes('ALPHA'));
      if (alpha) return alpha.id;
    }
    const num = masterSizeMatrices.find(m => m.name.toLowerCase().includes('numeric') || m.name.toLowerCase().includes('waist') || m.code.includes('NUM'));
    if (num) return num.id;
    return masterSizeMatrices[0]?.id || '';
  };

  const getActiveSizesForCard = (card: POEditorCardState, styleIdx: number) => {
    const st = card.styles[styleIdx];
    const matrixId = st?.selectedMatrixId || getSelectedMatrixIdForStyle(card, styleIdx);

    if (matrixId) {
      const found = masterSizeMatrices.find(m => m.id === matrixId || m.name === matrixId || m.code === matrixId);
      if (found && found.sizes.length > 0) return found.sizes;
    }
    const gt = (st?.garmentType || card.styles[0]?.garmentType || '').toLowerCase();
    if (gt.includes('knit') || gt.includes('t-shirt') || gt.includes('top') || gt.includes('polo') || gt.includes('jacket')) {
      const alpha = masterSizeMatrices.find(m => m.name.toLowerCase().includes('alpha') || m.code.includes('ALPHA'));
      if (alpha && alpha.sizes.length > 0) return alpha.sizes;
    }
    if (masterSizeMatrices.length > 0) {
      return masterSizeMatrices[0].sizes;
    }
    return ['28', '30', '32', '34', '36', '38'];
  };

  // --- ACTIONS: ADD NEW PO UNDER CURRENT BUYER ---
  const handleAddNewPOCardToCurrentBuyer = () => {
    if (!selectedWorkspaceBuyer) {
      setErrorMessage('Please select a Buyer first.');
      return;
    }

    if (!canUserAddPoForBuyer(currentUser, selectedWorkspaceBuyer, allBuyerMasterData, orders)) {
      const creator = selectedBuyerCreatorInfo.creatorName || selectedBuyerCreatorInfo.creatorEmail || 'another user';
      setErrorMessage(
        `Permission Denied: Buyer "${selectedWorkspaceBuyer}" was created by ${creator}. Only ${creator} or System Administrator can add Purchase Orders for this buyer.`
      );
      return;
    }

    const currentBuyerGroup = buyerGroups.find(b => b.buyer === selectedWorkspaceBuyer);
    const brand = currentBuyerGroup?.brand || masterBrands[0] || 'Divided';
    const cardId = `card-new-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newCard: POEditorCardState = {
      id: cardId,
      isNew: true,
      isCollapsed: false, // Expanded immediately for entry
      buyer: selectedWorkspaceBuyer,
      brand,
      poNo: '',
      poDate: new Date().toISOString().substring(0, 10),
      deliveryDate: '2026-10-30',
      shipmentDate: '2026-11-02',
      unitPrice: 8.5,
      currency: 'USD',
      allowancePct: 3,
      status: 'Running',
      remarks: '',
      selectedMatrixId: masterSizeMatrices[0]?.id || '',
      styles: [
        {
          styleNo: '',
          styleName: '',
          garmentType: masterGarmentTypes[0] || 'Denim Bottom',
          season: masterSeasons[0] || 'SS 2026',
          isWashGarment: true,
          washType: masterWashTypes[0] || 'Enzyme Wash',
          allowancePct: 3,
          unitPrice: '',
          colours: [
            {
              colour: masterColours[0] || 'Indigo Blue',
              totalQty: 1000,
              allowancePct: 3,
              factoryQty: 1030,
              sizeQuantities: { '30': 200, '32': 500, '34': 300 }
            }
          ]
        }
      ]
    };

    setBuyerPoCards(prev => [...prev, newCard]);
    setErrorMessage(null);
  };

  // Toggle Collapse / Expand for a specific PO card
  const toggleCollapseCard = (cardId: string) => {
    setBuyerPoCards(prev =>
      prev.map(c => (c.id === cardId ? { ...c, isCollapsed: !c.isCollapsed } : c))
    );
  };

  // Expand All / Collapse All in current buyer workspace
  const handleExpandAllCards = () => {
    setBuyerPoCards(prev => prev.map(c => ({ ...c, isCollapsed: false })));
  };

  const handleCollapseAllCards = () => {
    setBuyerPoCards(prev => prev.map(c => ({ ...c, isCollapsed: true })));
  };

  // Update specific field on a PO card
  const updateCardField = (cardId: string, updater: (card: POEditorCardState) => POEditorCardState) => {
    setBuyerPoCards(prev => prev.map(c => (c.id === cardId ? updater({ ...c }) : c)));
  };

  // --- STYLE OPERATIONS ON PO CARD ---
  const handleAddStyleToCard = (cardId: string) => {
    updateCardField(cardId, card => {
      const firstStyle = card.styles[0];
      const newGt = firstStyle?.garmentType || masterGarmentTypes[0] || 'Denim Bottom';
      const isDenimOrBottom = /denim|bottom|jean|pant|trouser|chino/i.test(newGt);
      const newStyle: FormPOStyle = {
        styleNo: '',
        styleName: '',
        garmentType: newGt,
        season: firstStyle?.season || masterSeasons[0] || 'SS 2026',
        isWashGarment: isDenimOrBottom,
        washType: isDenimOrBottom ? (masterWashTypes[0] || 'Enzyme Wash') : undefined,
        allowancePct: 3,
        unitPrice: card.unitPrice || '',
        colours: [
          {
            colour: masterColours[0] || 'Indigo Blue',
            totalQty: 1000,
            allowancePct: 3,
            factoryQty: 1030,
            sizeQuantities: { '30': 200, '32': 500, '34': 300 }
          }
        ]
      };
      return { ...card, styles: [...card.styles, newStyle] };
    });
  };

  const handleRemoveStyleFromCard = (cardId: string, styleIdx: number) => {
    updateCardField(cardId, card => {
      if (card.styles.length <= 1) return card;
      return {
        ...card,
        styles: card.styles.filter((_, idx) => idx !== styleIdx)
      };
    });
  };

  const handleAddColourToStyleInCard = (cardId: string, styleIdx: number) => {
    updateCardField(cardId, card => {
      const sizes = getActiveSizesForCard(card, styleIdx);
      const initialSizes: Record<string, number> = {};
      sizes.forEach(s => {
        initialSizes[s] = 0;
      });

      const stylesCopy = [...card.styles];
      const st = stylesCopy[styleIdx];
      const styleAllowance = st.allowancePct || 0;

      st.colours.push({
        colour: '',
        totalQty: 0,
        allowancePct: styleAllowance,
        factoryQty: 0,
        sizeQuantities: initialSizes
      });

      return { ...card, styles: stylesCopy };
    });
  };

  const handleRemoveColourFromStyleInCard = (cardId: string, styleIdx: number, colIdx: number) => {
    updateCardField(cardId, card => {
      const stylesCopy = [...card.styles];
      if (stylesCopy[styleIdx].colours.length <= 1) return card;
      stylesCopy[styleIdx].colours = stylesCopy[styleIdx].colours.filter((_, i) => i !== colIdx);
      return { ...card, styles: stylesCopy };
    });
  };

  const handleSizeQtyChangeInCard = (cardId: string, styleIdx: number, colIdx: number, size: string, qty: number) => {
    updateCardField(cardId, card => {
      const stylesCopy = [...card.styles];
      const targetStyle = stylesCopy[styleIdx];
      const targetCol = targetStyle.colours[colIdx];

      const newSizeQuantities = {
        ...targetCol.sizeQuantities,
        [size]: Math.max(0, qty)
      };

      const allowanceVal: number = Number(targetCol.allowancePct ?? targetStyle.allowancePct ?? 0);
      const sizeWise = calculateSizeWiseAllowance(newSizeQuantities, allowanceVal);

      targetCol.sizeQuantities = sizeWise.sizeQuantities;
      targetCol.factorySizeQuantities = sizeWise.factorySizeQuantities;
      targetCol.allowanceSizeQuantities = sizeWise.allowanceSizeQuantities;
      targetCol.totalQty = sizeWise.totalOrderQty;
      targetCol.allowancePct = allowanceVal;
      targetCol.allowanceQty = sizeWise.totalAllowanceQty;
      targetCol.factoryQty = sizeWise.totalFactoryQty;

      targetStyle.allowanceQty = targetStyle.colours.reduce((sum, c) => sum + (c.allowanceQty || 0), 0);
      targetStyle.factoryOrderQty = targetStyle.colours.reduce((sum, c) => sum + (c.factoryQty || c.totalQty), 0);

      return { ...card, styles: stylesCopy };
    });
  };

  const handlePoAllowanceChangeInCard = (cardId: string, allowance: number) => {
    updateCardField(cardId, card => {
      const newAllowance = Math.max(0, allowance);
      const stylesCopy = card.styles.map(st => {
        const cleanColours = st.colours.map(c => {
          const sizeWise = calculateSizeWiseAllowance(c.sizeQuantities || {}, newAllowance);
          return {
            ...c,
            allowancePct: newAllowance,
            totalQty: sizeWise.totalOrderQty,
            allowanceQty: sizeWise.totalAllowanceQty,
            factoryQty: sizeWise.totalFactoryQty,
            sizeQuantities: sizeWise.sizeQuantities,
            factorySizeQuantities: sizeWise.factorySizeQuantities,
            allowanceSizeQuantities: sizeWise.allowanceSizeQuantities
          };
        });

        const styleOrderQty = cleanColours.reduce((sum, c) => sum + c.totalQty, 0);
        const styleFactoryQty = cleanColours.reduce((sum, c) => sum + (c.factoryQty || c.totalQty), 0);
        const styleAllowanceQty = Math.max(0, styleFactoryQty - styleOrderQty);

        return {
          ...st,
          allowancePct: newAllowance,
          allowanceQty: styleAllowanceQty,
          factoryOrderQty: styleFactoryQty,
          colours: cleanColours
        };
      });

      return {
        ...card,
        allowancePct: newAllowance,
        styles: stylesCopy
      };
    });
  };

  const handleStyleAllowanceChangeInCard = (cardId: string, styleIdx: number, allowance: number) => {
    updateCardField(cardId, card => {
      const stylesCopy = [...card.styles];
      const targetStyle = stylesCopy[styleIdx];
      const newAllowance = Math.max(0, allowance);
      targetStyle.allowancePct = newAllowance;

      // Update all colours under this style SIZE-WISE from ORIGINAL Order Quantities
      targetStyle.colours.forEach(c => {
        c.allowancePct = newAllowance;
        const sizeWise = calculateSizeWiseAllowance(c.sizeQuantities || {}, newAllowance);
        c.sizeQuantities = sizeWise.sizeQuantities;
        c.factorySizeQuantities = sizeWise.factorySizeQuantities;
        c.allowanceSizeQuantities = sizeWise.allowanceSizeQuantities;
        c.totalQty = sizeWise.totalOrderQty;
        c.allowanceQty = sizeWise.totalAllowanceQty;
        c.factoryQty = sizeWise.totalFactoryQty;
      });

      targetStyle.allowanceQty = targetStyle.colours.reduce((sum, c) => sum + (c.allowanceQty || 0), 0);
      targetStyle.factoryOrderQty = targetStyle.colours.reduce((sum, c) => sum + (c.factoryQty || c.totalQty), 0);

      return { ...card, styles: stylesCopy };
    });
  };

  // --- SAVE AN INDIVIDUAL PO CARD ---
  const handleSavePOCard = async (cardId: string) => {
    const card = buyerPoCards.find(c => c.id === cardId);
    if (!card) return;

    if (!canUserAddPoForBuyer(currentUser, card.buyer, allBuyerMasterData, orders)) {
      const bInfo = getBuyerCreatorInfo(card.buyer, allBuyerMasterData, currentUser, orders);
      const creator = bInfo.creatorName || bInfo.creatorEmail || 'another user';
      setErrorMessage(
        `Permission Denied: Buyer "${card.buyer}" was created by ${creator}. Only ${creator} or System Administrator can add or update Purchase Orders for this buyer.`
      );
      return;
    }

    const pTrim = card.poNo.trim().toUpperCase();
    if (!pTrim) {
      setErrorMessage('Purchase Order Number (PO No) is mandatory.');
      return;
    }
    if (!card.buyer.trim()) {
      setErrorMessage('Buyer Name is mandatory.');
      return;
    }

    // 1. Check Duplicate PO within same buyer (Rule 10)
    const existingPOsForThisBuyer = structuredPOs.filter(
      p => p.buyer.trim().toLowerCase() === card.buyer.trim().toLowerCase() &&
           p.poNo.trim().toUpperCase() === pTrim &&
           p.poNo.trim().toUpperCase() !== (card.originalPoNo || '').trim().toUpperCase()
    );

    if (existingPOsForThisBuyer.length > 0) {
      setErrorMessage(
        `Duplicate PO Error: Purchase Order "${pTrim}" already exists under Buyer "${card.buyer}". Please specify a unique PO Number.`
      );
      return;
    }

    // 2. Check Duplicate Styles inside the same PO (Rule 11)
    const styleNoSet = new Set<string>();
    for (let sIdx = 0; sIdx < card.styles.length; sIdx++) {
      const st = card.styles[sIdx];
      const sTrim = st.styleNo.trim().toUpperCase();
      if (!sTrim) {
        setErrorMessage(`Style #${sIdx + 1} under PO "${card.poNo}" must have a valid Style Number.`);
        return;
      }
      if (styleNoSet.has(sTrim)) {
        setErrorMessage(
          `Duplicate Style Error: Style "${sTrim}" is added multiple times inside PO "${card.poNo}". In the same PO, each Style must be unique.`
        );
        return;
      }
      styleNoSet.add(sTrim);

      const validCols = st.colours.filter(c => c.colour.trim() !== '');
      if (validCols.length === 0) {
        setErrorMessage(`Style "${st.styleNo}" must have at least one defined colour.`);
        return;
      }
      for (const col of validCols) {
        const hasPositiveSize = Object.values(col.sizeQuantities || {}).some(q => Number(q) > 0);
        if (!hasPositiveSize && (col.totalQty || 0) <= 0) {
          setErrorMessage(`Colour "${col.colour}" in Style "${st.styleNo}" must have size breakdown quantities.`);
          return;
        }
      }
    }

    setErrorMessage(null);
    updateCardField(cardId, c => ({ ...c, isSaving: true }));

    const userCreatorId = currentUser?.name || currentUser?.email || currentUser?.username || 'Merchandising';
    const userDept = currentUser?.department || 'Merchandising';
    const userCreatorEmail = (currentUser?.email || '').toLowerCase().trim();

    const res = await supabaseDataService.savePOWithMultipleStyles({
      poNo: pTrim,
      originalPoNo: card.originalPoNo,
      buyer: card.buyer.trim(),
      brand: card.brand.trim(),
      poDate: card.poDate,
      deliveryDate: card.deliveryDate,
      shipmentDate: card.shipmentDate,
      unitPrice: Number(card.unitPrice || 0),
      currency: card.currency,
      status: card.status,
      remarks: card.remarks,
      styles: card.styles.map(s => ({
        styleNo: s.styleNo.trim().toUpperCase(),
        styleName: s.styleName.trim() || 'Garment Style',
        garmentType: s.garmentType || 'Denim Bottom',
        season: s.season || 'SS 2026',
        isWashGarment: s.isWashGarment !== undefined ? s.isWashGarment : true,
        washType: s.isWashGarment ? (s.washType || 'Enzyme Wash') : undefined,
        allowancePct: Number(s.allowancePct || 0),
        unitPrice: typeof s.unitPrice === 'number' ? s.unitPrice : (Number(card.unitPrice) || 0),
        colours: s.colours.map(c => ({
          colour: c.colour.trim(),
          totalQty: c.totalQty,
          allowancePct: Number(c.allowancePct ?? s.allowancePct ?? 0),
          factoryQty: c.factoryQty || Math.round(c.totalQty * (1 + (c.allowancePct ?? s.allowancePct ?? 0) / 100)),
          sizeQuantities: c.sizeQuantities
        }))
      })),
      activeUser: userCreatorId,
      userDept,
      userEmail: userCreatorEmail
    });

    updateCardField(cardId, c => ({ ...c, isSaving: false }));

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save Purchase Order.');
    } else {
      // Mark as saved and collapse to summary
      updateCardField(cardId, c => ({
        ...c,
        isNew: false,
        isCollapsed: true, // Collapsed after saving
        originalPoNo: pTrim
      }));
      setSuccessMessage(`Purchase Order "${pTrim}" under "${card.buyer}" saved successfully!`);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  // --- QUICK STATUS AND WASH UPDATE HANDLERS ---
  const handleQuickStatusUpdatePO = async (poNo: string, newStatus: OrderStatus, buyer?: string) => {
    setIsLoading(true);
    const res = await supabaseDataService.updatePOStatus(poNo, newStatus, buyer, currentUser?.name);
    setIsLoading(false);
    if (res.success) {
      setSuccessMessage(`PO "${poNo}" status updated to "${newStatus}".`);
      setOrders([...supabaseDataService.getOrders()]);
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setErrorMessage(res.error || 'Failed to update PO status.');
    }
  };

  const handleQuickStatusUpdateStyle = async (styleNo: string, newStatus: OrderStatus) => {
    setIsLoading(true);
    const res = await supabaseDataService.updateStyleStatus(styleNo, newStatus, currentUser?.name);
    setIsLoading(false);
    if (res.success) {
      setSuccessMessage(`Style "${styleNo}" status updated to "${newStatus}".`);
      setOrders([...supabaseDataService.getOrders()]);
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setErrorMessage(res.error || 'Failed to update Style status.');
    }
  };

  const handleQuickWashToggleStyle = async (styleNo: string, isWash: boolean, washType?: string) => {
    setIsLoading(true);
    const res = await supabaseDataService.updateStyleWashInfo(styleNo, isWash, washType, currentUser?.name);
    setIsLoading(false);
    if (res.success) {
      setSuccessMessage(`Style "${styleNo}" wash setting updated (${isWash ? `Wash: ${washType || 'Yes'}` : 'Non-Wash Direct'}).`);
      setOrders([...supabaseDataService.getOrders()]);
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setErrorMessage(res.error || 'Failed to update wash setting.');
    }
  };

  // --- DELETE PO CONFIRMATION WITH PRODUCTION SAFETY CHECK ---
  const handleOpenDeletePO = (poItem: { poNo: string; buyer: string }) => {
    const targetPo = structuredPOs.find(
      p => p.poNo.trim().toUpperCase() === poItem.poNo.trim().toUpperCase() &&
           p.buyer.trim().toLowerCase() === poItem.buyer.trim().toLowerCase()
    );

    if (targetPo && !canAccessOrder(currentUser, targetPo)) {
      setErrorMessage(`Access Denied: You cannot delete purchase orders created by other users.`);
      return;
    }

    const history = supabaseDataService.checkPoProductionHistory(poItem.poNo);
    setPoToDelete({
      poNo: poItem.poNo,
      buyer: poItem.buyer,
      historyInfo: history
    });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeletePO = async () => {
    if (!poToDelete) return;
    setIsLoading(true);
    const res = await supabaseDataService.deletePurchaseOrder(poToDelete.poNo, poToDelete.buyer, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to delete Purchase Order.');
    } else {
      // Remove from cards
      setBuyerPoCards(prev =>
        prev.filter(c => (c.originalPoNo || c.poNo).trim().toUpperCase() !== poToDelete.poNo.trim().toUpperCase())
      );
      setIsDeleteModalOpen(false);
      setPoToDelete(null);
      setSuccessMessage(`Purchase Order "${poToDelete.poNo}" removed.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // --- QUICK FOB EDIT ACTION ---
  const handleOpenQuickFob = (poNo: string, buyer: string, styleNo?: string, currentFob: number = 0) => {
    setQuickFobTarget({
      poNo,
      buyer,
      styleNo,
      currentFob,
      newFob: currentFob
    });
    setQuickFobModalOpen(true);
  };

  const handleSaveQuickFob = async () => {
    if (!quickFobTarget || quickFobTarget.newFob === '') return;
    const { poNo, buyer, styleNo, newFob } = quickFobTarget;
    const targetFob = Number(newFob) || 0;

    // Find the structured PO
    const targetPo = structuredPOs.find(
      p => p.poNo.trim().toUpperCase() === poNo.trim().toUpperCase() &&
           p.buyer.trim().toLowerCase() === buyer.trim().toLowerCase()
    );

    if (!targetPo) {
      setErrorMessage(`Purchase Order "${poNo}" not found.`);
      setQuickFobModalOpen(false);
      return;
    }

    setIsLoading(true);
    const userCreatorId = currentUser?.name || currentUser?.email || 'Merchandising';

    // Update PO or specific style FOB
    const updatedStyles = targetPo.styles.map(st => {
      if (!styleNo || st.styleNo.trim().toUpperCase() === styleNo.trim().toUpperCase()) {
        return {
          ...st,
          unitPrice: targetFob,
          colours: st.colours
        };
      }
      return {
        ...st,
        colours: st.colours
      };
    });

    const res = await supabaseDataService.savePOWithMultipleStyles({
      poNo: targetPo.poNo,
      buyer: targetPo.buyer,
      brand: targetPo.brand,
      poDate: targetPo.poDate,
      deliveryDate: targetPo.deliveryDate,
      shipmentDate: targetPo.shipmentDate,
      unitPrice: styleNo ? targetPo.unitPrice : targetFob,
      currency: targetPo.currency,
      status: targetPo.status,
      remarks: targetPo.remarks,
      styles: updatedStyles,
      activeUser: userCreatorId
    });

    setIsLoading(false);
    setQuickFobModalOpen(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update FOB price.');
    } else {
      setSuccessMessage(`FOB price updated to $${targetFob.toFixed(2)} for PO "${poNo}"${styleNo ? ` (Style: ${styleNo})` : ''}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  // Columns for Tab 2: Purchase Orders Master Directory
  const poColumns: Column<ReturnType<typeof supabaseDataService.getStructuredPurchaseOrders>[0]>[] = [
    {
      header: 'PO Number / Delivery',
      accessorKey: 'poNo',
      sortable: true,
      cell: p => (
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer text-xs"
              onClick={() => {
                setSelectedWorkspaceBuyer(p.buyer);
                setActiveTab('buyer_workspace');
                // Ensure card is expanded
                setBuyerPoCards(prev =>
                  prev.map(c => (c.poNo === p.poNo || c.originalPoNo === p.poNo ? { ...c, isCollapsed: false } : c))
                );
              }}
            >
              {p.poNo}
            </span>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded font-semibold border border-slate-200 dark:border-slate-700">
              {p.stylesCount} {p.stylesCount === 1 ? 'Style' : 'Styles'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3 text-slate-400" />
            Delivery: <strong className="text-slate-700 dark:text-slate-200">{p.deliveryDate || 'TBD'}</strong>
          </div>
        </div>
      )
    },
    {
      header: 'Buyer / Brand',
      accessorKey: 'buyer',
      sortable: true,
      cell: p => (
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs">{p.buyer}</span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.brand || 'Main'}</p>
        </div>
      )
    },
    {
      header: 'Styles & Wash Process',
      cell: p => (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1.5">
            {p.styles?.map((st, i) => (
              <div
                key={st.styleNo || i}
                className="flex items-center gap-1.5 text-[11px] font-mono bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded font-bold"
                title={`${st.styleName} (${st.garmentType}) - FOB: $${st.unitPrice || p.unitPrice}`}
              >
                <span>{st.styleNo} ({st.totalOrderQty.toLocaleString()} pcs • ${st.unitPrice || p.unitPrice})</span>
                {st.isWashGarment !== false ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-900/80 text-cyan-800 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-700" title={`Wash Required: ${st.washType || 'Enzyme Wash'}`}>
                    <Droplets className="w-2.5 h-2.5 text-cyan-600 dark:text-cyan-400" />
                    {st.washType || 'Wash'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700" title="Non-Wash Garment (Direct to Finishing)">
                    Non-Wash
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      header: 'Factory Order Qty (pcs)',
      accessorKey: 'totalFactoryQty',
      sortable: true,
      cell: p => {
        const factQty = p.totalFactoryQty || p.totalOrderQty || 0;
        const allowanceQty = Math.max(0, (p.totalFactoryQty || 0) - (p.totalOrderQty || 0));
        return (
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-xs">{factQty.toLocaleString()} pcs</div>
            {allowanceQty > 0 && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>Base: {p.totalOrderQty?.toLocaleString()}</span>
                <span>• +{allowanceQty.toLocaleString()} pcs</span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'PO FOB / Value',
      accessorKey: 'totalValue',
      sortable: true,
      cell: p => (
        <div>
          <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">
            ${p.totalValue?.toLocaleString()} {p.currency || 'USD'}
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">FOB: ${p.unitPrice}/pc</span>
            {!isMD(currentUser) && canOperate('Order Management') && (
              <button
                onClick={() => handleOpenQuickFob(p.poNo, p.buyer, undefined, p.unitPrice)}
                title="Quick Edit FOB Price"
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
              >
                [Edit]
              </button>
            )}
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: p => {
        const isEditable = !isMD(currentUser) && canOperate('Order Management');
        return (
          <div className="flex items-center gap-1">
            {isEditable ? (
              <select
                value={p.status || 'Confirmed'}
                onChange={e => handleQuickStatusUpdatePO(p.poNo, e.target.value as OrderStatus, p.buyer)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border outline-none cursor-pointer shadow-2xs transition-colors ${
                  p.status === 'Running'
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                    : p.status === 'Confirmed'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                    : p.status === 'Hold'
                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                    : p.status === 'Completed' || p.status === 'Shipment Complete' || p.status === 'Shipped'
                    ? 'bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700'
                    : p.status === 'Cancelled'
                    ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {ORDER_STATUS_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <StatusBadge status={p.status} />
            )}
          </div>
        );
      }
    },
    {
      header: 'Actions',
      cell: p => {
        const canManageThisOrder = canAccessOrder(currentUser, p);
        const isExpanded = expandedDirectoryPOs[p.poNo];
        const isMDUser = isMD(currentUser);
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => toggleExpandDirectoryPO(p.poNo)}
              title={isExpanded ? 'Collapse Style Breakdown' : 'Expand Style & Colour Breakdown'}
              className={`p-1.5 rounded-lg transition-colors ${
                isExpanded
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800'
              }`}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => {
                setExplorerBuyer(p.buyer);
                setExplorerPoNo(p.poNo);
                setExplorerStyleNo(p.styles[0]?.styleNo || '');
                setActiveTab('hierarchy_explorer');
              }}
              title="Inspect Master Hierarchy Pipeline"
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            {!isMDUser && canOperate('Order Management') && canManageThisOrder && (
              <button
                onClick={() => {
                  setSelectedWorkspaceBuyer(p.buyer);
                  setActiveTab('buyer_workspace');
                  setBuyerPoCards(prev =>
                    prev.map(c => (c.poNo === p.poNo || c.originalPoNo === p.poNo ? { ...c, isCollapsed: false } : c))
                  );
                }}
                title="Edit in Multi-PO Workspace"
                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
            )}
            {!isMDUser && canDelete('Order Management') && canManageThisOrder && (
              <button
                onClick={() => handleOpenDeletePO(p)}
                title="Delete Purchase Order"
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      }
    }
  ];

  // Columns for Tab 3: Style-wise Master View
  const styleColumns: Column<OrderStyle>[] = [
    {
      header: 'Style No / Name',
      accessorKey: 'styleNo',
      sortable: true,
      cell: o => (
        <div>
          <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">{o.styleNo}</span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{o.styleName || o.garmentType}</p>
        </div>
      )
    },
    {
      header: 'Buyer / Brand',
      accessorKey: 'buyer',
      sortable: true,
      cell: o => (
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs">{o.buyer}</span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{o.brand || o.season}</p>
        </div>
      )
    },
    {
      header: 'Wash Process (Wash hobe kina)',
      cell: o => {
        const isWash = o.isWashGarment !== false;
        const canEdit = !isMD(currentUser) && canOperate('Order Management');
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            {isWash ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 shadow-2xs">
                <Droplets className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                {o.washType || 'Enzyme Wash'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-2xs">
                <CheckCircle2 className="w-3 h-3 text-slate-400" />
                Non-Wash (Direct)
              </span>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => handleQuickWashToggleStyle(o.styleNo, !isWash, isWash ? undefined : (o.washType || 'Enzyme Wash'))}
                title={isWash ? 'Switch this Style to Non-Wash' : 'Switch this Style to Wash Garment'}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
              >
                [{isWash ? 'Toggle Non-Wash' : 'Toggle Wash'}]
              </button>
            )}
          </div>
        );
      }
    },
    {
      header: 'Associated Purchase Orders (PO List)',
      cell: o => (
        <div className="flex flex-wrap gap-1">
          {o.purchaseOrders?.map(p => (
            <span
              key={p.poNo}
              className="text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700"
            >
              {p.poNo} ({p.totalPoQty?.toLocaleString()} pcs • FOB: ${p.unitPrice})
            </span>
          ))}
        </div>
      )
    },
    {
      header: 'Total Factory Qty',
      accessorKey: 'factoryOrderQty',
      sortable: true,
      cell: o => <span className="font-bold text-slate-900 dark:text-white text-xs">{(o.factoryOrderQty || o.totalOrderQty)?.toLocaleString()} pcs</span>
    },
    {
      header: 'Style Value',
      accessorKey: 'totalOrderValue',
      sortable: true,
      cell: o => (
        <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">
          ${o.totalOrderValue?.toLocaleString()} {o.currency || 'USD'}
        </span>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: o => {
        const isEditable = !isMD(currentUser) && canOperate('Order Management');
        return (
          <div className="flex items-center gap-1">
            {isEditable ? (
              <select
                value={o.status || 'Confirmed'}
                onChange={e => handleQuickStatusUpdateStyle(o.styleNo, e.target.value as OrderStatus)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md border outline-none cursor-pointer shadow-2xs transition-colors ${
                  o.status === 'Running'
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                    : o.status === 'Confirmed'
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                    : o.status === 'Hold'
                    ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                    : o.status === 'Completed' || o.status === 'Shipment Complete' || o.status === 'Shipped'
                    ? 'bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700'
                    : o.status === 'Cancelled'
                    ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                }`}
              >
                {ORDER_STATUS_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <StatusBadge status={o.status} />
            )}
          </div>
        );
      }
    }
  ];

  // Current selected Buyer data in workspace
  const currentBuyerData = useMemo(() => {
    return buyerGroups.find(b => b.buyer === selectedWorkspaceBuyer) || {
      buyer: selectedWorkspaceBuyer || 'Select Buyer',
      brand: masterBrands[0] || '',
      pos: [],
      totalOrderQty: 0,
      totalFactoryQty: 0,
      totalValue: 0,
      stylesCount: 0
    };
  }, [buyerGroups, selectedWorkspaceBuyer, masterBrands]);

  // Ownership info for currently selected buyer
  const selectedBuyerCreatorInfo = useMemo(() => {
    return getBuyerCreatorInfo(selectedWorkspaceBuyer, allBuyerMasterData, currentUser, orders);
  }, [selectedWorkspaceBuyer, allBuyerMasterData, currentUser, orders]);

  return (
    <div className="space-y-6 animate-fade-in pb-20 dark:text-slate-100">
      <PageHeader
        title="Order Management (Buyer → Multiple POs → Multiple Styles → Colours → Sizes)"
        description={
          isExecutiveOrAdmin
            ? "Master Garment Order Hub: Multi-PO stacked workspace under 1 Buyer with collapsible cards, independent Size Matrices, FOB overrides, and live tracking"
            : `User Order Directory: Orders created by ${currentUser?.name || currentUser?.email || 'you'} (${currentUser?.department || 'Merchandising'})`
        }
        actions={
          <div className="flex items-center gap-2">
            <ExportPrintToolbar title="Purchase Orders" data={visiblePOs} filename="MJAL_Purchase_Orders" />
          </div>
        }
      />

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-blue-500" /> Active Buyers
          </div>
          <div className="text-xl font-bold text-slate-800 dark:text-white mt-1">{stats.totalBuyers}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /> Purchase Orders (POs)
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.totalPOs}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-indigo-500" /> Total Unique Styles
          </div>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{stats.totalStyles}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Shirt className="w-3.5 h-3.5 text-amber-500" /> Total Factory Qty
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{(stats.totalFactoryQty || stats.totalOrderQty || 0).toLocaleString()} pcs</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Total PO FOB Value
          </div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">${(stats.totalValue || 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('buyer_workspace')}
          className={`pb-2.5 px-2 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'buyer_workspace'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Buyer Multi-PO Hub (1 Buyer → Multiple POs)
        </button>

        <button
          onClick={() => setActiveTab('pos')}
          className={`pb-2.5 px-2 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'pos'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          PO Master Directory ({visiblePOs.length} POs)
        </button>

        <button
          onClick={() => setActiveTab('styles')}
          className={`pb-2.5 px-2 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'styles'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          Style-wise Master Directory ({visibleOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('hierarchy_explorer')}
          className={`pb-2.5 px-2 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'hierarchy_explorer'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Master Hierarchy & Live Pipeline Explorer
        </button>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BUYER MULTI-PO HUB (1 Buyer -> Stacked Collapsible POs -> Styles) */}
      {/* ========================================================================= */}
      {activeTab === 'buyer_workspace' && (
        <div className="space-y-6">
          {/* Buyer Selector & Header Banner */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Buyer Master Section
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <select
                      value={selectedWorkspaceBuyer}
                      onChange={e => setSelectedWorkspaceBuyer(e.target.value)}
                      className="text-base font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {masterBuyers.map(b => {
                        const bInfo = getBuyerCreatorInfo(b, allBuyerMasterData, currentUser, orders);
                        let prefix = '';
                        let suffix = '';
                        if (bInfo.isCreatedByCurrentUser && !bInfo.isSystemDefault) {
                          prefix = '★ ';
                          suffix = ' (Created by You)';
                        } else if (!bInfo.canAddPO) {
                          prefix = '🔒 ';
                          suffix = ` (Created by ${bInfo.creatorName || 'Other User'})`;
                        }
                        return (
                          <option key={b} value={b}>
                            {prefix}{b}{suffix}
                          </option>
                        );
                      })}
                      {/* Any custom buyer from existing orders not in master list */}
                      {buyerGroups
                        .filter(bg => !masterBuyers.includes(bg.buyer))
                        .map(bg => {
                          const bInfo = getBuyerCreatorInfo(bg.buyer, allBuyerMasterData, currentUser, orders);
                          let prefix = '';
                          let suffix = '';
                          if (bInfo.isCreatedByCurrentUser && !bInfo.isSystemDefault) {
                            prefix = '★ ';
                            suffix = ' (Created by You)';
                          } else if (!bInfo.canAddPO) {
                            prefix = '🔒 ';
                            suffix = ` (Created by ${bInfo.creatorName || 'Other User'})`;
                          }
                          return (
                            <option key={bg.buyer} value={bg.buyer}>
                              {prefix}{bg.buyer}{suffix}
                            </option>
                          );
                        })}
                    </select>

                    {!isMD(currentUser) && (
                      <PermissionGuard dept="Order Management" permission="CREATE">
                        <button
                          type="button"
                          id="btn-add-buyer-inline"
                          onClick={() => {
                            setAddBuyerError(null);
                            setNewBuyerForm({ name: '', code: '', brand: '', country: '', description: '' });
                            setShowAddBuyerModal(true);
                          }}
                          title="Add New Buyer to Master Data"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors shadow-2xs cursor-pointer shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          + Add Buyer
                        </button>
                      </PermissionGuard>
                    )}

                    {/* Buyer Ownership / Creator Badge */}
                    {!isMD(currentUser) && selectedBuyerCreatorInfo.isCreatedByCurrentUser && !selectedBuyerCreatorInfo.isSystemDefault && (
                      <span className="text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        My Buyer (Creator)
                      </span>
                    )}

                    {!isMD(currentUser) && !selectedBuyerCreatorInfo.canAddPO && (
                      <span className="text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        Created by: {selectedBuyerCreatorInfo.creatorName || selectedBuyerCreatorInfo.creatorEmail || 'Other User'}
                      </span>
                    )}

                    {isMD(currentUser) && (
                      <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Executive Oversight (Managing Director)
                      </span>
                    )}

                    {selectedBuyerCreatorInfo.isSystemDefault && !isMD(currentUser) && (
                      <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-slate-500" />
                        System Buyer
                      </span>
                    )}

                    {currentBuyerData.brand && (
                      <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        Brand: {currentBuyerData.brand}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons & Overview Stats */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-right px-3 py-1 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] text-slate-400 font-medium">Buyer Overall Volume</div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {currentBuyerData.totalOrderQty.toLocaleString()} pcs •{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      ${currentBuyerData.totalValue.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleExpandAllCards}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={handleCollapseAllCards}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Minimize All
                  </button>
                </div>

                {!isMD(currentUser) && (
                  <PermissionGuard dept="Order Management" permission="CREATE">
                    <button
                      disabled={!selectedBuyerCreatorInfo.canAddPO}
                      onClick={handleAddNewPOCardToCurrentBuyer}
                      title={!selectedBuyerCreatorInfo.canAddPO ? `Restricted: Only ${selectedBuyerCreatorInfo.creatorName || 'the buyer creator'} can add POs for ${selectedWorkspaceBuyer}` : `Add New PO under ${selectedWorkspaceBuyer}`}
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl shadow-sm transition-colors ${
                        selectedBuyerCreatorInfo.canAddPO
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {selectedBuyerCreatorInfo.canAddPO ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      + Add New PO under {selectedWorkspaceBuyer}
                    </button>
                  </PermissionGuard>
                )}
              </div>
            </div>

            {/* Warning or Executive Notice Banner */}
            {isMD(currentUser) ? (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs rounded-xl flex items-center gap-2.5 shadow-2xs">
                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <span className="font-bold">Executive View Mode:</span> You are viewing Order Management with Managing Director executive oversight. PO editing and booking operations are restricted to Merchandisers; you have complete visibility, analytics, and export access.
                </div>
              </div>
            ) : !selectedBuyerCreatorInfo.canAddPO && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs rounded-xl flex items-center gap-2.5 shadow-2xs">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold">Restricted Buyer Access:</span> Buyer <strong>"{selectedWorkspaceBuyer}"</strong> was created by <strong>{selectedBuyerCreatorInfo.creatorName || selectedBuyerCreatorInfo.creatorEmail || 'another user'}</strong>. Under system policy, only the user who created this Buyer or a System Administrator is authorized to add or edit Purchase Orders under it.
                </div>
              </div>
            )}

            {/* Quick Buyer Summary Strip */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div>
                Showing <strong>{buyerPoCards.length}</strong> Purchase Order(s) for{' '}
                <strong className="text-slate-800 dark:text-slate-200">{selectedWorkspaceBuyer}</strong>
              </div>
              <div className="text-[11px] italic">
                Tip: Click Minimize [−] on any PO to collapse it into a summary header and keep entering other POs.
              </div>
            </div>
          </div>

          {/* STACKED PO CARDS LIST */}
          <div className="space-y-4">
            {buyerPoCards.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
                {isMD(currentUser) ? (
                  <>
                    <Eye className="w-10 h-10 text-blue-500 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      No Purchase Orders Found for {selectedWorkspaceBuyer}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      There are currently no active Purchase Orders recorded for buyer "{selectedWorkspaceBuyer}".
                    </p>
                  </>
                ) : selectedBuyerCreatorInfo.canAddPO ? (
                  <>
                    <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      No Purchase Orders booked yet for {selectedWorkspaceBuyer}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Click the button below to add your first Purchase Order with multiple Styles, Colours, and Size Matrices.
                    </p>
                    <button
                      onClick={handleAddNewPOCardToCurrentBuyer}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      + Create First PO for {selectedWorkspaceBuyer}
                    </button>
                  </>
                ) : (
                  <>
                    <Lock className="w-10 h-10 text-amber-500 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      Purchase Order Creation Restricted for {selectedWorkspaceBuyer}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Buyer <strong>"{selectedWorkspaceBuyer}"</strong> was created by <strong>{selectedBuyerCreatorInfo.creatorName || selectedBuyerCreatorInfo.creatorEmail || 'another user'}</strong>. Only the user who created this Buyer or a System Administrator is authorized to add Purchase Orders under it.
                    </p>
                  </>
                )}
              </div>
            ) : (
              buyerPoCards.map((card, cardIndex) => {
                const totalCardOrderQty = card.styles.reduce(
                  (sum, s) =>
                    sum + s.colours.reduce((cSum, c) => cSum + (c.totalQty || 0), 0),
                  0
                );
                const totalCardFactoryQty = card.styles.reduce(
                  (sum, s) =>
                    sum + s.colours.reduce((cSum, c) => cSum + (c.factoryQty || c.totalQty || 0), 0),
                  0
                );
                const totalCardColoursCount = card.styles.reduce((sum, s) => sum + s.colours.length, 0);
                const totalCardSizesCount = card.styles.reduce(
                  (sum, s) =>
                    sum +
                    s.colours.reduce(
                      (cSum, c) => cSum + Object.values(c.sizeQuantities || {}).filter(q => Number(q) > 0).length,
                      0
                    ),
                  0
                );
                const totalCardFobValue = card.styles.reduce((sum, s) => {
                  const styleQty = s.colours.reduce((cSum, c) => cSum + (c.totalQty || 0), 0);
                  const styleFob = typeof s.unitPrice === 'number' ? s.unitPrice : (Number(card.unitPrice) || 0);
                  return sum + styleQty * styleFob;
                }, 0);

                return (
                  <div
                    key={card.id}
                    className={`bg-white dark:bg-slate-900 border-2 rounded-2xl transition-all shadow-sm ${
                      card.isCollapsed
                        ? 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                        : 'border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/10'
                    }`}
                  >
                    {/* ========================================================================= */}
                    {/* CARD HEADER (Always Visible: Expand/Collapse, Summary Stats, Quick Edit) */}
                    {/* ========================================================================= */}
                    <div
                      onClick={() => toggleCollapseCard(card.id)}
                      className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none rounded-t-2xl transition-colors ${
                        card.isCollapsed
                          ? 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                          : 'bg-blue-50/50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-2xs shrink-0"
                        >
                          {card.isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-blue-700 dark:text-blue-400">
                              {card.poNo.trim() ? card.poNo : '(New Untitled PO)'}
                            </span>
                            {card.isNew ? (
                              <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                                Draft / Unsaved
                              </span>
                            ) : (
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <select
                                  value={card.status || 'Confirmed'}
                                  disabled={isMD(currentUser)}
                                  onChange={async e => {
                                    const newStatus = e.target.value as OrderStatus;
                                    updateCardField(card.id, c => ({ ...c, status: newStatus }));
                                    await handleQuickStatusUpdatePO(card.poNo, newStatus, card.buyer);
                                  }}
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border outline-none cursor-pointer shadow-2xs transition-colors ${
                                    card.status === 'Running'
                                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                                      : card.status === 'Confirmed'
                                      ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                                      : card.status === 'Hold'
                                      ? 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                      : card.status === 'Completed' || card.status === 'Shipment Complete' || card.status === 'Shipped'
                                      ? 'bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-700'
                                      : card.status === 'Cancelled'
                                      ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                                  }`}
                                >
                                  {ORDER_STATUS_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold px-2 py-0.5 rounded">
                              {card.styles.length} {card.styles.length === 1 ? 'Style' : 'Styles'}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              • {totalCardColoursCount} Colours • {totalCardSizesCount} Sizes Matrix
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-1 flex-wrap">
                            <span>
                              Delivery: <strong className="text-slate-700 dark:text-slate-300">{card.deliveryDate || 'TBD'}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Default FOB:{' '}
                              <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
                                ${card.unitPrice || '0.00'}/pc
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Factory Allowance:{' '}
                              <strong className="text-indigo-600 dark:text-indigo-400 font-mono">
                                {card.allowancePct ?? 3}%
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Order Qty:{' '}
                              <strong className="text-slate-900 dark:text-white font-mono">
                                {totalCardOrderQty.toLocaleString()} pcs
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Header Right Actions */}
                      <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                        <div className="text-right">
                          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            ${totalCardFobValue.toLocaleString()} {card.currency}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Factory (+allow): {totalCardFactoryQty.toLocaleString()} pcs
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Quick FOB edit button */}
                          {!card.isNew && !isMD(currentUser) && (
                            <button
                              type="button"
                              onClick={() => handleOpenQuickFob(card.poNo, card.buyer, undefined, Number(card.unitPrice))}
                              title="Quick Edit FOB Price"
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              [Edit FOB]
                            </button>
                          )}

                          {/* Quick Save button directly on header */}
                          {!isMD(currentUser) && (
                            <button
                              type="button"
                              onClick={() => handleSavePOCard(card.id)}
                              disabled={card.isSaving}
                              className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors"
                            >
                              <Save className="w-3.5 h-3.5" />
                              {card.isSaving ? 'Saving...' : 'Save'}
                            </button>
                          )}

                          {/* Toggle Expand/Minimize button */}
                          <button
                            type="button"
                            onClick={() => toggleCollapseCard(card.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
                            title={card.isCollapsed ? 'Expand PO details' : 'Minimize PO card'}
                          >
                            {card.isCollapsed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                          </button>

                          {/* Delete PO button */}
                          {!card.isNew && !isMD(currentUser) && canDelete('Order Management') && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeletePO({ poNo: card.poNo, buyer: card.buyer })}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                              title="Delete Purchase Order"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* EXPANDED CARD BODY (PO Parameters, Styles, Colours & Size Matrix Breakdown) */}
                    {/* ========================================================================= */}
                    {!card.isCollapsed && (
                      <div className="p-4 space-y-6">
                        {/* PO Master Parameters Grid */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 text-xs">
                          <div>
                            <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">
                              PO Number <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. PO-88392"
                              value={card.poNo}
                              onChange={e =>
                                updateCardField(card.id, c => ({ ...c, poNo: e.target.value.toUpperCase() }))
                              }
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">
                              Brand
                            </label>
                            <input
                              type="text"
                              value={card.brand}
                              onChange={e => updateCardField(card.id, c => ({ ...c, brand: e.target.value }))}
                              placeholder="e.g. Divided / Main"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">
                              PO Date
                            </label>
                            <input
                              type="date"
                              value={card.poDate}
                              onChange={e => updateCardField(card.id, c => ({ ...c, poDate: e.target.value }))}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">
                              Delivery Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="date"
                              required
                              value={card.deliveryDate}
                              onChange={e => updateCardField(card.id, c => ({ ...c, deliveryDate: e.target.value }))}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">
                              PO Default FOB ($/pc) <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-slate-400 font-bold">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={card.unitPrice}
                                onChange={e =>
                                  updateCardField(card.id, c => ({
                                    ...c,
                                    unitPrice: e.target.value === '' ? '' : parseFloat(e.target.value)
                                  }))
                                }
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-6 pr-2.5 py-1.5 font-bold text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">
                              Factory Allowance % <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="50"
                                step="0.1"
                                required
                                value={card.allowancePct ?? 3}
                                onChange={e =>
                                  handlePoAllowanceChangeInCard(card.id, parseFloat(e.target.value) || 0)
                                }
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-2.5 pr-6 py-1.5 font-bold font-mono text-indigo-700 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="3"
                              />
                              <span className="absolute right-2.5 top-1.5 text-slate-400 font-bold">%</span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">
                              PO Status (Status Update) <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={card.status || 'Confirmed'}
                              onChange={async e => {
                                const newStatus = e.target.value as OrderStatus;
                                updateCardField(card.id, c => ({ ...c, status: newStatus }));
                                if (!card.isNew) {
                                  await handleQuickStatusUpdatePO(card.poNo, newStatus, card.buyer);
                                }
                              }}
                              className={`w-full bg-white dark:bg-slate-900 border rounded-lg px-2.5 py-1.5 font-bold outline-none focus:ring-2 focus:ring-blue-500 ${
                                card.status === 'Running'
                                  ? 'border-blue-400 text-blue-700 dark:text-blue-400'
                                  : card.status === 'Confirmed'
                                  ? 'border-emerald-400 text-emerald-700 dark:text-emerald-400'
                                  : card.status === 'Hold'
                                  ? 'border-amber-400 text-amber-800 dark:text-amber-300'
                                  : card.status === 'Completed' || card.status === 'Shipment Complete' || card.status === 'Shipped'
                                  ? 'border-teal-400 text-teal-800 dark:text-teal-400'
                                  : card.status === 'Cancelled'
                                  ? 'border-rose-400 text-rose-700 dark:text-rose-400'
                                  : 'border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {ORDER_STATUS_OPTIONS.map(opt => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* STYLES INSIDE THIS PO (PO -> Multiple Styles) */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                            <div className="flex items-center gap-2">
                              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                Styles under PO {card.poNo || 'New'} ({card.styles.length} Styles)
                              </h4>
                            </div>

                            {!isMD(currentUser) && (
                              <button
                                type="button"
                                onClick={() => handleAddStyleToCard(card.id)}
                                className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                + Add Style to this PO
                              </button>
                            )}
                          </div>

                          {card.styles.map((style, styleIdx) => {
                            const activeSizes = getActiveSizesForCard(card, styleIdx);
                            const styleOrderQty = style.colours.reduce((sum, c) => sum + (c.totalQty || 0), 0);
                            const styleFactoryQty = style.colours.reduce(
                              (sum, c) => sum + (c.factoryQty || c.totalQty || 0),
                              0
                            );
                            const currentStyleFob =
                              typeof style.unitPrice === 'number'
                                ? style.unitPrice
                                : (Number(card.unitPrice) || 0);

                            return (
                              <div
                                key={styleIdx}
                                className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-3"
                              >
                                {/* Style Header Bar with Wash Status Badge */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700 pb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-xs bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded-md font-mono">
                                      Style #{styleIdx + 1}: {style.styleNo.trim() ? style.styleNo : '(Untitled Style)'}
                                    </span>
                                    {style.isWashGarment !== false ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 shadow-2xs">
                                        <Droplets className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                                        Wash Required: {style.washType || 'Enzyme Wash'}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                        Non-Wash (Direct Finishing)
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {card.styles.length > 1 && !isMD(currentUser) && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveStyleFromCard(card.id, styleIdx)}
                                        className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors"
                                        title="Remove this style"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Remove Style
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Style Attributes Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                                  <div>
                                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-0.5">
                                      Style Number <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="e.g. ST-2026-01"
                                      value={style.styleNo}
                                      onChange={e =>
                                        updateCardField(card.id, c => {
                                          const stylesCopy = [...c.styles];
                                          stylesCopy[styleIdx].styleNo = e.target.value.toUpperCase();
                                          return { ...c, styles: stylesCopy };
                                        })
                                      }
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold font-mono text-blue-700 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-0.5">
                                      Style Name / Description
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Men's Slim Denim"
                                      value={style.styleName}
                                      onChange={e =>
                                        updateCardField(card.id, c => {
                                          const stylesCopy = [...c.styles];
                                          stylesCopy[styleIdx].styleName = e.target.value;
                                          return { ...c, styles: stylesCopy };
                                        })
                                      }
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-0.5">
                                      Garment Type
                                    </label>
                                    <select
                                      value={style.garmentType}
                                      onChange={e =>
                                        updateCardField(card.id, c => {
                                          const stylesCopy = [...c.styles];
                                          const newGt = e.target.value;
                                          stylesCopy[styleIdx].garmentType = newGt;
                                          const gtLower = newGt.toLowerCase();
                                          if (gtLower.includes('knit') || gtLower.includes('t-shirt') || gtLower.includes('top') || gtLower.includes('polo') || gtLower.includes('jacket')) {
                                            const alpha = masterSizeMatrices.find(m => m.name.toLowerCase().includes('alpha') || m.code.includes('ALPHA'));
                                            if (alpha) stylesCopy[styleIdx].selectedMatrixId = alpha.id;
                                          } else {
                                            const num = masterSizeMatrices.find(m => m.name.toLowerCase().includes('numeric') || m.name.toLowerCase().includes('waist') || m.code.includes('NUM'));
                                            if (num) stylesCopy[styleIdx].selectedMatrixId = num.id;
                                          }
                                          return { ...c, styles: stylesCopy };
                                        })
                                      }
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      {masterGarmentTypes.map(gt => (
                                        <option key={gt} value={gt}>
                                          {gt}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-0.5">
                                      Size Matrix
                                    </label>
                                    <select
                                      value={style.selectedMatrixId || getSelectedMatrixIdForStyle(card, styleIdx)}
                                      onChange={e =>
                                        updateCardField(card.id, c => {
                                          const stylesCopy = [...c.styles];
                                          stylesCopy[styleIdx].selectedMatrixId = e.target.value;
                                          return { ...c, styles: stylesCopy };
                                        })
                                      }
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white outline-none font-medium text-xs focus:ring-2 focus:ring-blue-500"
                                    >
                                      {masterSizeMatrices.map(m => (
                                        <option key={m.id} value={m.id}>
                                          {m.name} ({m.sizes.slice(0, 4).join(', ')}{m.sizes.length > 4 ? '...' : ''})
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-0.5">
                                      Style FOB Override ($/pc)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder={`PO Default ($${card.unitPrice})`}
                                      value={style.unitPrice}
                                      onChange={e =>
                                        updateCardField(card.id, c => {
                                          const stylesCopy = [...c.styles];
                                          stylesCopy[styleIdx].unitPrice =
                                            e.target.value === '' ? '' : parseFloat(e.target.value);
                                          return { ...c, styles: stylesCopy };
                                        })
                                      }
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-emerald-700 dark:text-emerald-400 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                                      Factory Allowance %
                                    </label>
                                    <div className="relative">
                                      <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        step="0.1"
                                        value={style.allowancePct}
                                        onChange={e =>
                                          handleStyleAllowanceChangeInCard(card.id, styleIdx, parseFloat(e.target.value) || 0)
                                        }
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-2 pr-6 py-1.5 font-bold font-mono text-xs text-indigo-700 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <span className="absolute right-2.5 top-2 text-[11px] text-slate-400 font-bold">%</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Washing Required & Wash Type Selection Row */}
                                <div className="bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/80 dark:border-cyan-800/60 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-center text-xs">
                                  <div>
                                    <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                                      <Droplets className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                                      Washing Process Required? (Wash hobe kina)
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateCardField(card.id, c => {
                                            const stylesCopy = [...c.styles];
                                            stylesCopy[styleIdx].isWashGarment = true;
                                            if (!stylesCopy[styleIdx].washType) {
                                              stylesCopy[styleIdx].washType = masterWashTypes[0] || 'Enzyme Wash';
                                            }
                                            return { ...c, styles: stylesCopy };
                                          });
                                        }}
                                        className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border ${
                                          style.isWashGarment !== false
                                            ? 'bg-cyan-600 text-white border-cyan-600 shadow-2xs'
                                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                                        }`}
                                      >
                                        <Droplets className="w-3.5 h-3.5" />
                                        Yes (Wash Garment)
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateCardField(card.id, c => {
                                            const stylesCopy = [...c.styles];
                                            stylesCopy[styleIdx].isWashGarment = false;
                                            return { ...c, styles: stylesCopy };
                                          });
                                        }}
                                        className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border ${
                                          style.isWashGarment === false
                                            ? 'bg-slate-700 text-white border-slate-700 shadow-2xs dark:bg-slate-600 dark:border-slate-600'
                                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                                        }`}
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        No (Non-Wash Direct)
                                      </button>
                                    </div>
                                  </div>

                                  {style.isWashGarment !== false ? (
                                    <div className="sm:col-span-2 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <label className="block text-slate-600 dark:text-slate-300 font-bold">
                                          Wash Type / Recipe Specification
                                        </label>
                                        <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-semibold">
                                          Select standard wash or type custom recipe
                                        </span>
                                      </div>
                                      <div className="flex gap-2">
                                        <select
                                          value={masterWashTypes.includes(style.washType || '') ? style.washType : '__custom__'}
                                          onChange={e => {
                                            const val = e.target.value;
                                            updateCardField(card.id, c => {
                                              const stylesCopy = [...c.styles];
                                              if (val !== '__custom__') {
                                                stylesCopy[styleIdx].washType = val;
                                              }
                                              return { ...c, styles: stylesCopy };
                                            });
                                          }}
                                          className="w-1/2 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-lg px-2.5 py-1.5 font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500"
                                        >
                                          {masterWashTypes.map(wt => (
                                            <option key={wt} value={wt}>
                                              {wt}
                                            </option>
                                          ))}
                                          <option value="__custom__">Custom Wash Recipe...</option>
                                        </select>

                                        <input
                                          type="text"
                                          placeholder="e.g. Enzyme + Silicone + Tint"
                                          value={style.washType || ''}
                                          onChange={e =>
                                            updateCardField(card.id, c => {
                                              const stylesCopy = [...c.styles];
                                              stylesCopy[styleIdx].washType = e.target.value;
                                              return { ...c, styles: stylesCopy };
                                            })
                                          }
                                          className="w-1/2 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 rounded-lg px-2.5 py-1.5 font-bold text-cyan-900 dark:text-cyan-200 outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="sm:col-span-2 text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                                      <span className="font-semibold text-slate-700 dark:text-slate-300">Non-Wash Garment Routing:</span> Production progresses directly from Sewing to Finishing & Quality Check (washing department bypassed).
                                    </div>
                                  )}
                                </div>

                                {/* COLOURS & SIZE MATRIX TABLE */}
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                      <Palette className="w-3.5 h-3.5 text-indigo-500" />
                                      Size-Wise Colour Breakdown & Factory Allowance Matrix
                                    </span>
                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300">
                                        Order Qty: <strong className="text-slate-900 dark:text-white font-mono">{styleOrderQty.toLocaleString()} pcs</strong>
                                      </span>
                                      <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 font-semibold">
                                        Allowance Qty: <strong className="font-mono">+{Math.max(0, styleFactoryQty - styleOrderQty).toLocaleString()} pcs</strong> ({style.allowancePct}%)
                                      </span>
                                      <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 font-semibold">
                                        Factory Order Qty: <strong className="font-mono">{styleFactoryQty.toLocaleString()} pcs</strong>
                                      </span>
                                    </div>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                          <th className="p-2 min-w-[130px]">Colour</th>
                                          {activeSizes.map(sz => (
                                            <th key={sz} className="p-2 text-center min-w-[68px] font-mono">
                                              <div className="font-bold text-slate-800 dark:text-slate-200">{sz}</div>
                                              <div className="text-[9px] font-normal text-slate-400">Order | Fact</div>
                                            </th>
                                          ))}
                                          <th className="p-2 text-right min-w-[75px]">Order Qty</th>
                                          <th className="p-2 text-center min-w-[75px]">Factory Allowance %</th>
                                          <th className="p-2 text-right min-w-[80px]">Allowance Qty</th>
                                          <th className="p-2 text-right min-w-[95px] text-emerald-700 dark:text-emerald-400">Factory Order Qty</th>
                                          <th className="p-2 text-center w-8"></th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                        {style.colours.map((col, colIdx) => {
                                          const colOrderQty = col.totalQty || 0;
                                          const colAllowance = Number(col.allowancePct ?? style.allowancePct ?? 0);
                                          const colFactoryQty = col.factoryQty || Math.round(colOrderQty * (1 + colAllowance / 100));
                                          const colBufferQty = Math.max(0, colFactoryQty - colOrderQty);

                                          return (
                                            <tr key={colIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            <td className="p-2">
                                              <input
                                                type="text"
                                                disabled={isMD(currentUser)}
                                                list={`colors-list-${card.id}-${styleIdx}`}
                                                placeholder="e.g. Navy Blue"
                                                value={col.colour}
                                                onChange={e =>
                                                  updateCardField(card.id, c => {
                                                    const stylesCopy = [...c.styles];
                                                    stylesCopy[styleIdx].colours[colIdx].colour = e.target.value;
                                                    return { ...c, styles: stylesCopy };
                                                  })
                                                }
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white font-medium disabled:opacity-80"
                                              />
                                              <datalist id={`colors-list-${card.id}-${styleIdx}`}>
                                                {masterColours.map(mc => (
                                                  <option key={mc} value={mc} />
                                                ))}
                                              </datalist>
                                            </td>

                                            {/* Size Inputs + Size-Wise Factory Allowance Badges */}
                                            {activeSizes.map(sz => {
                                              const szOrderQty = Number(col.sizeQuantities?.[sz]) || 0;
                                              const szAllowanceQty = col.allowanceSizeQuantities?.[sz] ?? Math.round(szOrderQty * (colAllowance / 100));
                                              const szFactoryQty = col.factorySizeQuantities?.[sz] ?? (szOrderQty + szAllowanceQty);

                                              return (
                                                <td key={sz} className="p-1 text-center align-top">
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    disabled={isMD(currentUser)}
                                                    value={col.sizeQuantities[sz] ?? ''}
                                                    onChange={e =>
                                                      handleSizeQtyChangeInCard(
                                                        card.id,
                                                        styleIdx,
                                                        colIdx,
                                                        sz,
                                                        parseInt(e.target.value) || 0
                                                      )
                                                    }
                                                    placeholder="0"
                                                    className="w-14 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1 py-1 text-center font-mono text-slate-900 dark:text-white text-xs font-semibold disabled:opacity-80"
                                                  />
                                                  {szOrderQty > 0 && (
                                                    <div
                                                      className="mt-1 text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 rounded px-1 py-0.5 border border-emerald-200/70 dark:border-emerald-800/50"
                                                      title={`Size ${sz}: Order ${szOrderQty} pcs + ${colAllowance}% allowance (${szAllowanceQty >= 0 ? '+' : ''}${szAllowanceQty} pcs) = Factory Order ${szFactoryQty} pcs`}
                                                    >
                                                      F:{szFactoryQty}
                                                    </div>
                                                  )}
                                                </td>
                                              );
                                            })}

                                            <td className="p-2 text-right font-bold text-slate-900 dark:text-white font-mono">
                                              {colOrderQty.toLocaleString()} pcs
                                            </td>

                                            <td className="p-2 text-center text-indigo-700 dark:text-indigo-400 font-mono font-semibold text-xs">
                                              {colAllowance}%
                                            </td>

                                            <td className="p-2 text-right font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold">
                                              +{colBufferQty.toLocaleString()} pcs
                                            </td>

                                            <td className="p-2 text-right font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                                              {colFactoryQty.toLocaleString()} pcs
                                            </td>

                                            <td className="p-2 text-center">
                                              {style.colours.length > 1 && !isMD(currentUser) && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleRemoveColourFromStyleInCard(card.id, styleIdx, colIdx)
                                                  }
                                                  className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                                  title="Remove colour"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    {style.colours.length > 1 && (
                                      <tfoot>
                                        <tr className="bg-slate-100/80 dark:bg-slate-800/80 font-bold text-slate-800 dark:text-slate-200 border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                                          <td className="p-2 text-slate-600 dark:text-slate-400">
                                            Total ({style.colours.length} Colours)
                                          </td>
                                          {activeSizes.map(sz => {
                                            const szTotalOrder = style.colours.reduce((sum, c) => sum + (Number(c.sizeQuantities?.[sz]) || 0), 0);
                                            const szTotalFact = style.colours.reduce((sum, c) => {
                                              const ord = Number(c.sizeQuantities?.[sz]) || 0;
                                              const allowPct = Number(c.allowancePct ?? style.allowancePct ?? 0);
                                              return sum + (c.factorySizeQuantities?.[sz] ?? (ord + Math.round(ord * (allowPct / 100))));
                                            }, 0);
                                            return (
                                              <td key={sz} className="p-1.5 text-center font-mono">
                                                <div className="text-slate-900 dark:text-white">{szTotalOrder.toLocaleString()}</div>
                                                {szTotalFact > szTotalOrder && (
                                                  <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold">
                                                    F:{szTotalFact.toLocaleString()}
                                                  </div>
                                                )}
                                              </td>
                                            );
                                          })}
                                          <td className="p-2 text-right font-mono text-slate-900 dark:text-white">
                                            {styleOrderQty.toLocaleString()} pcs
                                          </td>
                                          <td className="p-2 text-center font-mono text-indigo-700 dark:text-indigo-400">
                                            {style.allowancePct}%
                                          </td>
                                          <td className="p-2 text-right font-mono text-blue-600 dark:text-blue-400">
                                            +{Math.max(0, styleFactoryQty - styleOrderQty).toLocaleString()} pcs
                                          </td>
                                          <td className="p-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">
                                            {styleFactoryQty.toLocaleString()} pcs
                                          </td>
                                          <td></td>
                                        </tr>
                                      </tfoot>
                                    )}
                                    </table>
                                  </div>

                                  {!isMD(currentUser) && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddColourToStyleInCard(card.id, styleIdx)}
                                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 pt-1"
                                    >
                                      <Plus className="w-3 h-3" />
                                      + Add Colour to {style.styleNo || 'Style'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* BOTTOM PO CARD ACTION BAR */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleCollapseCard(card.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              <Minimize2 className="w-3.5 h-3.5" />
                              Minimize / Collapse PO (Keep Data)
                            </button>
                          </div>

                          {!isMD(currentUser) && (
                            <div className="flex items-center gap-2">
                              {(() => {
                                const canSaveCard = canUserAddPoForBuyer(currentUser, card.buyer, allBuyerMasterData, orders);
                                const bInfo = getBuyerCreatorInfo(card.buyer, allBuyerMasterData, currentUser, orders);
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleSavePOCard(card.id)}
                                    disabled={card.isSaving || !canSaveCard}
                                    title={!canSaveCard ? `Restricted: Only ${bInfo.creatorName || 'the buyer creator'} can save POs for ${card.buyer}` : 'Save Purchase Order'}
                                    className={`flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl shadow-sm transition-colors ${
                                      canSaveCard
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                                    }`}
                                  >
                                    {canSaveCard ? <Save className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                    {card.isSaving ? 'Saving to Database...' : (canSaveCard ? 'Save Purchase Order' : 'Locked (Creator Only)')}
                                  </button>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PO MASTER DIRECTORY (Searchable, filterable table across all buyers) */}
      {/* ========================================================================= */}
      {activeTab === 'pos' && (
        <div className="space-y-4">
          <DataTable
            data={visiblePOs}
            columns={poColumns}
            keyExtractor={p => p.poNo}
            searchPlaceholder="Search PO No, Buyer, Brand, Style No, Colour..."
          />

          {/* Render any expanded PO detail drawers */}
          {visiblePOs.filter(p => expandedDirectoryPOs[p.poNo]).map(p => (
            <div
              key={`exp-${p.poNo}`}
              className="bg-slate-50 dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-sm text-slate-900 dark:text-white">PO Details: {p.poNo}</span>
                  <span className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-xs font-semibold px-2 py-0.5 rounded">
                    {p.buyer} ({p.brand})
                  </span>
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Default FOB: ${p.unitPrice} {p.currency}
                  </span>
                </div>
                <button
                  onClick={() => toggleExpandDirectoryPO(p.poNo)}
                  className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Close Breakdown
                </button>
              </div>

              {/* Styles under this PO */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Styles inside PO {p.poNo} ({p.styles.length} Styles)
                </h5>

                <div className="grid grid-cols-1 gap-3">
                  {p.styles.map(st => (
                    <div
                      key={st.styleNo}
                      className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded">
                            Style: {st.styleNo}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{st.styleName}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">({st.garmentType}, {st.season})</span>
                          {st.isWashGarment !== false ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
                              <Droplets className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                              Wash: {st.washType || 'Enzyme Wash'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                              <CheckCircle2 className="w-3 h-3 text-slate-400" />
                              Non-Wash Direct
                            </span>
                          )}
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
                            FOB: ${st.unitPrice || p.unitPrice} {p.currency}
                          </span>
                          {st.allowancePct > 0 && (
                            <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Percent className="w-2.5 h-2.5" /> Allowance: {st.allowancePct}%
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {st.totalOrderQty.toLocaleString()} pcs
                          </span>
                          {st.factoryOrderQty > st.totalOrderQty && (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold">
                              Factory: {st.factoryOrderQty.toLocaleString()} pcs
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Colours & Size Breakdown Matrix */}
                      <div className="space-y-2">
                        {st.colours.map(c => {
                          const activeSizeKeys = Object.keys(c.sizeQuantities || {}).filter(
                            k => (Number(c.sizeQuantities[k]) || 0) > 0
                          );
                          const prog = supabaseDataService.getStylePoColourProgress(st.styleNo, p.poNo, c.colour);

                          return (
                            <div
                              key={c.colour}
                              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <Palette className="w-3.5 h-3.5 text-indigo-500" />
                                  <strong className="text-slate-900 dark:text-white">{c.colour}:</strong>
                                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{c.totalQty.toLocaleString()} pcs</span>
                                  {c.factoryQty && c.factoryQty > c.totalQty && (
                                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                                      (Factory: {c.factoryQty} pcs)
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                  Pipeline: {prog.packPercentage || 0}% Packed
                                </span>
                              </div>

                              {/* Size Matrix */}
                              <div className="flex flex-wrap gap-1">
                                {activeSizeKeys.map(sz => (
                                  <span
                                    key={sz}
                                    className="text-[10px] font-mono bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700"
                                  >
                                    <strong>{sz}:</strong> {c.sizeQuantities[sz]}
                                  </span>
                                ))}
                              </div>

                              {/* Mini Stage Pipeline */}
                              <div className="grid grid-cols-7 gap-1 text-[10px] text-center pt-1 border-t border-slate-200 dark:border-slate-800">
                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700">
                                  <div className="text-slate-400">Cut</div>
                                  <div className="font-bold">{prog.cutQty}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700">
                                  <div className="text-slate-400">Sew</div>
                                  <div className="font-bold text-blue-600 dark:text-blue-400">{prog.sewOutput}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700">
                                  <div className="text-slate-400">Wash</div>
                                  <div className="font-bold text-indigo-600 dark:text-indigo-400">{prog.washReceivedQty}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700">
                                  <div className="text-slate-400">Fin</div>
                                  <div className="font-bold text-purple-600 dark:text-purple-400">{prog.finQty}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700">
                                  <div className="text-slate-400">QC</div>
                                  <div className="font-bold text-emerald-600 dark:text-emerald-400">{prog.qcPassedQty}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700">
                                  <div className="text-slate-400">Pack</div>
                                  <div className="font-bold text-amber-600 dark:text-amber-400">{prog.packedQty}</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700">
                                  <div className="text-slate-400">Ship</div>
                                  <div className="font-bold text-slate-800 dark:text-slate-200">{prog.shippedQty}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STYLE-WISE MASTER DIRECTORY */}
      {/* ========================================================================= */}
      {activeTab === 'styles' && (
        <div className="space-y-4">
          <DataTable
            data={visibleOrders}
            columns={styleColumns}
            keyExtractor={o => o.id}
            searchPlaceholder="Search Style No, Style Name, Buyer, Season..."
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MASTER HIERARCHY & LIVE PIPELINE EXPLORER */}
      {/* ========================================================================= */}
      {activeTab === 'hierarchy_explorer' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Hierarchy Filter: Buyer → Purchase Order (PO) → Style → Colour
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Select Buyer</label>
                <select
                  value={explorerBuyer}
                  onChange={e => {
                    setExplorerBuyer(e.target.value);
                    setExplorerPoNo('');
                    setExplorerStyleNo('');
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                >
                  <option value="">-- All Buyers --</option>
                  {buyerGroups.map(b => (
                    <option key={b.buyer} value={b.buyer}>
                      {b.buyer} ({b.pos.length} POs)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Select Purchase Order (PO)</label>
                <select
                  value={explorerPoNo}
                  onChange={e => {
                    setExplorerPoNo(e.target.value);
                    setExplorerStyleNo('');
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                >
                  <option value="">-- All POs --</option>
                  {visiblePOs
                    .filter(p => !explorerBuyer || p.buyer.toLowerCase() === explorerBuyer.toLowerCase())
                    .map(p => (
                      <option key={p.poNo} value={p.poNo}>
                        {p.poNo} - {p.buyer} ({p.stylesCount} styles, {p.totalOrderQty.toLocaleString()} pcs)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-semibold mb-1">Select Style</label>
                <select
                  value={explorerStyleNo}
                  onChange={e => setExplorerStyleNo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                >
                  <option value="">-- All Styles --</option>
                  {visibleOrders
                    .filter(o => !explorerBuyer || o.buyer.toLowerCase() === explorerBuyer.toLowerCase())
                    .filter(o => !explorerPoNo || (o.purchaseOrders || []).some(p => p.poNo === explorerPoNo))
                    .map(o => (
                      <option key={o.styleNo} value={o.styleNo}>
                        {o.styleNo} ({o.styleName})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Active Live Progress Cards based on selection */}
          <div className="space-y-4">
            {visiblePOs
              .filter(p => !explorerBuyer || p.buyer.toLowerCase() === explorerBuyer.toLowerCase())
              .filter(p => !explorerPoNo || p.poNo.toLowerCase() === explorerPoNo.toLowerCase())
              .map(p => (
                <div
                  key={`exp-card-${p.poNo}`}
                  className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                      <div>
                        <span className="font-bold text-base text-slate-900 dark:text-white">{p.poNo}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                          Buyer: <strong>{p.buyer}</strong> | Delivery: <strong>{p.deliveryDate || 'TBD'}</strong> | FOB: <strong>${p.unitPrice}</strong>
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>

                  <div className="space-y-4">
                    {p.styles
                      .filter(st => !explorerStyleNo || st.styleNo.toLowerCase() === explorerStyleNo.toLowerCase())
                      .map(st => (
                        <div
                          key={`st-${st.styleNo}`}
                          className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                                Style: {st.styleNo}
                              </span>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{st.styleName}</span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">({st.garmentType})</span>
                              {st.isWashGarment !== false ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
                                  <Droplets className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                                  Wash: {st.washType || 'Enzyme Wash'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                                  <CheckCircle2 className="w-3 h-3 text-slate-400" />
                                  Non-Wash Direct
                                </span>
                              )}
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                Style FOB: ${st.unitPrice || p.unitPrice}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {st.totalOrderQty.toLocaleString()} pcs
                            </span>
                          </div>

                          {/* Colour Pipelines */}
                          <div className="space-y-2">
                            {st.colours.map(c => {
                              const prog = supabaseDataService.getStylePoColourProgress(st.styleNo, p.poNo, c.colour);
                              return (
                                <div
                                  key={`col-${c.colour}`}
                                  className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                      <Palette className="w-3.5 h-3.5 text-indigo-500" />
                                      {c.colour} ({c.totalQty.toLocaleString()} pcs)
                                    </span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      {prog.packPercentage || 0}% Packed • {prog.packedQty}/{c.totalQty} pcs
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                                    <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                                      <div className="text-slate-400">Cutting</div>
                                      <div className="font-bold text-slate-800 dark:text-slate-200">{prog.cutQty}</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                                      <div className="text-slate-400">Sewing</div>
                                      <div className="font-bold text-blue-600 dark:text-blue-400">{prog.sewOutput}</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                                      <div className="text-slate-400">Washing</div>
                                      <div className="font-bold text-indigo-600 dark:text-indigo-400">{prog.washReceivedQty}</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                                      <div className="text-slate-400">Finishing</div>
                                      <div className="font-bold text-purple-600 dark:text-purple-400">{prog.finQty}</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                                      <div className="text-slate-400">QC Pass</div>
                                      <div className="font-bold text-emerald-600 dark:text-emerald-400">{prog.qcPassedQty}</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                                      <div className="text-slate-400">Packing</div>
                                      <div className="font-bold text-amber-600 dark:text-amber-400">{prog.packedQty}</div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                                      <div className="text-slate-400">Shipment</div>
                                      <div className="font-bold text-slate-900 dark:text-white">{prog.shippedQty}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK FOB EDIT MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={quickFobModalOpen}
        onClose={() => setQuickFobModalOpen(false)}
        title={`Edit FOB Price – PO: ${quickFobTarget?.poNo || ''}`}
      >
        <div className="space-y-4 p-2 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Update FOB Unit Price for PO <strong>{quickFobTarget?.poNo}</strong> (Buyer:{' '}
            <strong>{quickFobTarget?.buyer}</strong>)
            {quickFobTarget?.styleNo && (
              <span>
                {' '}
                • Style: <strong>{quickFobTarget.styleNo}</strong>
              </span>
            )}
            . This change is strictly scoped to this PO and will never affect any other PO.
          </p>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
              New FOB Price ($/pc)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={quickFobTarget?.newFob ?? ''}
                onChange={e =>
                  setQuickFobTarget(prev =>
                    prev ? { ...prev, newFob: e.target.value === '' ? '' : parseFloat(e.target.value) } : null
                  )
                }
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-7 pr-3 py-2 text-base font-bold text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setQuickFobModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveQuickFob}
              disabled={isLoading || quickFobTarget?.newFob === ''}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {isLoading ? 'Updating...' : 'Update FOB'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* DELETE SAFETY MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={`Delete Purchase Order: ${poToDelete?.poNo || ''}`}
      >
        <div className="space-y-4 p-2 text-xs">
          {poToDelete?.historyInfo?.hasHistory ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl space-y-2 text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                <span>Production History Detected ({poToDelete.historyInfo.totalRecords} Records)</span>
              </div>
              <p className="text-[11px]">
                This Purchase Order (<strong>{poToDelete.poNo}</strong>) has active factory tracking records:
              </p>
              <ul className="list-disc list-inside text-[11px] font-semibold space-y-0.5 pl-1">
                {poToDelete.historyInfo.details.map((d: string, i: number) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
              <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400 pt-1">
                Deleting this PO will detach it from linked styles and may disrupt historical department reporting!
              </p>
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to delete Purchase Order <strong>{poToDelete?.poNo}</strong> under Buyer{' '}
              <strong>{poToDelete?.buyer}</strong>? This action cannot be undone.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDeletePO}
              disabled={isLoading}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
            >
              {isLoading ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>
      {/* ========================================================================= */}
      {/* ADD BUYER (MASTER DATA) MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showAddBuyerModal}
        onClose={() => {
          if (!isSavingBuyer) {
            setShowAddBuyerModal(false);
            setAddBuyerError(null);
          }
        }}
        title="Add New Buyer (Master Data)"
      >
        <form onSubmit={handleSaveNewBuyer} className="space-y-4 p-2 text-xs">
          <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300">
            <Building2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div>
              <div className="font-bold text-sm">Master Database Integration</div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Adding a Buyer here stores it permanently as Master Data across all modules (Orders, Samples, Production, Washing, Finishing, Shipment, and Reports).
              </div>
            </div>
          </div>

          {addBuyerError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addBuyerError}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                Buyer Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Primark Global, Next Direct, C&A Europe, VF Corporation"
                value={newBuyerForm.name}
                onChange={e => setNewBuyerForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Associated Brand / Division <span className="text-slate-400 text-[10px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Denim Dept, Activewear, Red Tab"
                  value={newBuyerForm.brand}
                  onChange={e => setNewBuyerForm(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Country / Region <span className="text-slate-400 text-[10px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. United Kingdom, Germany, USA"
                  value={newBuyerForm.country}
                  onChange={e => setNewBuyerForm(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Buyer Code <span className="text-slate-400 text-[10px]">(Auto-generated if empty)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. BUY-PRI-001"
                  value={newBuyerForm.code}
                  onChange={e => setNewBuyerForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Description / Notes <span className="text-slate-400 text-[10px]">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. European retail buyer, standard 60-day terms"
                  value={newBuyerForm.description}
                  onChange={e => setNewBuyerForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              * Saved to Master Database immediately
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSavingBuyer}
                onClick={() => {
                  setShowAddBuyerModal(false);
                  setAddBuyerError(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingBuyer || !newBuyerForm.name.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <Building2 className="w-3.5 h-3.5" />
                {isSavingBuyer ? 'Saving to Master...' : 'Save to Master Data'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
