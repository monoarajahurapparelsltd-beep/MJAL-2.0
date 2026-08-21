import React, { useState, useEffect, useMemo } from 'react';
import { Box, Plus, Edit, Trash2, AlertCircle, Info, Send, Truck, RotateCcw } from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { PackingRecord, InterDeptTransfer } from '../../../types';
import { PageHeader } from '../../common/PageHeader';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { useAuth } from '../../../context/AuthContext';
import { useERP } from '../../../context/ERPContext';
import { PermissionGuard } from '../../common/PermissionGuard';
import { DepartmentTransferQueue } from '../../common/DepartmentTransferQueue';
import { TransferChallanModal } from '../../common/TransferChallanModal';

export const PackingModule: React.FC = () => {
  const { currentUser, canOperate, canDelete } = useAuth();
  const { activeModule } = useERP();
  const [packing, setPacking] = useState<PackingRecord[]>(supabaseDataService.getPackingRecords());
  const [orders, setOrders] = useState(supabaseDataService.getOrders());
  const [transfers, setTransfers] = useState<InterDeptTransfer[]>(supabaseDataService.getTransfersByDepartment('Finishing'));
  const [activeTab, setActiveTab] = useState<'packing' | 'transfers'>('packing');

  useEffect(() => {
    if (activeModule === 'packing_receive' || activeModule === 'packing_shipment') {
      setActiveTab('transfers');
    } else if (activeModule === 'packing') {
      setActiveTab('packing');
    }
  }, [activeModule]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferModalType, setTransferModalType] = useState<'Transfer' | 'Return'>('Transfer');
  const [transferDefaultToDept, setTransferDefaultToDept] = useState<'Finishing' | 'Shipment'>('Shipment');
  const [transferTargetItem, setTransferTargetItem] = useState<{ styleNo: string; poNo: string; colour: string; size: string; qty: number } | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedPacking, setSelectedPacking] = useState<PackingRecord | null>(null);
  const [packingToDelete, setPackingToDelete] = useState<PackingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [styleNo, setStyleNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [colour, setColour] = useState('');
  const [orderQty, setOrderQty] = useState<number | ''>('');
  const [packedQty, setPackedQty] = useState<number | ''>('');
  const [cartonCount, setCartonCount] = useState<number | ''>('');

  useEffect(() => {
    const update = () => {
      setPacking([...supabaseDataService.getPackingRecords()]);
      setOrders([...supabaseDataService.getOrders()]);
      setTransfers([...supabaseDataService.getTransfersByDepartment('Finishing')]);
    };
    update();
    const unsub = supabaseDataService.subscribe(update);
    return unsub;
  }, []);

  const handleOpenTransferModal = (type: 'Transfer' | 'Return', toDept: 'Finishing' | 'Shipment' = 'Shipment', item?: PackingRecord) => {
    setTransferModalType(type);
    setTransferDefaultToDept(toDept);
    if (item) {
      setTransferTargetItem({
        styleNo: item.styleNo,
        poNo: item.poNo,
        colour: item.colour,
        size: 'All Sizes',
        qty: item.packedQty || 0
      });
    } else {
      setTransferTargetItem(null);
    }
    setIsTransferModalOpen(true);
  };

  const matchingProgress = useMemo(() => {
    if (!styleNo || !poNo || !colour) return null;
    return supabaseDataService.getStylePoColourProgress(styleNo.trim(), poNo.trim(), colour.trim());
  }, [styleNo, poNo, colour, packing]);

  const handleSelectOrderCombo = (combinedVal: string) => {
    if (!combinedVal) return;
    const [sNo, pNo, col] = combinedVal.split('||');
    setStyleNo(sNo || '');
    setPoNo(pNo || '');
    setColour(col || '');

    const prog = supabaseDataService.getStylePoColourProgress(sNo, pNo, col);
    if (prog.orderQty > 0) {
      setOrderQty(prog.orderQty);
    }
    if (prog.finBalance > 0 || prog.finQty > 0) {
      const suggestedPacked = prog.finBalance > 0 ? (prog.orderQty - prog.packedQty) : prog.finQty;
      if (suggestedPacked > 0 && (!packedQty || packedQty === '')) {
        setPackedQty(suggestedPacked);
      }
    }
  };

  const resetForm = () => {
    setSelectedPacking(null);
    setStyleNo('');
    setPoNo('');
    setColour('');
    setOrderQty('');
    setPackedQty('');
    setCartonCount('');
    setErrorMessage(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pack: PackingRecord) => {
    setSelectedPacking(pack);
    setStyleNo(pack.styleNo);
    setPoNo(pack.poNo);
    setColour(pack.colour);
    setOrderQty(pack.orderQty);
    setPackedQty(pack.packedQty);
    setCartonCount(pack.cartonCount);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (pack: PackingRecord) => {
    setPackingToDelete(pack);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!packingToDelete) return;
    setIsLoading(true);
    const res = await supabaseDataService.deletePackingRecord(packingToDelete.id, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to delete packing record from database.');
    } else {
      setIsDeleteModalOpen(false);
      setPackingToDelete(null);
    }
  };

  const handleSavePacking = async (e: React.FormEvent) => {
    e.preventDefault();
    const sNo = styleNo.trim();
    const pNo = poNo.trim();
    const col = colour.trim();

    if (!sNo || !pNo || !col || orderQty === '' || packedQty === '' || cartonCount === '') {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const ordNum = Number(orderQty) || 0;
    const pckNum = Number(packedQty) || 0;
    const ctnNum = Number(cartonCount) || 0;

    // Check for existing record
    const existingRec = !selectedPacking
      ? packing.find(p => p.styleNo === sNo && p.poNo === pNo && p.colour === col)
      : null;

    const targetId = selectedPacking ? selectedPacking.id : (existingRec ? existingRec.id : 'pack-' + Date.now());
    const finalPacked = (selectedPacking ? 0 : (existingRec?.packedQty || 0)) + pckNum;
    const finalCartons = (selectedPacking ? 0 : (existingRec?.cartonCount || 0)) + ctnNum;
    const finalOrderQty = ordNum || (existingRec?.orderQty || 0);
    const balanceQty = Math.max(0, finalOrderQty - finalPacked);

    const record: PackingRecord = {
      id: targetId,
      date: selectedPacking ? selectedPacking.date : new Date().toISOString().substring(0, 10),
      styleNo: sNo,
      poNo: pNo,
      colour: col,
      orderQty: finalOrderQty,
      packedQty: finalPacked,
      balanceQty,
      cartonCount: finalCartons,
      cartons: [
        {
          cartonNo: `CTN-${sNo}-001 to CTN-${sNo}-${finalCartons}`,
          colour: col,
          totalPcsPerCarton: finalCartons > 0 ? Math.round(finalPacked / finalCartons) : 0,
          sizeBreakdown: { 'S': 4, 'M': 8, 'L': 8 }
        }
      ],
      packingOfficer: selectedPacking ? selectedPacking.packingOfficer : (currentUser?.name || 'Packing Officer')
    };

    const res = await supabaseDataService.savePackingRecord(record, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save packing record to Supabase.');
    } else {
      setIsModalOpen(false);
      resetForm();
    }
  };

  const columns: Column<PackingRecord>[] = [
    {
      header: 'Last Update Date',
      accessorKey: 'lastUpdateDate',
      sortable: true,
      cell: p => <span className="font-bold text-slate-800">{p.lastUpdateDate || p.date}</span>
    },
    { header: 'Style / PO / Colour', cell: p => <span className="font-bold text-blue-600">{p.styleNo} ({p.poNo} - {p.colour})</span> },
    {
      header: 'Size',
      accessorKey: 'size',
      cell: p => (
        <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200 text-xs">
          {p.size || 'All Sizes'}
        </span>
      )
    },
    { header: 'Order Qty', cell: p => <span>{(p.orderQty || 0).toLocaleString()} pcs</span> },
    { header: 'Packed Qty', cell: p => <span className="font-bold text-emerald-700">{(p.packedQty || 0).toLocaleString()} pcs</span> },
    { header: 'Balance Qty', cell: p => <span className="font-bold text-amber-600">{(p.balanceQty || 0).toLocaleString()} pcs</span> },
    { header: 'Cartons', cell: p => <span className="font-bold text-slate-800">{p.cartonCount} cartons</span> },
    { header: 'Packing Officer', accessorKey: 'packingOfficer' },
    {
      header: 'Actions',
      cell: p => (
        <div className="flex items-center gap-1">
          <PermissionGuard dept="Packing" permission="CREATE">
            <button
              onClick={() => handleOpenTransferModal('Transfer', 'Shipment', p)}
              title="Issue Shipment Gate Pass Challan"
              className="p-1.5 rounded-lg hover:bg-cyan-50 text-cyan-600 hover:text-cyan-800 transition-colors flex items-center gap-1 text-[11px] font-bold"
            >
              <Send className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Gate Pass</span>
            </button>
          </PermissionGuard>
          {canOperate('Finishing') && (
            <button
              onClick={() => handleOpenEdit(p)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
              title="Edit Packing Record"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete('Finishing') && (
            <button
              onClick={() => handleOpenDelete(p)}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
              title="Delete Packing Record"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  const pendingOutgoingTransfers = transfers.filter(t => t.fromDepartment === 'Finishing' && t.status === 'Dispatched').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Packing & Carton Management"
        description="Carton Creation, Carton Numbers, Size Breakdown, Packing List Generation"
        actions={
          <div className="flex items-center gap-2">
            <ExportPrintToolbar title="Packing Records" data={packing} filename="MJAL_Packing_Log" />
            <PermissionGuard dept="Packing" permission="CREATE">
              <button
                onClick={() => handleOpenTransferModal('Return', 'Finishing')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-2xs transition-colors"
              >
                <RotateCcw className="h-4 w-4 text-amber-700" />
                <span>Return to Finishing</span>
              </button>
            </PermissionGuard>
            <PermissionGuard dept="Packing" permission="CREATE">
              <button
                onClick={() => handleOpenTransferModal('Transfer', 'Shipment')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm transition-colors"
              >
                <Send className="h-4 w-4" />
                <span>Issue Shipment Gate Pass</span>
              </button>
            </PermissionGuard>
            <PermissionGuard dept="Packing" permission="CREATE">
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                New Packing Entry
              </button>
            </PermissionGuard>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('packing')}
          className={`pb-2.5 transition-colors flex items-center gap-1.5 ${
            activeTab === 'packing'
              ? 'border-b-2 border-blue-600 text-blue-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Box className="h-4 w-4" />
          <span>Carton Packing Records ({packing.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('transfers')}
          className={`pb-2.5 transition-colors flex items-center gap-1.5 ${
            activeTab === 'transfers'
              ? 'border-b-2 border-cyan-600 text-cyan-700 font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className="h-4 w-4" />
          <span>Inter-Dept Transfers & Delivery Gate Passes ({transfers.length})</span>
          {pendingOutgoingTransfers > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-extrabold animate-pulse">
              {pendingOutgoingTransfers} In Transit
            </span>
          )}
        </button>
      </div>

      {activeTab === 'packing' && (
        <DataTable data={packing} columns={columns} keyExtractor={p => p.id} searchPlaceholder="Search packing records..." />
      )}

      {activeTab === 'transfers' && (
        <DepartmentTransferQueue
          department="Finishing"
          defaultToDept="Shipment"
          title="Packing Section Delivery Gate Passes & Returns Queue"
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title={selectedPacking ? 'Edit Carton Packing Record' : 'Submit Carton Packing Record'}
      >
        <form onSubmit={handleSavePacking} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Select */}
          {!selectedPacking && (
            <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
              <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1">
                <Info className="h-3.5 w-3.5 text-blue-600" />
                Quick Select Active Order
              </span>
              <select
                onChange={e => handleSelectOrderCombo(e.target.value)}
                className="w-full bg-white rounded-lg border border-blue-200 p-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                defaultValue=""
              >
                <option value="" disabled>-- Select Active Order --</option>
                {orders.flatMap(ord =>
                  (ord.purchaseOrders || []).flatMap(po =>
                    (po.colours || []).map(col => (
                      <option key={`${ord.styleNo}-${po.poNo}-${col.colour}`} value={`${ord.styleNo}||${po.poNo}||${col.colour}`}>
                        {ord.styleNo} | PO: {po.poNo} | Colour: {col.colour} (Order: {col.totalQty?.toLocaleString()} pcs - {ord.buyer})
                      </option>
                    ))
                  )
                )}
              </select>
            </div>
          )}

          {/* Progress Banner */}
          {matchingProgress && (
            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 text-blue-900 text-xs flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
              <div>
                <span className="font-bold block">Packing Balance Status</span>
                <p className="text-[11px] mt-0.5">
                  Order Qty: <strong>{(matchingProgress.orderQty || 0).toLocaleString()} pcs</strong> | Finished Available: <strong>{(matchingProgress.finishedQty || 0).toLocaleString()} pcs</strong> | Already Packed: <strong className="text-emerald-700">{(matchingProgress.packedQty || 0).toLocaleString()} pcs</strong> | Remaining to Pack: <strong className="text-rose-600">{(matchingProgress.packBalance || 0).toLocaleString()} pcs</strong>.
                  {!selectedPacking && ' Batches accumulate onto previous progress.'}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Style No *</label>
              <input
                type="text"
                placeholder="Enter Style Number"
                value={styleNo}
                onChange={e => setStyleNo(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold text-blue-600 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PO No *</label>
              <input
                type="text"
                placeholder="Enter PO Number"
                value={poNo}
                onChange={e => setPoNo(e.target.value)}
                className="w-full rounded border p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Colour *</label>
              <input
                type="text"
                placeholder="Select / Enter Colour"
                value={colour}
                onChange={e => setColour(e.target.value)}
                className="w-full rounded border p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Total Order Qty *</label>
              <input
                type="number"
                placeholder={matchingProgress?.orderQty ? `Order: ${matchingProgress.orderQty}` : "Enter Order Quantity"}
                value={orderQty}
                onChange={e => setOrderQty(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded border p-2 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Packed Qty *</label>
              <input
                type="number"
                placeholder={matchingProgress?.packBalance ? `Remaining: ${matchingProgress.packBalance}` : "Enter Packed Quantity"}
                value={packedQty}
                onChange={e => setPackedQty(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded border p-2 text-xs font-bold text-emerald-700 focus:ring-1 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Total Cartons *</label>
              <input
                type="number"
                placeholder="Enter Carton Count"
                value={cartonCount}
                onChange={e => setCartonCount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded border p-2 text-xs font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); resetForm(); }}
              className="px-4 py-2 text-xs rounded border border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : selectedPacking ? 'Update Packing' : 'Save Packing'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Confirm Deletion"
        message={`Are you sure you want to permanently delete the packing record for Style "${packingToDelete?.styleNo}" (${packingToDelete?.cartonCount} cartons)?`}
        confirmLabel={isLoading ? 'Deleting...' : 'Delete Record'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setIsDeleteModalOpen(false); setPackingToDelete(null); }}
      />
      {/* Transfer & Shipment Gate Pass Modal */}
      {isTransferModalOpen && (
        <TransferChallanModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setTransferTargetItem(null);
          }}
          defaultFromDept="Finishing"
          defaultToDept={transferDefaultToDept}
          initialStyleNo={transferTargetItem?.styleNo || ''}
          initialPoNo={transferTargetItem?.poNo || ''}
          initialColour={transferTargetItem?.colour || ''}
          initialSize={transferTargetItem?.size || 'All Sizes'}
          maxAvailableQty={transferTargetItem?.qty || 0}
          initialTransferType={transferModalType}
          onSuccess={() => {
            setPacking([...supabaseDataService.getPackingRecords()]);
            setTransfers([...supabaseDataService.getTransfersByDepartment('Finishing')]);
          }}
        />
      )}
    </div>
  );
};
