import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useERP } from '../../../context/ERPContext';
import { isGlobalUser } from '../../../utils/authUtils';

// Sub-components for all separate Department Reports
import { MonthlyYearlyReport } from './MonthlyYearlyReport';
import { DailyFactoryReport } from './DailyFactoryReport';
import { CuttingReport } from './CuttingReport';
import { SewingReport } from './SewingReport';
import { WashingReport } from './WashingReport';
import { FinishingReport } from './FinishingReport';
import { QCReport } from './QCReport';
import { PackingReport } from './PackingReport';
import { StoreReport } from './StoreReport';
import { ShipmentReport } from './ShipmentReport';
import { MerchandisingReport } from './MerchandisingReport';
import { StyleReconciliationReport } from './StyleReconciliationReport';
import { LinePerformanceReport } from './LinePerformanceReport';
import { HRReport } from './HRReport';

export type ReportTabKey =
  | 'monthly_yearly'
  | 'daily'
  | 'cutting'
  | 'sewing'
  | 'washing'
  | 'finishing'
  | 'qc'
  | 'packing'
  | 'store'
  | 'shipment'
  | 'merchandising'
  | 'reconciliation'
  | 'line'
  | 'hr';

export const ReportsModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { activeModule, setActiveModule } = useERP();

  // Determine active report based on activeModule or user department
  const resolveActiveTab = (): ReportTabKey => {
    if (activeModule === 'rpt_monthly_yearly' || activeModule === 'rpt_monthly') return 'monthly_yearly';
    if (activeModule === 'rpt_daily') return 'daily';
    if (activeModule === 'rpt_cutting') return 'cutting';
    if (activeModule === 'rpt_sewing') return 'sewing';
    if (activeModule === 'rpt_washing') return 'washing';
    if (activeModule === 'rpt_finishing') return 'finishing';
    if (activeModule === 'rpt_qc') return 'qc';
    if (activeModule === 'rpt_packing') return 'packing';
    if (activeModule === 'rpt_store') return 'store';
    if (activeModule === 'rpt_shipment') return 'shipment';
    if (activeModule === 'rpt_merchandising' || activeModule === 'rpt_style' || activeModule === 'rpt_po' || activeModule === 'rpt_colour') return 'merchandising';
    if (activeModule === 'rpt_reconciliation') return 'reconciliation';
    if (activeModule === 'rpt_line') return 'line';
    if (activeModule === 'rpt_hr') return 'hr';

    // If generic 'reports', default to monthly_yearly reporting suite
    return 'monthly_yearly';
  };

  const activeTab = resolveActiveTab();

  // Render individual dedicated department report component
  switch (activeTab) {
    case 'monthly_yearly':
      return <MonthlyYearlyReport />;
    case 'daily':
      return <DailyFactoryReport />;
    case 'cutting':
      return <CuttingReport />;
    case 'sewing':
      return <SewingReport />;
    case 'washing':
      return <WashingReport />;
    case 'finishing':
      return <FinishingReport />;
    case 'qc':
      return <QCReport />;
    case 'packing':
      return <PackingReport />;
    case 'store':
      return <StoreReport />;
    case 'shipment':
      return <ShipmentReport />;
    case 'merchandising':
      return <MerchandisingReport />;
    case 'reconciliation':
      return <StyleReconciliationReport />;
    case 'line':
      return <LinePerformanceReport />;
    case 'hr':
      return <HRReport />;
    default:
      return <MonthlyYearlyReport />;
  }
};
