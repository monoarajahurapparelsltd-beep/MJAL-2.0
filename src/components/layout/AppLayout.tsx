import React, { useState, useMemo, useEffect, useRef } from 'react';
import Hammer from 'hammerjs';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { 
  Menu, 
  LayoutDashboard, 
  ShoppingBag, 
  Sparkles, 
  ArrowRightLeft, 
  Layers, 
  Factory, 
  Download,
  Scissors,
  Shirt,
  Waves,
  ClipboardCheck,
  PackageCheck,
  Truck,
  Warehouse,
  Target,
  Users,
  Clock,
  FileSpreadsheet,
  FlaskConical,
  Box,
  CheckCircle2
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { useAuth } from '../../context/AuthContext';
import { PWAInstallBanner } from '../common/PWAInstallBanner';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { ThemeToggle } from '../common/ThemeToggle';
import { isGlobalUser, isMD, isSuperAdmin, isManagement, canAccessModule } from '../../utils/authUtils';

export interface AppLayoutProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

interface MobileNavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
  matchPrefix?: string;
}

/**
 * AppLayout: Mobile-Optimized Master Viewport Shell with Dynamic Department-Wise Bottom Navigation & Universal TopNav
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ children, headerContent }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const isMobileSidebarOpenRef = useRef(isMobileSidebarOpen);
  isMobileSidebarOpenRef.current = isMobileSidebarOpen;

  const appContainerRef = useRef<HTMLDivElement>(null);
  const { activeModule, setActiveModule, transfers } = useERP();
  const { currentUser } = useAuth();
  const { isInstallable, isInstalled, triggerInstall } = usePWAInstall();

  // Initialize Hammer.js gesture recognizer for smooth mobile swipe interactions
  useEffect(() => {
    const el = appContainerRef.current;
    if (!el || typeof window === 'undefined') return;

    const hammer = new Hammer(el, {
      touchAction: 'pan-y'
    });

    // Configure horizontal swipe gesture
    hammer.get('swipe').set({
      direction: Hammer.DIRECTION_HORIZONTAL,
      threshold: 25,
      velocity: 0.2
    });

    // Swipe Right: Smoothly open mobile sidebar
    hammer.on('swiperight', (e) => {
      if (window.innerWidth >= 1024) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (!isMobileSidebarOpenRef.current) {
        setIsMobileSidebarOpen(true);
      }
    });

    // Swipe Left: Smoothly close mobile sidebar
    hammer.on('swipeleft', () => {
      if (window.innerWidth >= 1024) return;
      if (isMobileSidebarOpenRef.current) {
        setIsMobileSidebarOpen(false);
      }
    });

    return () => {
      hammer.destroy();
    };
  }, []);

  // Pending transfers calculation for real-time live navigation badge
  const pendingTransfersCount = useMemo(() => {
    const allPending = (transfers || []).filter(
      t => t.status === 'Dispatched' || t.status === 'In Transit'
    );
    if (!currentUser || isGlobalUser(currentUser)) {
      return allPending.length;
    }
    return allPending.filter(
      t => t.toDepartment === currentUser.department || t.fromDepartment === currentUser.department
    ).length;
  }, [transfers, currentUser]);

  // Derive active module title for mobile top bar
  const getModuleTitle = () => {
    if (activeModule.startsWith('dashboard')) {
      if (isMD(currentUser)) return 'MD Executive Suite';
      if (currentUser?.department) return `${currentUser.department} Dashboard`;
      return 'Factory Dashboard';
    }
    if (activeModule === 'orders') return 'Order Management';
    if (activeModule === 'merchandising') return 'Merchandising & BOM';
    if (activeModule === 'sample') return 'Sample Development';
    if (activeModule.startsWith('store')) return 'Store & Inventory';
    if (activeModule.startsWith('cutting')) return 'Cutting Section';
    if (activeModule.startsWith('sewing') || activeModule.startsWith('targets')) return 'Sewing Production Floor';
    if (activeModule.startsWith('washing')) return 'Washing Unit';
    if (activeModule.startsWith('finishing')) return 'Finishing Section';
    if (activeModule.startsWith('packing')) return 'Packing & Cartons';
    if (activeModule.startsWith('qc')) return 'Quality Control (QC)';
    if (activeModule.startsWith('shipment')) return 'Commercial Shipment';
    if (activeModule === 'transfers') return 'Transfer Challan Hub';
    if (activeModule.startsWith('hr')) return 'HR & Workforce';
    if (activeModule === 'rpt_monthly_yearly' || activeModule === 'rpt_monthly') return 'Month & Yearly Report';
    if (activeModule.startsWith('rpt') || activeModule === 'reports') return 'Reports & Analytics';
    if (activeModule === 'master_data' || activeModule === 'master') return 'Master Data Control';
    return 'ERP Portal';
  };

  /**
   * Dynamic Department-Wise Bottom Navigation Items
   */
  const mobileNavItems: MobileNavItem[] = useMemo(() => {
    const dept = currentUser?.department;
    const isMdUser = isMD(currentUser);
    const isExecutive = isGlobalUser(currentUser) || isMdUser || isSuperAdmin(currentUser) || isManagement(currentUser);

    let items: MobileNavItem[] = [];

    if (isMdUser) {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'orders', label: 'Order', icon: ShoppingBag, matchPrefix: 'orders' },
        { id: 'sample', label: 'Sample', icon: FlaskConical, matchPrefix: 'sample' },
        { id: 'rpt_monthly_yearly', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else if (isExecutive && (!dept || dept === 'All' || dept === 'Executive' || dept === 'Head Office')) {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'orders', label: 'Order', icon: ShoppingBag, matchPrefix: 'orders' },
        { id: 'sample', label: 'Sample', icon: FlaskConical, matchPrefix: 'sample' },
        { id: 'rpt_monthly_yearly', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else if (dept === 'Cutting') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'cutting', label: 'Cutting', icon: Scissors, matchPrefix: 'cutting' },
        { id: 'rpt_cutting', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
        { id: 'rpt_monthly_yearly', label: 'Monthly', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else if (dept === 'Sewing' || dept === 'Production Planning') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'sewing', label: 'Sewing Floor', icon: Shirt, matchPrefix: 'sewing' },
        { id: 'targets_daily', label: 'Targets', icon: Target, matchPrefix: 'targets' },
        { id: 'rpt_sewing', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else if (dept === 'Finishing') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'finishing', label: 'Finishing', icon: Sparkles, matchPrefix: 'finishing' },
        { id: 'packing', label: 'Packing', icon: PackageCheck, matchPrefix: 'packing' },
        { id: 'rpt_finishing', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else if (dept === 'Washing') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'washing', label: 'Wash Entry', icon: Waves, matchPrefix: 'washing' },
        { id: 'rpt_washing', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
        { id: 'rpt_monthly_yearly', label: 'Monthly', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else if (dept === 'Store') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'store', label: 'Stock Master', icon: Warehouse, matchPrefix: 'store' },
        { id: 'store_trims', label: 'Trims Stock', icon: Box },
        { id: 'rpt_store', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else if (dept === 'Packing') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'packing', label: 'Packing', icon: PackageCheck, matchPrefix: 'packing' },
        { id: 'shipment', label: 'Shipment', icon: Truck, matchPrefix: 'shipment' },
        { id: 'rpt_packing', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else if (dept === 'Shipment') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'shipment', label: 'Shipment', icon: Truck, matchPrefix: 'shipment' },
        { id: 'orders', label: 'Orders', icon: ShoppingBag },
        { id: 'rpt_shipment', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else if (dept === 'Merchandising') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'orders', label: 'Orders', icon: ShoppingBag },
        { id: 'merchandising', label: 'Merchandising', icon: Layers, matchPrefix: 'merchandising' },
        { id: 'sample', label: 'Samples', icon: FlaskConical, matchPrefix: 'sample' },
      ];
    } else if (dept === 'Sample') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'sample', label: 'Samples', icon: FlaskConical, matchPrefix: 'sample' },
        { id: 'merchandising', label: 'Merchandising', icon: Layers, matchPrefix: 'merchandising' },
        { id: 'orders', label: 'Orders', icon: ShoppingBag },
      ];
    } else if (dept === 'HR & Admin' || dept === 'HR') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'hr_employees', label: 'Employees', icon: Users, matchPrefix: 'hr' },
        { id: 'hr_attendance', label: 'Attendance', icon: Clock },
        { id: 'rpt_hr', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else if (dept === 'QC') {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'qc', label: 'QC Entry', icon: ClipboardCheck, matchPrefix: 'qc' },
        { id: 'rpt_qc', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
        { id: 'rpt_monthly_yearly', label: 'Monthly', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    } else {
      items = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' },
        { id: 'orders', label: 'Orders', icon: ShoppingBag },
        { id: 'sample', label: 'Sample', icon: FlaskConical, matchPrefix: 'sample' },
        { id: 'rpt_monthly_yearly', label: 'Reports', icon: FileSpreadsheet, matchPrefix: 'rpt' },
      ];
    }

    const authorizedItems = items.filter(item => canAccessModule(currentUser, item.id));

    return authorizedItems.length > 0
      ? authorizedItems
      : [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, matchPrefix: 'dashboard' }];
  }, [currentUser]);

  const isItemActive = (item: MobileNavItem) => {
    if (activeModule === item.id) return true;
    if (item.matchPrefix && activeModule.startsWith(item.matchPrefix)) return true;
    if (item.id === 'rpt_monthly_yearly' && (activeModule === 'reports' || activeModule.startsWith('rpt'))) return true;
    if (item.id === 'orders' && (activeModule === 'orders' || activeModule.startsWith('order'))) return true;
    if (item.id === 'sample' && (activeModule === 'sample' || activeModule.startsWith('sample'))) return true;
    if (item.id === 'dashboard' && activeModule.startsWith('dashboard')) return true;
    return false;
  };

  return (
    <div
      id="app-root-shell"
      ref={appContainerRef}
      className="h-screen h-[100dvh] w-screen flex flex-col lg:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 text-xs antialiased selection:bg-blue-600 selection:text-white relative transition-colors duration-200"
    >
      {/* PWA Prompt Banner at Top */}
      <PWAInstallBanner />

      {/* Mobile Top Navigation Header */}
      <header className="lg:hidden shrink-0 h-14 bg-slate-900 border-b border-slate-800 text-white px-3 flex items-center justify-between z-30 shadow-sm select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 active:scale-95 transition-transform cursor-pointer shrink-0"
            title="Open Full Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <Factory className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs text-white truncate font-sans">MJAL ERP</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-400/20 truncate max-w-[100px]">
                  {currentUser?.department || 'Executive'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate font-semibold">
                {getModuleTitle()}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mobile Theme Toggle Button */}
          <ThemeToggle size="sm" variant="button" />

          {/* Quick PWA Install Icon on Mobile if Installable */}
          {isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={() => triggerInstall()}
              className="h-8 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
              title="Install PWA App"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">App</span>
            </button>
          )}

          {/* User Avatar Badge */}
          {currentUser && (
            <div 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="h-8 w-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-blue-300 cursor-pointer shadow-xs"
              title={`${currentUser.name} (${currentUser.role})`}
            >
              {currentUser.name.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </header>

      {/* Main Structural Wrapper (Sidebar + Dynamic Content) */}
      <div className="flex-1 flex min-w-0 h-full overflow-hidden relative">
        {/* Left Navigation Bar Drawer */}
        <Sidebar
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Dynamic Content Area with TopNav + Isolated Scroll */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
          {/* Universal Desktop/Laptop Top Navigation Header */}
          <div className="hidden lg:block shrink-0 relative z-40">
            <TopNav onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)} />
          </div>

          {headerContent && (
            <header className="shrink-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              {headerContent}
            </header>
          )}

          <main
            id="main-content"
            className="flex-1 min-w-0 h-full overflow-y-auto p-2.5 sm:p-3 md:p-4 pb-20 lg:pb-4 transition-colors duration-200 overscroll-y-contain"
          >
            <div className="max-w-[1600px] mx-auto space-y-3 sm:space-y-4">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Dynamic Department & Role Aware Mobile Bottom Navigation Bar */}
      <nav 
        id="mobile-bottom-nav"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-400 h-14 flex items-center justify-around px-1 select-none shadow-lg"
      >
        {mobileNavItems.map(item => {
          const Icon = item.icon;
          const active = isItemActive(item);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModule(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors relative cursor-pointer ${
                active ? 'text-blue-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 mb-0.5 ${active ? 'text-blue-400 scale-110' : 'text-slate-400'} transition-transform`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2.5 h-3.5 min-w-[14px] px-1 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center animate-pulse shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] leading-tight truncate max-w-[68px]">{item.label}</span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}

        {/* Universal All Menu Drawer Button */}
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <Menu className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] leading-tight">All Menu</span>
        </button>
      </nav>
    </div>
  );
};
