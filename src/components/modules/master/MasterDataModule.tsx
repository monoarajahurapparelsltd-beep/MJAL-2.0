import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Plus,
  Layers,
  ShieldCheck,
  Tag,
  Trash2,
  Edit2,
  Search,
  Grid,
  CheckCircle2,
  Sliders,
  Palette,
  Calendar,
  Sparkles,
  Scissors,
  Check,
  Building2,
  Ruler,
  AlertCircle,
  Truck,
  Hash
} from 'lucide-react';
import { PageHeader } from '../../common/PageHeader';
import { Modal } from '../../common/Modal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { useAuth } from '../../../context/AuthContext';
import { PermissionGuard } from '../../common/PermissionGuard';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { MasterDataItem } from '../../../types';
import { parseSizeMatrixDescription } from '../../../services/defaultMasterData';

type MasterCategory = MasterDataItem['category'];

interface CategoryConfig {
  key: MasterCategory;
  title: string;
  shortLabel: string;
  icon: any;
  badgeBg: string;
  badgeText: string;
  badgeLabel: string;
  placeholder: string;
  descriptionHelp?: string;
  codePrefix: string;
  group: 'sizing' | 'commercial' | 'product' | 'manufacturing' | 'quality_wash' | 'supply';
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'SizeMatrix',
    title: 'Size Matrix Presets',
    shortLabel: 'Size Matrix',
    icon: Ruler,
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    badgeLabel: 'Matrix Scale',
    placeholder: 'e.g. Alpha Standard (XS - 2XL) or Waist Numeric (28 - 38)',
    descriptionHelp: 'Comma-separated sizes (e.g. XS, S, M, L, XL, 2XL or 28, 30, 32, 34, 36, 38)',
    codePrefix: 'SM-',
    group: 'sizing'
  },
  {
    key: 'Size',
    title: 'Master Sizes / Scales',
    shortLabel: 'Master Sizes',
    icon: Tag,
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-800',
    badgeLabel: 'Size',
    placeholder: 'e.g. XS, S, M, L, XL, 2XL, 28, 30, 32',
    descriptionHelp: 'Optional description (e.g. Waist 32 inch, Extra Large)',
    codePrefix: 'SZ-',
    group: 'sizing'
  },
  {
    key: 'Buyer',
    title: 'Buyer Master List',
    shortLabel: 'Buyers',
    icon: Building2,
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeLabel: 'Active Buyer',
    placeholder: 'e.g. H&M Global, Zara / Inditex, Levi Strauss & Co.',
    descriptionHelp: 'Buyer division or corporate detail',
    codePrefix: 'BUY-',
    group: 'commercial'
  },
  {
    key: 'Brand',
    title: 'Brand Master List',
    shortLabel: 'Brands',
    icon: Tag,
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-800',
    badgeLabel: 'Brand',
    placeholder: 'e.g. Divided, Red Tab 501, Goodfellow & Co',
    descriptionHelp: 'Brand collection or division',
    codePrefix: 'BRD-',
    group: 'commercial'
  },
  {
    key: 'GarmentType',
    title: 'Garment Product Types',
    shortLabel: 'Garment Types',
    icon: Layers,
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    badgeLabel: 'Product Type',
    placeholder: 'e.g. Denim Bottom, Chino Pants, Knit T-Shirt',
    descriptionHelp: 'Style category (e.g. 5-pocket denim, woven bottom)',
    codePrefix: 'GAR-',
    group: 'product'
  },
  {
    key: 'Colour',
    title: 'Colour & Wash Shades',
    shortLabel: 'Colours',
    icon: Palette,
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-800',
    badgeLabel: 'Shade / Colour',
    placeholder: 'e.g. Indigo Blue, Vintage Black, Bleach Light Blue',
    descriptionHelp: 'Fabric shade or dye code',
    codePrefix: 'COL-',
    group: 'product'
  },
  {
    key: 'Season',
    title: 'Production Seasons',
    shortLabel: 'Seasons',
    icon: Calendar,
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeLabel: 'Season',
    placeholder: 'e.g. SS 2026, FW 2026, Spring 2027',
    descriptionHelp: 'Calendar period / delivery season',
    codePrefix: 'SEA-',
    group: 'commercial'
  },
  {
    key: 'WashType',
    title: 'Washing Process Categories',
    shortLabel: 'Wash Types',
    icon: Sparkles,
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    badgeLabel: 'Standard Wash',
    placeholder: 'e.g. Enzyme Wash, Bleach Wash, Stone Wash, Acid Wash',
    descriptionHelp: 'Chemical or mechanical wash recipe',
    codePrefix: 'WSH-',
    group: 'quality_wash'
  },
  {
    key: 'DefectType',
    title: 'Quality Defect Master Codes',
    shortLabel: 'QC Defect Codes',
    icon: AlertCircle,
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    badgeLabel: 'Defect Code',
    placeholder: 'e.g. Stitch Fault / Skip, Oil Stain, Measurement Out of Spec',
    descriptionHelp: 'Standard fault classification',
    codePrefix: 'DEF-',
    group: 'quality_wash'
  },
  {
    key: 'SewingLine',
    title: 'Sewing Production Lines',
    shortLabel: 'Sewing Lines',
    icon: Scissors,
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
    badgeLabel: 'Floor Line',
    placeholder: 'e.g. Line 01, Line 02, Line 03',
    descriptionHelp: 'Assembly line or section',
    codePrefix: 'LINE-',
    group: 'manufacturing'
  },
  {
    key: 'Supplier',
    title: 'Suppliers & Material Vendors',
    shortLabel: 'Suppliers',
    icon: Truck,
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeLabel: 'Approved Supplier',
    placeholder: 'e.g. Pacific Fabrics Ltd., YKK Bangladesh, Coats Thread',
    descriptionHelp: 'Supplier supply range (fabric, trims, labels)',
    codePrefix: 'SUP-',
    group: 'supply'
  },
  {
    key: 'UOM',
    title: 'Units of Measure (UOM)',
    shortLabel: 'UOM',
    icon: Hash,
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    badgeLabel: 'Standard UOM',
    placeholder: 'e.g. Pcs, Dzn, Yards, Meters, Kgs, Gross',
    descriptionHelp: 'Unit description',
    codePrefix: 'UOM-',
    group: 'supply'
  },
  {
    key: 'FabricType',
    title: 'Fabric & Material Specifications',
    shortLabel: 'Fabric Types',
    icon: Layers,
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    badgeLabel: 'Fabric Spec',
    placeholder: 'e.g. 100% Cotton Denim 12.5oz, Cotton Spandex Stretch Denim',
    descriptionHelp: 'Construction, weave & weight GSM',
    codePrefix: 'FAB-',
    group: 'product'
  }
];

