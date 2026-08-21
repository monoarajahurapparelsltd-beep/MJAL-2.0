import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Layers,
  FlaskConical,
  Warehouse,
  Scissors,
  Shirt,
  Waves,
  Sparkles,
  ClipboardCheck,
  Box,
  Truck,
  Calendar,
  Target,
  Users,
  UserCog,
  FileSpreadsheet,
  Award,
  Database,
  ChevronDown,
  ChevronRight,
  X,
  CheckCircle2,
  Send,
  Clock,
  ArrowRightLeft,
  Flame,
  Tag,
  Archive,
  PackageCheck,
  RotateCcw,
  LogOut,
  Factory
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { canAccessModule, isMD, isSuperAdmin, isManagement } from '../../utils/authUtils';

interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile?: () => void;
}

interface NavSubItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  subItems?: NavSubItem[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const safeCloseMobile = () => {
    if (typeof onCloseMobile === 'function') onCloseMobile();
  };
  const { activeModule, setActiveModule, setIsSetupOpen, transfers } = useERP();
  const { currentUser, logout } = useAuth();

  const handleSidebarLogout = async () => {
    setIsSetupOpen(false);
    await logout();
    safeCloseMobile();
  };

  // Pending Transfers & Handovers calculation for real-time navigation badges
  const pendingTransfers = (transfers || []).filter(t => t.status === 'Dispatched' || t.status === 'In Transit');

  const getDynamicBadge = (moduleId: string): string | undefined => {
    switch (moduleId) {
      case 'transfers': {
        const count = pendingTransfers.length;
        return count > 0 ? `${count} Pending` : undefined;
      }
      case 'cutting': {
        const count = pendingTransfers.filter(t => t.fromDepartment === 'Cutting' || t.toDepartment === 'Cutting').length;
        return count > 0 ? `${count} Pnd` : undefined;
      }
      case 'cutting_transfers': {
        const count = pendingTransfers.filter(t => t.fromDepartment === 'Cutting' || t.toDepartment === 'Cutting').length;
        return count > 0 ? `${count} Pending` : undefined;
      }
      case 'sewing': {
        const inbound = pendingTransfers.filter(t => t.toDepartment === 'Sewing').length;
        const outbound = pendingTransfers.filter(t => t.fromDepartment === 'Sewing').length;
        const total = inbound + outbound;
        return total > 0 ? `${total} Pnd` : undefined;
      }
      case 'sewing_input_receive': {
        const count = pendingTransfers.filter(t => t.toDepartment === 'Sewing').length;
        return count > 0 ? `${count} Inbound` : undefined;
      }
      case 'sewing_handover': {
        const count = pendingTransfers.filter(t => t.fromDepartment === 'Sewing').length;
        return count > 0 ? `${count} Outbound` : undefined;
      }
      case 'washing': {
        const count = pendingTransfers.filter(t => t.fromDepartment === 'Washing' || t.toDepartment === 'Washing').length;
        return count > 0 ? `${count} Pnd` : undefined;
      }
      case 'washing_to_finishing': {
        const count = pendingTransfers.filter(t => t.fromDepartment === 'Washing' && t.toDepartment === 'Finishing').length;
        return count > 0 ? `${count} Handover` : undefined;
      }
      case 'washing_transfers': {
        const count = pendingTransfers.filter(t => t.fromDepartment === 'Washing' || t.toDepartment === 'Washing').length;
        return count > 0 ? `${count} Pending` : undefined;
      }
      case 'finishing': {
        const count = pendingTransfers.filter(t => t.fromDepartment === 'Finishing' || t.toDepartment === 'Finishing').length;
        return count > 0 ? `${count} Pnd` : undefined;
      }
      case 'finishing_transfers': {
        const count = pendingTransfers.filter(t => t.fromDepartment === 'Finishing' || t.toDepartment === 'Finishing').length;
        return count > 0 ? `${count} Pending` : undefined;
      }
      case 'qc_transfers': {
        const count = pendingTransfers.filter(t => t.fromDepartment === 'QC' || t.toDepartment === 'QC').length;
        return count > 0 ? `${count} Returns` : undefined;
      }
      default:
        return undefined;
    }
  };

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Operations: true,
    Planning: true,
    'HR & Admin': false,
    'Department Reports': true,
    Reports: true,
    Management: true,
    Settings: false
  });

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    cutting: true,
    sewing: true,
    washing: true,
    finishing: true,
    shipment: true,
    qc: true,
    store: true
  });

  // Auto expand parent module item when activeModule changes
  useEffect(() => {
    if (!activeModule) return;
    const parentPrefix = activeModule.split('_')[0];
    if (parentPrefix && ['cutting', 'sewing', 'washing', 'finishing', 'shipment', 'qc', 'store', 'targets', 'hr', 'rpt'].includes(parentPrefix)) {
      setExpandedItems(prev => ({ ...prev, [parentPrefix]: true }));
    }
  }, [activeModule]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const navSections: NavSection[] = [
    {
      title: 'Operations',
      items: [
        { id: 'orders', label: 'Order Management', icon: ShoppingBag },
        { id: 'merchandising', label: 'Merchandising & BOM', icon: Layers },
        { id: 'sample', label: 'Sample Follow-up', icon: FlaskConical },
        {
          id: 'store',
          label: 'Store & Inventory',
          icon: Warehouse,
          subItems: [
            { id: 'store', label: 'Fabric Stock & Log', icon: Warehouse },
            { id: 'store_trims', label: 'Trims & Accessories', icon: Box },
            { id: 'store_fg', label: 'Finished Goods Store', icon: Layers },
            { id: 'store_ledger', label: 'Transaction Ledger', icon: FileSpreadsheet }
          ]
        },
        {
          id: 'cutting',
          label: 'Cutting Floor',
          icon: Scissors,
          subItems: [
            { id: 'cutting', label: 'Style Cutting Master', icon: Scissors },
            { id: 'cutting_transfers', label: 'Transfers & Returns', icon: Send }
          ]
        },
        {
          id: 'sewing',
          label: currentUser?.line_no ? `Sewing (${currentUser.line_no})` : 'Sewing Production',
          icon: Shirt,
          subItems: [
            { id: 'sewing', label: 'Line Production Log', icon: Shirt },
            { id: 'sewing_input_receive', label: 'Input Received Log', icon: CheckCircle2 },
            { id: 'sewing_targets', label: 'Line Target Allocations', icon: Target },
            { id: 'sewing_handover', label: 'Handover & Gate Passes', icon: Send }
          ]
        },
        {
          id: 'washing',
          label: 'Washing Unit',
          icon: Waves,
          subItems: [
            { id: 'washing', label: '1. Sewing Inbound & Dispatch', icon: Clock },
            { id: 'washing_plant_outward', label: '2. 3rd-Party Passes & Log', icon: Truck },
            { id: 'washing_to_finishing', label: '3. Handover to Finishing', icon: Send },
            { id: 'washing_summary', label: 'Outsourced Summary', icon: Sparkles },
            { id: 'washing_transfers', label: 'Transfer Queue', icon: ArrowRightLeft }
          ]
        },
        {
          id: 'finishing',
          label: 'Finishing Unit',
          icon: Sparkles,
          subItems: [
            { id: 'finishing', label: 'Process Master Matrix', icon: Layers },
            { id: 'finishing_thread_cut', label: '1. Thread Cutting', icon: Scissors },
            { id: 'finishing_iron', label: '2. Ironing', icon: Flame },
            { id: 'finishing_get_up', label: '3. Get Up Inspection', icon: Sparkles },
            { id: 'finishing_hangtag', label: '4. Hangtag & Labeling', icon: Tag },
            { id: 'finishing_poly', label: '5. Poly Packing', icon: Box },
            { id: 'finishing_carton', label: '6. Carton Packing', icon: Archive },
            { id: 'finishing_transfers', label: 'Transfers & Returns', icon: Send }
          ]
        },
        {
          id: 'qc',
          label: 'QC & Defect DHU',
          icon: ClipboardCheck,
          subItems: [
            { id: 'qc', label: 'QC Inspections & DHU', icon: ClipboardCheck },
            { id: 'qc_transfers', label: 'Defect Returns & Transfers', icon: RotateCcw }
          ]
        },
        {
          id: 'shipment',
          label: 'Shipment & Invoice',
          icon: Truck,
          subItems: [
            { id: 'shipment', label: '1. Ready for Shipment Queue', icon: PackageCheck },
            { id: 'shipment_history', label: '2. Consignment Export Log', icon: Truck }
          ]
        },
        { id: 'transfers', label: 'Central Transfer Hub', icon: Send }
      ]
    },
    {
      title: 'Planning',
      items: [
        { id: 'targets_daily', label: 'Daily Line Targets', icon: Target },
        { id: 'targets_monthly', label: 'Monthly Targets', icon: Calendar },
        { id: 'ta_calendar', label: 'T&A Calendar', icon: Calendar }
      ]
    },
    {
      title: 'Department Reports',
      items: [
        { id: 'rpt_monthly_yearly', label: 'Monthly & Yearly Summary', icon: Calendar, badge: 'Full Matrix' },
        { id: 'rpt_daily', label: 'Daily Factory Summary', icon: FileSpreadsheet },
        { id: 'rpt_cutting', label: 'Cutting Floor Report', icon: Scissors },
        { id: 'rpt_sewing', label: 'Sewing Lines Report', icon: Shirt },
        { id: 'rpt_washing', label: 'Washing & Treatment', icon: Waves },
        { id: 'rpt_finishing', label: 'Finishing & Ironing', icon: Sparkles },
        { id: 'rpt_qc', label: 'QC & Defect DHU', icon: ClipboardCheck },
        { id: 'rpt_store', label: 'Store & Inventory', icon: Warehouse },
        { id: 'rpt_shipment', label: 'Commercial Shipment', icon: Truck },
        { id: 'rpt_merchandising', label: 'Order Bookings', icon: ShoppingBag },
        { id: 'rpt_reconciliation', label: 'Style Reconciliation', icon: Layers },
        { id: 'rpt_line', label: 'Line Performance Audit', icon: Target },
        { id: 'rpt_hr', label: 'HR Attendance & OT', icon: Users }
      ]
    },
    {
      title: 'HR & Admin',
      items: [
        { id: 'hr_employees', label: 'Employee Directory', icon: Users },
        { id: 'hr_users', label: 'User & Role Matrix', icon: UserCog },
        { id: 'hr_payroll', label: 'Attendance & Payroll', icon: Calendar }
      ]
    },
    {
      title: 'Settings',
      items: [
        { id: 'master_data', label: 'Master Data Setup', icon: Database }
      ]
    }
  ];

  // Filter sections and items based on logged-in user authorization
  const filteredSections = navSections
    .map(sec => {
      return {
        ...sec,
        items: sec.items
          .filter(item => canAccessModule(currentUser, item.id))
          .map(item => ({
            ...item,
            subItems: item.subItems?.filter(sub => canAccessModule(currentUser, sub.id))
          }))
      };
    })
    .filter(sec => sec.items.length > 0);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={safeCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-900 text-slate-300 transition-transform duration-200 lg:static lg:h-full lg:z-10 lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Industrial Factory Logo Badge */}
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-md shadow-blue-500/20 ring-1 ring-white/20">
              <Factory className="h-5 w-5 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-slate-950" title="System Online">
                <span className="h-1 w-1 rounded-full bg-white animate-ping opacity-75" />
              </span>
            </div>

            {/* Company Name & Brand Identity */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-black uppercase tracking-wider text-white truncate font-sans">
                  Monoara Jahur
                </h1>
                <span className="shrink-0 rounded bg-blue-500/20 px-1 py-0.2 text-[8px] font-extrabold text-blue-300 border border-blue-400/30 leading-none">
                  MJAL
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400 truncate flex items-center gap-1 mt-0.5">
                <span className="text-blue-400 font-semibold">Apparels Ltd.</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Garments ERP</span>
              </p>
            </div>
          </div>
          <button
            onClick={safeCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800/80 hover:text-white transition-colors lg:hidden shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {/* Top Main Dashboard Link (Visible to MD / Management / Super Admin) */}
          {canAccessModule(currentUser, 'dashboard') && (
            <button
              onClick={() => {
                setActiveModule('dashboard');
                safeCloseMobile();
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
                activeModule === 'dashboard' || activeModule === 'dashboard_md'
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-md shadow-blue-600/20 ring-1 ring-white/20'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {isMD(currentUser)
                  ? 'Main Executive Dashboard'
                  : isSuperAdmin(currentUser) || isManagement(currentUser)
                  ? 'Main Factory Dashboard'
                  : `${currentUser?.department || 'Section'} Dashboard`}
              </span>
            </button>
          )}

          {/* Nav Sections */}
          {filteredSections.map(sec => (
            <div key={sec.title} className="space-y-1 pt-1">
              <button
                onClick={() => toggleSection(sec.title)}
                className="flex w-full items-center justify-between px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span>{sec.title}</span>
                {expandedSections[sec.title] ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                )}
              </button>

              {expandedSections[sec.title] && (
                <div className="space-y-0.5 pl-0.5">
                  {sec.items.map(item => {
                    const Icon = item.icon;
                    const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
                    const isParentActive =
                      activeModule === item.id ||
                      (hasSubItems && item.subItems?.some(s => s.id === activeModule));
                    const isItemExpanded = expandedItems[item.id] !== false;

                    return (
                      <div key={item.id} className="space-y-0.5">
                        <div
                          onClick={() => {
                            setActiveModule(item.id);
                            if (hasSubItems) {
                              setExpandedItems(prev => ({ ...prev, [item.id]: true }));
                            }
                            safeCloseMobile();
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-all ${
                            isParentActive && !hasSubItems
                              ? 'bg-blue-500/15 text-blue-300 font-bold ring-1 ring-blue-500/30'
                              : isParentActive
                              ? 'bg-slate-800/90 text-white font-bold'
                              : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                isParentActive ? 'text-blue-400' : 'text-slate-400'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {(() => {
                              const dynamicBadge = getDynamicBadge(item.id);
                              const effectiveBadge = dynamicBadge || item.badge;
                              if (!effectiveBadge) return null;
                              const isPending = Boolean(dynamicBadge);
                              return (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ${
                                  isPending
                                    ? 'bg-amber-500/25 text-amber-300 ring-1 ring-amber-500/40 animate-pulse'
                                    : 'bg-slate-800 text-slate-300 ring-1 ring-slate-700'
                                }`}>
                                  {isPending && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />}
                                  {effectiveBadge}
                                </span>
                              );
                            })()}
                            {hasSubItems && (
                              <button
                                type="button"
                                onClick={e => toggleItem(item.id, e)}
                                className="p-0.5 rounded-md hover:bg-slate-700/80 text-slate-400 hover:text-slate-200 transition-colors"
                              >
                                {isItemExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Child Sub-items Navigation */}
                        {hasSubItems && isItemExpanded && (
                          <div className="pl-3.5 pr-1 py-0.5 space-y-0.5 border-l border-slate-800 ml-3">
                            {item.subItems!.map(sub => {
                              const SubIcon = sub.icon || Icon;
                              const isSubActive = activeModule === sub.id;

                              return (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveModule(sub.id);
                                    safeCloseMobile();
                                  }}
                                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                                    isSubActive
                                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-xs'
                                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <SubIcon
                                      className={`h-3.5 w-3.5 shrink-0 ${
                                        isSubActive ? 'text-white' : 'text-slate-400'
                                      }`}
                                    />
                                    <span className="truncate">{sub.label}</span>
                                  </div>
                                  {(() => {
                                    const dynamicBadge = getDynamicBadge(sub.id);
                                    const effectiveBadge = dynamicBadge || sub.badge;
                                    if (!effectiveBadge) return null;
                                    const isPending = Boolean(dynamicBadge);
                                    return (
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                                        isPending
                                          ? 'bg-amber-500/30 text-amber-300 ring-1 ring-amber-400/50 animate-pulse'
                                          : 'bg-amber-500/20 text-amber-300'
                                      }`}>
                                        {isPending && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />}
                                        {effectiveBadge}
                                      </span>
                                    );
                                  })()}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* User Info Footer */}
        {currentUser && (
          <div className="border-t border-slate-800/80 bg-slate-950/90 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 ring-1 ring-white/10 text-xs font-bold text-white shadow-xs">
                  {currentUser.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden text-left min-w-0">
                  <p className="truncate text-xs font-bold text-white font-sans">{currentUser.name}</p>
                  <p className="truncate text-[10px] text-slate-400 font-medium">
                    <span className="text-blue-400 font-semibold">{currentUser.role}</span> • {currentUser.department} {currentUser.line_no ? `(${currentUser.line_no})` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSidebarLogout}
                title="Logout"
                className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
