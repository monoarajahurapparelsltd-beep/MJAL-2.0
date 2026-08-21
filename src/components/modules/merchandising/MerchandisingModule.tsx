import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Plus, Calendar, FileText, Edit, Trash2, AlertCircle } from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { BOMItem, TACalendarTask, OrderStyle } from '../../../types';
import { PageHeader } from '../../common/PageHeader';
import { DataTable, Column } from '../../common/DataTable';
import { StatusBadge } from '../../common/StatusBadge';
import { Modal } from '../../common/Modal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { useAuth } from '../../../context/AuthContext';
import { PermissionGuard } from '../../common/PermissionGuard';
import { isGlobalUser, filterOrdersForUser } from '../../../utils/authUtils';

export const MerchandisingModule: React.FC = () => {
  const { currentUser, canOperate, canDelete } = useAuth();
  const [orders, setOrders] = useState<OrderStyle[]>(supabaseDataService.getOrders());
  const [bom, setBom] = useState<BOMItem[]>(supabaseDataService.getBOM());
  const [taCalendar, setTaCalendar] = useState<TACalendarTask[]>(supabaseDataService.getTACalendar());
  const [activeTab, setActiveTab] = useState<'bom' | 'ta'>('bom');

  const [isBOMModalOpen, setIsBOMModalOpen] = useState(false);
  const [isTAModalOpen, setIsTAModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'bom' | 'ta'; id: string; title: string } | null>(null);

  const [selectedBOM, setSelectedBOM] = useState<BOMItem | null>(null);
  const [selectedTA, setSelectedTA] = useState<TACalendarTask | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State for BOM
  const [styleNo, setStyleNo] = useState('');
  const [category, setCategory] = useState<'Fabric' | 'Trim' | 'Accessories' | 'Packaging'>('Fabric');
  const [itemName, setItemName] = useState('');
  const [specification, setSpecification] = useState('');
  const [consumptionPerDzn, setConsumptionPerDzn] = useState<number | ''>('');
  const [unit, setUnit] = useState<'Yards' | 'Meters' | 'Kgs' | 'Pcs' | 'Gross' | 'Rolls'>('Yards');
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [supplier, setSupplier] = useState('');
  const [bomStatus, setBomStatus] = useState<any>('Full Received');

  // Form State for T&A
  const [taStyleNo, setTaStyleNo] = useState('');
  const [taPoNo, setTaPoNo] = useState('');
  const [taskName, setTaskName] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [actualDate, setActualDate] = useState('');
  const [responsibleDept, setResponsibleDept] = useState('Merchandising');
  const [taStatus, setTaStatus] = useState<any>('Planned');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    setOrders(supabaseDataService.getOrders());
    setBom(supabaseDataService.getBOM());
    setTaCalendar(supabaseDataService.getTACalendar());
    const unsub = supabaseDataService.subscribe(() => {
      setOrders([...supabaseDataService.getOrders()]);
      setBom([...supabaseDataService.getBOM()]);
      setTaCalendar([...supabaseDataService.getTACalendar()]);
    });
    return unsub;
  }, []);

  const visibleOrders = useMemo(() => filterOrdersForUser(orders, currentUser), [orders, currentUser]);
  const visibleStyleNos = useMemo(() => new Set(visibleOrders.map(o => o.styleNo.trim().toUpperCase())), [visibleOrders]);

  const visibleBOM = useMemo(() => {
    if (isGlobalUser(currentUser)) return bom;
    const uEmail = (currentUser?.email || '').toLowerCase().trim();
    return bom.filter(b => {
      if (b.creatorEmail && uEmail && b.creatorEmail.toLowerCase() === uEmail) return true;
      if (b.styleNo && visibleStyleNos.has(b.styleNo.trim().toUpperCase())) return true;
      return false;
    });
  }, [bom, currentUser, visibleStyleNos]);

  const visibleTA = useMemo(() => {
    if (isGlobalUser(currentUser)) return taCalendar;
    const uEmail = (currentUser?.email || '').toLowerCase().trim();
    return taCalendar.filter(t => {
      if (t.creatorEmail && uEmail && t.creatorEmail.toLowerCase() === uEmail) return true;
      if (t.styleNo && visibleStyleNos.has(t.styleNo.trim().toUpperCase())) return true;
      return false;
    });
  }, [taCalendar, currentUser, visibleStyleNos]);

  const resetBOMForm = () => {
    setSelectedBOM(null);
    setStyleNo('');
    setCategory('Fabric');
    setItemName('');
    setSpecification('');
    setConsumptionPerDzn('');
    setUnit('Yards');
    setUnitPrice('');
    setSupplier('');
    setBomStatus('Full Received');
    setErrorMessage(null);
  };

  const resetTAForm = () => {
    setSelectedTA(null);
    setTaStyleNo('');
    setTaPoNo('');
    setTaskName('');
    setPlannedDate('');
    setActualDate('');
    setResponsibleDept('Merchandising');
    setTaStatus('Planned');
    setRemarks('');
    setErrorMessage(null);
  };

  const handleOpenAddBOM = () => {
    resetBOMForm();
    setIsBOMModalOpen(true);
  };

  const handleOpenEditBOM = (item: BOMItem) => {
    setSelectedBOM(item);
    setStyleNo(item.styleNo);
    setCategory(item.category);
    setItemName(item.itemName);
    setSpecification(item.specification || '');
    setConsumptionPerDzn(item.consumptionPerDzn);
    setUnit(item.unit);
    setUnitPrice(item.unitPrice);
    setSupplier(item.supplier || '');
    setBomStatus(item.status);
    setErrorMessage(null);
    setIsBOMModalOpen(true);
  };

  const handleOpenAddTA = () => {
    resetTAForm();
    setIsTAModalOpen(true);
  };

  const handleOpenEditTA = (t: TACalendarTask) => {
    setSelectedTA(t);
    setTaStyleNo(t.styleNo);
    setTaPoNo(t.poNo);
    setTaskName(t.taskName);
    setPlannedDate(t.plannedDate);
    setActualDate(t.actualDate || '');
    setResponsibleDept(t.responsibleDept);
    setTaStatus(t.status);
    setRemarks(t.remarks || '');
    setErrorMessage(null);
    setIsTAModalOpen(true);
  };

  const handleOpenDelete = (type: 'bom' | 'ta', id: string, title: string) => {
    setItemToDelete({ type, id, title });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsLoading(true);
    let res;
    if (itemToDelete.type === 'bom') {
      res = await supabaseDataService.deleteBOMItem(itemToDelete.id, currentUser?.name);
    } else {
      res = await supabaseDataService.deleteTATask(itemToDelete.id, currentUser?.name);
    }
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to delete record from database.');
    } else {
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const handleSaveBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleNo || !itemName) {
      setErrorMessage('Please fill in Style Number and Item Name.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const newItem: BOMItem = {
      id: selectedBOM ? selectedBOM.id : 'bom-' + Date.now(),
      styleNo,
      category,
      itemName,
      specification,
      consumptionPerDzn: Number(consumptionPerDzn) || 0,
      unit,
      unitPrice: Number(unitPrice) || 0,
      supplier,
      requiredQty: selectedBOM ? selectedBOM.requiredQty : 5000,
      bookedQty: selectedBOM ? selectedBOM.bookedQty : 5000,
      receivedQty: selectedBOM ? selectedBOM.receivedQty : 5000,
      status: bomStatus,
      createdBy: selectedBOM?.createdBy || currentUser?.name || currentUser?.email,
      creatorEmail: selectedBOM?.creatorEmail || (currentUser?.email || '').toLowerCase().trim() || undefined
    };

    const res = await supabaseDataService.saveBOMItem(newItem, currentUser?.name || currentUser?.email);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save BOM item to Supabase.');
    } else {
      setIsBOMModalOpen(false);
      resetBOMForm();
    }
  };

  const handleSaveTA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taStyleNo || !taPoNo || !taskName || !plannedDate) {
      setErrorMessage('Please fill in Style, PO, Task Name, and Planned Date.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const task: TACalendarTask = {
      id: selectedTA ? selectedTA.id : 'ta-' + Date.now(),
      styleNo: taStyleNo,
      poNo: taPoNo,
      taskName,
      plannedDate,
      actualDate: actualDate || undefined,
      responsibleDept,
      status: taStatus,
      remarks: remarks || undefined,
      createdBy: selectedTA?.createdBy || currentUser?.name || currentUser?.email,
      creatorEmail: selectedTA?.creatorEmail || (currentUser?.email || '').toLowerCase().trim() || undefined
    };

    const res = await supabaseDataService.saveTATask(task, currentUser?.name || currentUser?.email);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save T&A task to Supabase.');
    } else {
      setIsTAModalOpen(false);
      resetTAForm();
    }
  };

  const bomColumns: Column<BOMItem>[] = [
    { header: 'Style No', accessorKey: 'styleNo', sortable: true, cell: b => <span className="font-bold text-blue-600">{b.styleNo}</span> },
    { header: 'Category', accessorKey: 'category', sortable: true },
    {
      header: 'Item & Specification',
      cell: b => (
        <div>
          <span className="font-bold text-slate-800">{b.itemName}</span>
          <p className="text-[11px] text-slate-500">{b.specification}</p>
        </div>
      )
    },
    { header: 'Consumption / Dzn', accessorKey: 'consumptionPerDzn', cell: b => <span>{b.consumptionPerDzn} {b.unit}</span> },
    { header: 'Unit Price', accessorKey: 'unitPrice', cell: b => <span>${b.unitPrice.toFixed(2)}</span> },
    { header: 'Supplier', accessorKey: 'supplier' },
    { header: 'Status', accessorKey: 'status', cell: b => <StatusBadge status={b.status} /> },
    {
      header: 'Actions',
      cell: b => (
        <div className="flex items-center gap-1">
          {canOperate() && (
            <button
              onClick={() => handleOpenEditBOM(b)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
              title="Edit BOM"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete('Merchandising') && (
            <button
              onClick={() => handleOpenDelete('bom', b.id, b.itemName)}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
              title="Delete BOM"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  const taColumns: Column<TACalendarTask>[] = [
    { header: 'Style / PO', cell: t => <div><span className="font-bold text-blue-600">{t.styleNo}</span> <span className="text-slate-500">({t.poNo})</span></div> },
    { header: 'Task Name', accessorKey: 'taskName', sortable: true, cell: t => <span className="font-bold text-slate-800">{t.taskName}</span> },
    { header: 'Responsible Dept', accessorKey: 'responsibleDept' },
    { header: 'Planned Date', accessorKey: 'plannedDate', sortable: true },
    { header: 'Actual Date', accessorKey: 'actualDate', cell: t => <span>{t.actualDate || 'Pending'}</span> },
    { header: 'Status', accessorKey: 'status', cell: t => <StatusBadge status={t.status} /> },
    {
      header: 'Actions',
      cell: t => (
        <div className="flex items-center gap-1">
          {canOperate() && (
            <button
              onClick={() => handleOpenEditTA(t)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
              title="Edit Task"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete('Merchandising') && (
            <button
              onClick={() => handleOpenDelete('ta', t.id, t.taskName)}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
              title="Delete Task"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Merchandising & T&A Module"
        description={
          isGlobalUser(currentUser)
            ? "Bill of Materials (BOM), Material Costing & Critical Path T&A Calendar Follow-up (Universal Visibility)"
            : `User Merchandising Desk: Showing BOM and T&A entries for orders created by ${currentUser?.email || currentUser?.name || 'you'}`
        }
        actions={
          <div className="flex items-center gap-2">
            <ExportPrintToolbar title={activeTab === 'bom' ? 'BOM List' : 'T&A Tasks'} data={activeTab === 'bom' ? visibleBOM : visibleTA} filename={activeTab === 'bom' ? 'MJAL_BOM' : 'MJAL_TA_Calendar'} />
            <PermissionGuard dept="Merchandising" permission="CREATE">
              <button
                onClick={activeTab === 'bom' ? handleOpenAddBOM : handleOpenAddTA}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                {activeTab === 'bom' ? 'Add BOM Item' : 'New T&A Task'}
              </button>
            </PermissionGuard>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('bom')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'bom' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Bill of Materials (BOM) ({visibleBOM.length})
        </button>
        <button
          onClick={() => setActiveTab('ta')}
          className={`pb-2.5 transition-colors border-b-2 ${activeTab === 'ta' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          T&A Critical Path Calendar ({visibleTA.length})
        </button>
      </div>

      {activeTab === 'bom' ? (
        <DataTable data={visibleBOM} columns={bomColumns} keyExtractor={b => b.id} searchPlaceholder="Search BOM items..." />
      ) : (
        <DataTable data={visibleTA} columns={taColumns} keyExtractor={t => t.id} searchPlaceholder="Search T&A tasks..." />
      )}

      {/* BOM Modal */}
      <Modal
        isOpen={isBOMModalOpen}
        onClose={() => { setIsBOMModalOpen(false); resetBOMForm(); }}
        title={selectedBOM ? 'Edit BOM Item' : 'Add New BOM Item'}
      >
        <form onSubmit={handleSaveBOM} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Style No *</label>
              <input
                type="text"
                placeholder="Enter Style Number"
                value={styleNo}
                onChange={e => setStyleNo(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
              <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full rounded border p-2 text-xs font-bold">
                <option value="Fabric">Fabric</option>
                <option value="Trim">Trim</option>
                <option value="Accessories">Accessories</option>
                <option value="Packaging">Packaging</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Item Name *</label>
            <input
              type="text"
              placeholder="Enter Item Name (e.g. YKK Brass Zipper 5#)"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              className="w-full rounded border p-2 text-xs font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Specification</label>
            <input
              type="text"
              placeholder="Enter Specification / Details"
              value={specification}
              onChange={e => setSpecification(e.target.value)}
              className="w-full rounded border p-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Consumption / Dzn</label>
              <input
                type="number"
                step="0.01"
                placeholder="Enter Consumption"
                value={consumptionPerDzn}
                onChange={e => setConsumptionPerDzn(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value as any)} className="w-full rounded border p-2 text-xs">
                <option value="Yards">Yards</option>
                <option value="Meters">Meters</option>
                <option value="Kgs">Kgs</option>
                <option value="Pcs">Pcs</option>
                <option value="Gross">Gross</option>
                <option value="Rolls">Rolls</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit Price ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Enter Price in USD"
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Name</label>
            <input
              type="text"
              placeholder="Enter Supplier Name"
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
              className="w-full rounded border p-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 p-4 shrink-0 z-10">
            <button
              type="button"
              onClick={() => { setIsBOMModalOpen(false); resetBOMForm(); }}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
            >
              {isLoading ? 'Saving...' : selectedBOM ? 'Update BOM' : 'Save BOM'}
            </button>
          </div>
        </form>
      </Modal>

      {/* T&A Modal */}
      <Modal
        isOpen={isTAModalOpen}
        onClose={() => { setIsTAModalOpen(false); resetTAForm(); }}
        title={selectedTA ? 'Edit T&A Task' : 'Add New T&A Task'}
      >
        <form onSubmit={handleSaveTA} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Style No *</label>
              <input
                type="text"
                placeholder="Enter Style Number"
                value={taStyleNo}
                onChange={e => setTaStyleNo(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PO No *</label>
              <input
                type="text"
                placeholder="Enter PO Number"
                value={taPoNo}
                onChange={e => setTaPoNo(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Task Name *</label>
            <input
              type="text"
              placeholder="Enter Task Name (e.g. PP Sample Submission)"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              className="w-full rounded border p-2 text-xs font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Planned Date *</label>
              <input
                type="date"
                value={plannedDate}
                onChange={e => setPlannedDate(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Actual Date</label>
              <input
                type="date"
                value={actualDate}
                onChange={e => setActualDate(e.target.value)}
                className="w-full rounded border p-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Responsible Dept</label>
              <select value={responsibleDept} onChange={e => setResponsibleDept(e.target.value)} className="w-full rounded border p-2 text-xs">
                <option value="Merchandising">Merchandising</option>
                <option value="Sample">Sample</option>
                <option value="Cutting">Cutting</option>
                <option value="Sewing">Sewing</option>
                <option value="Washing">Washing</option>
                <option value="Finishing">Finishing</option>
                <option value="QC">QC</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Task Status</label>
              <select value={taStatus} onChange={e => setTaStatus(e.target.value as any)} className="w-full rounded border p-2 text-xs font-bold">
                <option value="Planned">Planned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Delayed">Delayed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Remarks</label>
            <input
              type="text"
              placeholder="Enter remarks or notes"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full rounded border p-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 p-4 shrink-0 z-10">
            <button
              type="button"
              onClick={() => { setIsTAModalOpen(false); resetTAForm(); }}
              className="px-4 py-2 text-xs rounded border border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : selectedTA ? 'Update Task' : 'Save Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Confirm Deletion"
        message={`Are you sure you want to permanently delete "${itemToDelete?.title}"?`}
        confirmLabel={isLoading ? 'Deleting...' : 'Delete'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }}
      />
    </div>
  );
};
