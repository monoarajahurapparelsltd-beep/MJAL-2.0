import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ERPProvider, useERP } from './context/ERPContext';
import { ToastProvider } from './context/ToastContext';
import { LoginPage } from './components/auth/LoginPage';
import { AppLayout } from './components/layout/AppLayout';
import { MainDashboard } from './components/modules/dashboard/MainDashboard';
import { DepartmentDashboard } from './components/modules/dashboard/DepartmentDashboard';
import { MDDashboard } from './components/modules/dashboard/MDDashboard';
import { DirectorDashboard } from './components/modules/dashboard/DirectorDashboard';
import { GMDashboard } from './components/modules/dashboard/GMDashboard';
import { ExecutiveDashboardSuite } from './components/modules/dashboard/ExecutiveDashboardSuite';
import { OrderManagement } from './components/modules/order/OrderManagement';
import { MerchandisingModule } from './components/modules/merchandising/MerchandisingModule';
import { SampleModule } from './components/modules/sample/SampleModule';
import { StoreModule } from './components/modules/store/StoreModule';
import { CuttingModule } from './components/modules/cutting/CuttingModule';
import { SewingModule } from './components/modules/sewing/SewingModule';
import { WashingModule } from './components/modules/washing/WashingModule';
import { FinishingModule } from './components/modules/finishing/FinishingModule';
import { QCModule } from './components/modules/qc/QCModule';
import { PackingModule } from './components/modules/packing/PackingModule';
import { ShipmentModule } from './components/modules/shipment/ShipmentModule';
import { HRModule } from './components/modules/hr/HRModule';
import { ReportsModule } from './components/modules/reports/ReportsModule';
import { MasterDataModule } from './components/modules/master/MasterDataModule';
import { DepartmentTransferQueue } from './components/common/DepartmentTransferQueue';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { AuditTrailModal } from './components/common/AuditTrailModal';
import { SuperAdminSetupModal } from './components/common/SuperAdminSetupModal';
import { AccessDeniedGuard } from './components/common/AccessDeniedGuard';
import { canAccessModule, hasValidScope, getDefaultModuleForUser } from './utils/authUtils';

const AppContent: React.FC = () => {
  const { currentUser } = useAuth();
  const { activeModule, setActiveModule, isSetupOpen, setIsSetupOpen } = useERP();

  // Auto-redirect to user default authorized module if active module is not permitted
  React.useEffect(() => {
    if (currentUser && !canAccessModule(currentUser, activeModule)) {
      const defaultMod = getDefaultModuleForUser(currentUser);
      setActiveModule(defaultMod);
    }
  }, [currentUser, activeModule, setActiveModule]);

  if (!currentUser) {
    return (
      <>
        <LoginPage />
        <SuperAdminSetupModal isOpen={isSetupOpen} onClose={() => setIsSetupOpen(false)} />
      </>
    );
  }

  // FAIL CLOSED: If non-global user lacks department scope
  if (!hasValidScope(currentUser)) {
    return <AccessDeniedGuard reason="MISSING_SCOPE" attemptedModule={activeModule} />;
  }

  // STRICT ROUTE GUARD: Check authorization for active module
  if (!canAccessModule(currentUser, activeModule)) {
    return <AccessDeniedGuard reason="UNAUTHORIZED" attemptedModule={activeModule} />;
  }

  const renderActiveModule = () => {
    // Role specific dashboard routing when on 'dashboard'
    if (activeModule === 'dashboard') {
      if (['MD', 'Managing Director (MD)'].includes(currentUser?.role)) return <MDDashboard />;
      if (['DIRECTOR', 'Director'].includes(currentUser?.role)) return <DirectorDashboard />;
      if (['GM', 'General Manager (GM)'].includes(currentUser?.role)) return <GMDashboard />;
      if (['ADMIN', 'Admin', 'Super Admin', 'SUPER_ADMIN'].includes(currentUser?.role)) {
        return (
          <ExecutiveDashboardSuite
            roleTitle="Executive Board & Admin Management"
            roleBadgeColor="purple"
            defaultTab="financial"
          />
        );
      }
      return <DepartmentDashboard />;
    }

    if (activeModule === 'dashboard_md') return <MDDashboard />;
    if (activeModule === 'dashboard_director') return <DirectorDashboard />;
    if (activeModule === 'dashboard_gm') return <GMDashboard />;

    if (activeModule.startsWith('hr_')) return <HRModule />;
    if (activeModule.startsWith('rpt_')) return <ReportsModule />;
    if (activeModule === 'master_data' || activeModule === 'master') return <MasterDataModule />;

    if (activeModule === 'orders') return <OrderManagement />;
    if (activeModule === 'merchandising') return <MerchandisingModule />;
    if (activeModule === 'sample') return <SampleModule />;
    if (activeModule === 'store' || activeModule.startsWith('store_')) return <StoreModule />;
    if (activeModule === 'cutting' || activeModule.startsWith('cutting_')) return <CuttingModule />;
    if (
      activeModule === 'sewing' ||
      activeModule.startsWith('sewing_') ||
      activeModule.startsWith('targets_') ||
      activeModule === 'ta_calendar'
    ) {
      return <SewingModule />;
    }
    if (activeModule === 'washing' || activeModule.startsWith('washing_')) return <WashingModule />;
    if (
      activeModule === 'finishing' ||
      activeModule.startsWith('finishing_') ||
      activeModule === 'packing' ||
      activeModule.startsWith('packing_')
    ) {
      return <FinishingModule />;
    }
    if (activeModule === 'qc' || activeModule.startsWith('qc_')) return <QCModule />;
    if (activeModule === 'shipment' || activeModule.startsWith('shipment_')) return <ShipmentModule />;
    if (activeModule === 'transfers') {
      return (
        <DepartmentTransferQueue
          department="All"
          title="Inter-Department Product Transfer & Return Challan Central Hub"
        />
      );
    }
    if (activeModule === 'hr') return <HRModule />;
    if (activeModule === 'reports') return <ReportsModule />;

    return <MainDashboard />;
  };

  return (
    <AppLayout>
      {renderActiveModule()}

      {/* Global Modals Escaped via Portals */}
      <GlobalSearchModal />
      <AuditTrailModal />
      <SuperAdminSetupModal isOpen={isSetupOpen} onClose={() => setIsSetupOpen(false)} />
    </AppLayout>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ERPProvider>
            <AppContent />
          </ERPProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
