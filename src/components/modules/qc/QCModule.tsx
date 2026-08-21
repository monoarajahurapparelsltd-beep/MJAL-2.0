import React, { useState, useEffect, useMemo } from 'react';
import { 
  ClipboardCheck, 
  Plus, 
  AlertTriangle, 
  Edit, 
  Trash2, 
  AlertCircle, 
  Info, 
  RotateCcw, 
  Send,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Sparkles,
  BarChart3,
  Percent,
  Search,
  Filter
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { QCInspection, InterDeptTransfer } from '../../../types';
import { PageHeader } from '../../common/PageHeader';
import { DataTable, Column } from '../../common/DataTable';
import { StatusBadge } from '../../common/StatusBadge';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { useAuth } from '../../../context/AuthContext';
import { useERP } from '../../../context/ERPContext';
import { PermissionGuard } from '../../common/PermissionGuard';
import { DepartmentTransferQueue } from '../../common/DepartmentTransferQueue';
import { TransferChallanModal } from '../../common/TransferChallanModal';
import { QCInspectionModal } from './QCInspectionModal';
import { useToast } from '../../../context/ToastContext';

export const QCModule: React.FC = () => {
  const { currentUser, canOperate, canDelete } = useAuth();
  const { activeModule } = useERP();
  const { toast } = useToast();
  
  const [inspections, setInspections] = useState<QCInspection[]>(() => supabaseDataService.getQCInspections());
  const [transfers, setTransfers] = useState<InterDeptTransfer[]>(() => supabaseDataService.getTransfers());
  const [activeTab, setActiveTab] = useState<'inspections' | 'transfers'>('inspections');

  useEffect(() => {
    if (activeModule === 'qc' || activeModule === 'qc_inspections') {
      setActiveTab('inspections');
    } else if (activeModule === 'qc_transfers') {
      setActiveTab('transfers');
    }
  }, [activeModule]);

  // Modal States
  const [isQCModalOpen, setIsQCModalOpen] = useState(false);
  const [editInitialData, setEditInitialData] = useState<{
    buyer?: string;
    styleNo?: string;
    poNo?: string;
    colour?: string;
    size?: string;
    inspectionType?: string;
  } | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferModalType, setTransferModalType] = useState<'Transfer' | 'Return'>('Return');
  const [transferDefaultToDept, setTransferDefaultToDept] = useState<'Sewing' | 'Cutting'>('Sewing');
  const [transferTargetItem, setTransferTargetItem] = useState<{ styleNo: string; poNo: string; colour: string; size: string; qty: number } | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [qcToDelete, setQcToDelete] = useState<QCInspection | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync state with DataService
  useEffect(() => {
    const update = () => {
      setInspections([...supabaseDataService.getQCInspections()]);
      setTransfers([...supabaseDataService.getTransfers()]);
    };
    update();
    const unsub = supabaseDataService.subscribe(update);
    return unsub;
  }, []);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalInspected = 0;
    let totalPassed = 0;
    let totalRework = 0;
    let totalReject = 0;

    inspections.forEach(q => {
      totalInspected += q.inspectedQty || 0;
      totalPassed += q.passedQty || 0;
      totalRework += q.reworkQty || 0;
      totalReject += q.rejectQty || 0;
    });

    const totalDefects = totalRework + totalReject;
    const overallDHU = totalInspected > 0 ? Number(((totalDefects / totalInspected) * 100).toFixed(1)) : 0;
    const passRate = totalInspected > 0 ? Number(((totalPassed / totalInspected) * 100).toFixed(1)) : 0;

    return {
      totalInspected,
      totalPassed,
      totalRework,
      totalReject,
      totalDefects,
      overallDHU,
      passRate
    };
  }, [inspections]);

  const handleOpenTransferModal = (type: 'Transfer' | 'Return' = 'Return', toDept: 'Sewing' | 'Cutting' = 'Sewing', item?: QCInspection) => {
    setTransferModalType(type);
    setTransferDefaultToDept(toDept);
    if (item) {
      const returnQty = (item.reworkQty || 0) + (item.rejectQty || 0);
      setTransferTargetItem({
        styleNo: item.styleNo,
        poNo: item.poNo,
        colour: item.colour,
        size: item.size || 'All Sizes',
        qty: returnQty > 0 ? returnQty : item.inspectedQty || 0
      });
    } else {
      setTransferTargetItem(null);
    }
    setIsTransferModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditInitialData(null);
    setIsQCModalOpen(true);
  };

  const handleOpenEdit = (qc: QCInspection) => {
    setEditInitialData({
      buyer: qc.buyer,
      styleNo: qc.styleNo,
      poNo: qc.poNo,
      colour: qc.colour,
      size: qc.size,
      inspectionType: qc.inspectionType
    });
    setIsQCModalOpen(true);
  };

  const handleOpenDelete = (qc: QCInspection) => {
    setQcToDelete(qc);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!qcToDelete) return;
    setIsLoading(true);
    const res = await supabaseDataService.deleteQCInspection(qcToDelete.id, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      toast.error(res.error || 'Failed to delete QC inspection record from database.');
    } else {
      toast.success('QC Inspection record deleted successfully.');
      setIsDeleteModalOpen(false);
      setQcToDelete(null);
    }
  };

  const columns: Column<QCInspection>[] = [
    {
      header: 'Inspection Date',
      accessorKey: 'lastUpdateDate',
      sortable: true,
      cell: q => (
        <div className="space-y-0.5">
          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{q.lastUpdateDate || q.date}</span>
          <div className="text-[10px] text-slate-400 font-medium">{q.shift || 'Day Shift'}</div>
        </div>
      )
    },
    { 
      header: 'Stage / Type', 
      accessorKey: 'inspectionType', 
      cell: q => (
        <div className="space-y-0.5">
          <span className="font-extrabold text-blue-700 dark:text-blue-400 text-xs">{q.inspectionType}</span>
          <div className="text-[10px] text-slate-500 font-medium">{q.lineNo}</div>
        </div>
      )
    },
    { 
      header: 'Style / PO / Colour', 
      cell: q => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-slate-900 dark:text-white text-xs">{q.styleNo}</span>
            {q.buyer && <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1 rounded">{q.buyer}</span>}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>PO: <strong className="text-slate-700 dark:text-slate-300">{q.poNo}</strong></span>
            <span>•</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{q.colour}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Size',
      accessorKey: 'size',
      cell: q => (
        <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black border border-blue-200 dark:border-blue-800 text-xs">
          {q.size || 'All Sizes'}
        </span>
      )
    },
    { 
      header: 'Inspected', 
      cell: q => (
        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
          {(q.inspectedQty || 0).toLocaleString()} pcs
        </span>
      )
    },
    { 
      header: 'Passed (A-Grade)', 
      cell: q => (
        <span className="font-black text-emerald-700 dark:text-emerald-400 text-xs">
          {(q.passedQty || 0).toLocaleString()} pcs
        </span>
      )
    },
    { 
      header: 'Rework / Reject', 
      cell: q => (
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <span className={`${(q.reworkQty || 0) > 0 ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-slate-400'}`}>
            {q.reworkQty || 0} Rew
          </span>
          <span className="text-slate-300">/</span>
          <span className={`${(q.rejectQty || 0) > 0 ? 'text-rose-600 dark:text-rose-400 font-black' : 'text-slate-400'}`}>
            {q.rejectQty || 0} Rej
          </span>
        </div>
      )
    },
    { 
      header: 'DHU %', 
      cell: q => (
        <span className={`px-2 py-0.5 rounded-md font-black text-xs ${
          q.dhu <= 2.5 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300' 
            : q.dhu <= 5.0 
            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300' 
            : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
        }`}>
          {q.dhu}%
        </span>
      )
    },
    { 
      header: 'Defects Breakdown', 
      cell: q => {
        if (!q.defects || q.defects.length === 0) {
          return <span className="text-slate-400 text-[11px]">Nil Defects</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {q.defects.slice(0, 2).map((d, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold truncate max-w-[140px]">
                {d.defectCategory}: {d.defectQty}
              </span>
            ))}
            {q.defects.length > 2 && (
              <span className="text-[10px] px-1 rounded bg-slate-100 text-slate-600 font-bold">
                +{q.defects.length - 2} more
              </span>
            )}
          </div>
        );
      }
    },
    { 
      header: 'Result', 
      accessorKey: 'result', 
      cell: q => <StatusBadge status={q.result} /> 
    },
    {
      header: 'Actions',
      cell: q => (
        <div className="flex items-center gap-1">
          {((q.reworkQty && q.reworkQty > 0) || (q.rejectQty && q.rejectQty > 0)) && (
            <PermissionGuard dept="QC" permission="CREATE">
              <button
                onClick={() => handleOpenTransferModal('Return', 'Sewing', q)}
                title="Issue Defect/Rework Return Challan to Sewing"
                className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/50 text-amber-600 dark:text-amber-400 hover:text-amber-800 transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Return</span>
              </button>
            </PermissionGuard>
          )}
          {canOperate('QC') && (
            <button
              onClick={() => handleOpenEdit(q)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 transition cursor-pointer"
              title="Edit QC Record"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete('QC') && (
            <button
              onClick={() => handleOpenDelete(q)}
              className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
              title="Delete QC Record"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Page Header */}
      <PageHeader
        title="Quality Control & Defect DHU Management"
        description="Inline, End Line, Final QC & AQL Inspection DHU % Analysis with Garment Defect Matrix"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <ExportPrintToolbar title="QC Inspections" data={inspections} filename="MJAL_QC_Inspection_Report" />
            <PermissionGuard dept="QC" permission="CREATE">
              <button
                onClick={() => handleOpenTransferModal('Return', 'Sewing')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-2xs transition cursor-pointer"
              >
                <RotateCcw className="h-4 w-4 text-amber-700" />
                <span>Issue Rework Return Challan</span>
              </button>
            </PermissionGuard>
            <PermissionGuard department="QC">
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                New QC Inspection
              </button>
            </PermissionGuard>
          </div>
        }
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Inspected</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {summary.totalInspected.toLocaleString()} <span className="text-xs font-medium text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] text-slate-500">{inspections.length} audit logs</div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Passed (A Grade)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            {summary.totalPassed.toLocaleString()} <span className="text-xs font-medium text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] text-emerald-600 font-bold">{summary.passRate}% Pass Rate</div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Rework / Alter</span>
            <RotateCcw className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400">
            {summary.totalRework.toLocaleString()} <span className="text-xs font-medium text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] text-slate-500">Sent for Alteration</div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Critical Reject</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400">
            {summary.totalReject.toLocaleString()} <span className="text-xs font-medium text-slate-400">pcs</span>
          </div>
          <div className="text-[10px] text-rose-500 font-medium">Scrap / B-Grade</div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Overall DHU %</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className={`text-xl font-black ${
            summary.overallDHU <= 2.5 ? 'text-emerald-600' : summary.overallDHU <= 5.0 ? 'text-amber-600' : 'text-rose-600'
          }`}>
            {summary.overallDHU}%
          </div>
          <div className="text-[10px] text-slate-500">Defects per 100 units</div>
        </div>

        <div className="bg-white dark:bg-slate-850 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Quality Status</span>
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${
              summary.overallDHU <= 2.5 ? 'bg-emerald-500' : summary.overallDHU <= 5.0 ? 'bg-amber-500' : 'bg-rose-500'
            }`} />
            <span>{summary.overallDHU <= 2.5 ? 'Excellent' : summary.overallDHU <= 5.0 ? 'Normal' : 'Attention'}</span>
          </div>
          <div className="text-[10px] text-slate-500">AQL Standard</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-750 pb-2">
        <button
          onClick={() => setActiveTab('inspections')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'inspections'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>QC Inspection Records ({inspections.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'transfers'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Defect Return & Rework Challan Queue</span>
        </button>
      </div>

      {/* Tab 1: QC Inspections DataTable */}
      {activeTab === 'inspections' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-xs overflow-hidden">
          <DataTable 
            data={inspections} 
            columns={columns} 
            keyExtractor={q => q.id} 
            searchPlaceholder="Search by Style No, PO, Colour, Size, Line No, Inspector, Result..." 
          />
        </div>
      )}

      {/* Tab 2: Defect Return Challan Central Queue */}
      {activeTab === 'transfers' && (
        <DepartmentTransferQueue
          department="All"
          defaultToDept="Sewing"
          title="QC & Production Defect Return Challan Central Queue"
        />
      )}

      {/* Enterprise QC Inspection Modal */}
      {isQCModalOpen && (
        <QCInspectionModal
          isOpen={isQCModalOpen}
          onClose={() => {
            setIsQCModalOpen(false);
            setEditInitialData(null);
          }}
          initialData={editInitialData}
          onSuccess={() => {
            setInspections([...supabaseDataService.getQCInspections()]);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Confirm Deletion"
        message={`Are you sure you want to permanently delete the QC inspection record for Style "${qcToDelete?.styleNo}" (${qcToDelete?.inspectionType})?`}
        confirmLabel={isLoading ? 'Deleting...' : 'Delete Record'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setIsDeleteModalOpen(false); setQcToDelete(null); }}
      />

      {/* Transfer & Defect Return Challan Modal */}
      {isTransferModalOpen && (
        <TransferChallanModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setTransferTargetItem(null);
          }}
          defaultFromDept="QC"
          defaultToDept={transferDefaultToDept}
          initialStyleNo={transferTargetItem?.styleNo || ''}
          initialPoNo={transferTargetItem?.poNo || ''}
          initialColour={transferTargetItem?.colour || ''}
          initialSize={transferTargetItem?.size || 'All Sizes'}
          maxAvailableQty={transferTargetItem?.qty || 0}
          initialTransferType={transferModalType}
          onSuccess={() => {
            setInspections([...supabaseDataService.getQCInspections()]);
            setTransfers([...supabaseDataService.getTransfers()]);
          }}
        />
      )}
    </div>
  );
};