export const MasterDataModule: React.FC = () => {
  const { currentUser, canOperate, canDelete } = useAuth();
  const [masterItems, setMasterItems] = useState<MasterDataItem[]>(supabaseDataService.getMasterData());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<'ALL' | 'sizing' | 'commercial' | 'product' | 'manufacturing' | 'quality_wash' | 'supply'>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterDataItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MasterDataItem | null>(null);

  // Form State
  const [formCategory, setFormCategory] = useState<MasterCategory>('SizeMatrix');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMasterItems(supabaseDataService.getMasterData());
    const unsub = supabaseDataService.subscribe(() => {
      setMasterItems([...supabaseDataService.getMasterData()]);
    });
    return unsub;
  }, []);

  const currentCategoryConfig = useMemo(() => {
    return CATEGORY_CONFIGS.find(c => c.key === formCategory) || CATEGORY_CONFIGS[0];
  }, [formCategory]);

  const filteredConfigs = useMemo(() => {
    return CATEGORY_CONFIGS.filter(cfg => {
      if (selectedGroupFilter !== 'ALL' && cfg.group !== selectedGroupFilter) return false;
      if (selectedCategoryFilter !== 'ALL' && cfg.key !== selectedCategoryFilter) return false;
      return true;
    });
  }, [selectedGroupFilter, selectedCategoryFilter]);

  const itemsByCategory = useMemo(() => {
    const map = new Map<MasterCategory, MasterDataItem[]>();
    CATEGORY_CONFIGS.forEach(cfg => map.set(cfg.key, []));

    masterItems.forEach(item => {
      const list = map.get(item.category) || [];
      list.push(item);
      map.set(item.category, list);
    });

    return map;
  }, [masterItems]);

  const handleOpenAdd = (category: MasterCategory) => {
    const cfg = CATEGORY_CONFIGS.find(c => c.key === category) || CATEGORY_CONFIGS[0];
    setEditingItem(null);
    setFormCategory(category);
    setFormCode(`${cfg.codePrefix}${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormDescription('');
    setFormStatus('Active');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MasterDataItem) => {
    setEditingItem(item);
    setFormCategory(item.category);
    setFormCode(item.code || '');
    setFormName(item.name || '');
    setFormDescription(item.description || '');
    setFormStatus(item.status || 'Active');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage('Please enter an Item Name or Title.');
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    const itemToSave: MasterDataItem = {
      id: editingItem ? editingItem.id : `md-${Date.now()}`,
      category: formCategory,
      code: formCode.trim() || `${currentCategoryConfig.codePrefix}${Date.now().toString().slice(-4)}`,
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      status: formStatus,
      createdBy: editingItem?.createdBy || currentUser?.name || currentUser?.username || currentUser?.email || 'Admin',
      creatorEmail: editingItem?.creatorEmail || currentUser?.email,
      createdDepartment: editingItem?.createdDepartment || currentUser?.department || 'HR & Admin'
    };

    const res = await supabaseDataService.saveMasterItem(
      itemToSave,
      currentUser?.name || currentUser?.email,
      currentUser?.email,
      currentUser?.department
    );
    setIsSaving(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save Master Data item.');
    } else {
      setIsModalOpen(false);
      setSuccessMessage(`Master item "${itemToSave.name}" (${itemToSave.category}) saved successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleOpenDelete = (item: MasterDataItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const res = await supabaseDataService.deleteMasterItem(itemToDelete.id, currentUser?.name || currentUser?.email);
    if (!res.success) {
      alert(res.error || 'Failed to delete master item.');
    } else {
      setSuccessMessage(`Deleted "${itemToDelete.name}" from ${itemToDelete.category}.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  // Preset size matrix quick buttons
  const applySizeMatrixPreset = (presetName: string, sizes: string) => {
    setFormName(presetName);
    setFormDescription(sizes);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Master Data Configuration & Size Matrix"
        description="Universal Factory Control: Centralized Management of Size Matrices, Buyers, Garment Types, Colors, Seasons, Wash Categories, Defect Codes & Suppliers across all panels"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenAdd('SizeMatrix')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
            >
              <Ruler className="h-4 w-4" />
              + Add Size Matrix
            </button>
            <button
              onClick={() => handleOpenAdd('Buyer')}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              + Add Master Record
            </button>
          </div>
        }
      />

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* Group Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => { setSelectedGroupFilter('ALL'); setSelectedCategoryFilter('ALL'); }}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              selectedGroupFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Master Panels ({CATEGORY_CONFIGS.length})
          </button>
          <button
            onClick={() => { setSelectedGroupFilter('sizing'); setSelectedCategoryFilter('ALL'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              selectedGroupFilter === 'sizing'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            <Ruler className="h-3.5 w-3.5" />
            Size Matrix & Scales
          </button>
          <button
            onClick={() => { setSelectedGroupFilter('commercial'); setSelectedCategoryFilter('ALL'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              selectedGroupFilter === 'commercial'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Buyers, Brands & Seasons
          </button>
          <button
            onClick={() => { setSelectedGroupFilter('product'); setSelectedCategoryFilter('ALL'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              selectedGroupFilter === 'product'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            Garments, Fabrics & Colors
          </button>
          <button
            onClick={() => { setSelectedGroupFilter('quality_wash'); setSelectedCategoryFilter('ALL'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              selectedGroupFilter === 'quality_wash'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Wash & Defect Codes
          </button>
          <button
            onClick={() => { setSelectedGroupFilter('manufacturing'); setSelectedCategoryFilter('ALL'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              selectedGroupFilter === 'manufacturing'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            <Scissors className="h-3.5 w-3.5" />
            Sewing Lines & Manufacturing
          </button>
          <button
            onClick={() => { setSelectedGroupFilter('supply'); setSelectedCategoryFilter('ALL'); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              selectedGroupFilter === 'supply'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            Suppliers & UOM
          </button>
        </div>

        {/* Search filter */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search master data..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Grid of Master Data Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredConfigs.map(cfg => {
          const rawItems = itemsByCategory.get(cfg.key) || [];
          const sq = searchQuery.trim().toLowerCase();
          const items = rawItems.filter(item => {
            if (!sq) return true;
            return (
              item.name.toLowerCase().includes(sq) ||
              (item.code && item.code.toLowerCase().includes(sq)) ||
              (item.description && item.description.toLowerCase().includes(sq))
            );
          });

          const IconComp = cfg.icon;

          return (
            <div
              key={cfg.key}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                      <IconComp className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        {cfg.title}
                        <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold">
                          {items.length}
                        </span>
                      </h3>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenAdd(cfg.key)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </button>
                </div>

                {/* Card Item List */}
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {items.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded-xl">
                      {searchQuery ? 'No matching master items.' : 'No entries yet. Click "+ Add" to create.'}
                    </div>
                  ) : (
                    items.map(item => {
                      const isMatrix = item.category === 'SizeMatrix';
                      const parsedSizes = isMatrix ? parseSizeMatrixDescription(item.description) : [];

                      return (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 transition-colors flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-extrabold text-xs text-slate-900 truncate">{item.name}</span>
                              {item.code && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 shrink-0">
                                  {item.code}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  item.status === 'Inactive'
                                    ? 'bg-slate-200 text-slate-600'
                                    : `${cfg.badgeBg} ${cfg.badgeText}`
                                }`}
                              >
                                {item.status === 'Inactive' ? 'Inactive' : cfg.badgeLabel}
                              </span>

                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                title="Edit Item"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleOpenDelete(item)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                title="Delete Item"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Size matrix pill tags representation */}
                          {isMatrix && parsedSizes.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {parsedSizes.map((sz, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-2 py-0.5 text-[10px] font-black rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700"
                                >
                                  {sz}
                                </span>
                              ))}
                            </div>
                          )}

                          {!isMatrix && item.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-1">{item.description}</p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Bottom Quick Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Total Active: {items.filter(i => i.status !== 'Inactive').length}</span>
                <span className="text-blue-600 font-semibold cursor-pointer hover:underline" onClick={() => handleOpenAdd(cfg.key)}>
                  + New {cfg.shortLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        title={editingItem ? `Edit Master Record (${formCategory})` : `Add New Master Record`}
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Category Selector if creating new */}
          {!editingItem && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Master Category *</label>
              <select
                value={formCategory}
                onChange={e => {
                  const newCat = e.target.value as MasterCategory;
                  setFormCategory(newCat);
                  const cfg = CATEGORY_CONFIGS.find(c => c.key === newCat) || CATEGORY_CONFIGS[0];
                  setFormCode(`${cfg.codePrefix}${Date.now().toString().slice(-4)}`);
                }}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORY_CONFIGS.map(c => (
                  <option key={c.key} value={c.key}>
                    {c.title} ({c.shortLabel})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick presets for Size Matrix */}
          {formCategory === 'SizeMatrix' && !editingItem && (
            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-2">
              <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                Quick Size Matrix Presets (Click to Auto-fill):
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applySizeMatrixPreset('Alpha Standard (XS - 2XL)', 'XS, S, M, L, XL, 2XL')}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  Alpha (XS - 2XL)
                </button>
                <button
                  type="button"
                  onClick={() => applySizeMatrixPreset('Alpha Extended (XS - 4XL)', 'XS, S, M, L, XL, 2XL, 3XL, 4XL')}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  Alpha Ext (XS - 4XL)
                </button>
                <button
                  type="button"
                  onClick={() => applySizeMatrixPreset('Waist Numeric (28 - 38)', '28, 30, 32, 34, 36, 38')}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  Waist (28 - 38)
                </button>
                <button
                  type="button"
                  onClick={() => applySizeMatrixPreset('Waist Extended (28 - 42)', '28, 29, 30, 31, 32, 33, 34, 36, 38, 40, 42')}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  Waist Ext (28 - 42)
                </button>
                <button
                  type="button"
                  onClick={() => applySizeMatrixPreset('Euro Numeric (36 - 46)', '36, 38, 40, 42, 44, 46')}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  Euro (36 - 46)
                </button>
                <button
                  type="button"
                  onClick={() => applySizeMatrixPreset('Kids Standard (4Y - 14Y)', '4Y, 6Y, 8Y, 10Y, 12Y, 14Y')}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  Kids (4Y - 14Y)
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Master Code</label>
              <input
                type="text"
                value={formCode}
                onChange={e => setFormCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500"
                placeholder={`${currentCategoryConfig.codePrefix}001`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
              <select
                value={formStatus}
                onChange={e => setFormStatus(e.target.value as 'Active' | 'Inactive')}
                className="w-full rounded-xl border border-slate-200 p-2 text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="Active">Active (Available across all modules)</option>
                <option value="Inactive">Inactive (Disabled)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {formCategory === 'SizeMatrix' ? 'Size Matrix Name *' : `${currentCategoryConfig.shortLabel} Name / Description *`}
            </label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 text-xs font-bold focus:ring-2 focus:ring-blue-500"
              placeholder={currentCategoryConfig.placeholder}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {formCategory === 'SizeMatrix' ? 'Sizes in Matrix (Comma-Separated) *' : 'Description / Specifications (Optional)'}
            </label>
            <textarea
              rows={formCategory === 'SizeMatrix' ? 3 : 2}
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2 text-xs font-medium focus:ring-2 focus:ring-blue-500"
              placeholder={currentCategoryConfig.descriptionHelp}
            />
            {formCategory === 'SizeMatrix' && formDescription && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500">Live Size Preview:</span>
                {parseSizeMatrixDescription(formDescription).map((sz, i) => (
                  <span key={i} className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                    {sz}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); setEditingItem(null); }}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 hover:bg-slate-50 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : editingItem ? 'Update Master Record' : 'Save Master Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Confirm Master Data Deletion"
        message={`Are you sure you want to delete "${itemToDelete?.name}" (${itemToDelete?.code || itemToDelete?.category}) from Master Data?`}
        confirmLabel="Delete Item"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }}
      />
    </div>
  );
};
