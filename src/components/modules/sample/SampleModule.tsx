import React, { useState, useEffect } from 'react';
import { FlaskConical, Plus, Edit, Trash2, AlertCircle } from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { SampleRecord, SampleType, SampleStatus } from '../../../types';
import { PageHeader } from '../../common/PageHeader';
import { DataTable, Column } from '../../common/DataTable';
import { StatusBadge } from '../../common/StatusBadge';
import { Modal } from '../../common/Modal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { useAuth } from '../../../context/AuthContext';
import { PermissionGuard } from '../../common/PermissionGuard';

export const SampleModule: React.FC = () => {
  const { currentUser, canOperate, canDelete } = useAuth();
  const [samples, setSamples] = useState<SampleRecord[]>(supabaseDataService.getSamples());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<SampleRecord | null>(null);
  const [sampleToDelete, setSampleToDelete] = useState<SampleRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [styleNo, setStyleNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [colour, setColour] = useState('');
  const [sampleType, setSampleType] = useState<SampleType>('PP Sample');
  const [targetDate, setTargetDate] = useState('2026-08-15');
  const [buyerComments, setBuyerComments] = useState('');
  const [status, setStatus] = useState<SampleStatus>('Submitted');

  useEffect(() => {
    setSamples(supabaseDataService.getSamples());
    const unsub = supabaseDataService.subscribe(() => {
      setSamples([...supabaseDataService.getSamples()]);
    });
    return unsub;
  }, []);

  const resetForm = () => {
    setSelectedSample(null);
    setStyleNo('');
    setPoNo('');
    setColour('');
    setSampleType('PP Sample');
    setTargetDate(new Date().toISOString().substring(0, 10));
    setBuyerComments('');
    setStatus('Submitted');
    setErrorMessage(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: SampleRecord) => {
    setSelectedSample(s);
    setStyleNo(s.styleNo);
    setPoNo(s.poNo);
    setColour(s.colour);
    setSampleType(s.sampleType);
    setTargetDate(s.targetDate || '');
    setBuyerComments(s.buyerComments || '');
    setStatus(s.status);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenDelete = (s: SampleRecord) => {
    setSampleToDelete(s);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!sampleToDelete) return;
    setIsLoading(true);
    const res = await supabaseDataService.deleteSample(sampleToDelete.id, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to delete sample record from database.');
    } else {
      setIsDeleteModalOpen(false);
      setSampleToDelete(null);
    }
  };

  const handleSaveSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleNo || !poNo || !colour) {
      setErrorMessage('Please fill in Style, PO, and Colour.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const record: SampleRecord = {
      id: selectedSample ? selectedSample.id : 'smp-' + Date.now(),
      styleNo,
      poNo,
      colour,
      sampleType,
      submissionDate: selectedSample ? selectedSample.submissionDate : new Date().toISOString().substring(0, 10),
      targetDate,
      buyerComments,
      status,
      preparedBy: selectedSample ? selectedSample.preparedBy : (currentUser?.name || 'Sample Master')
    };

    const res = await supabaseDataService.saveSample(record, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to save sample record to Supabase.');
    } else {
      setIsModalOpen(false);
      resetForm();
    }
  };

  const columns: Column<SampleRecord>[] = [
    { header: 'Style / PO', cell: s => <div><span className="font-bold text-blue-600">{s.styleNo}</span> <span className="text-slate-500">({s.poNo})</span></div> },
    { header: 'Colour', accessorKey: 'colour' },
    { header: 'Sample Type', accessorKey: 'sampleType', sortable: true, cell: s => <span className="font-bold text-slate-800">{s.sampleType}</span> },
    { header: 'Target Date', accessorKey: 'targetDate' },
    { header: 'Submission Date', accessorKey: 'submissionDate' },
    { header: 'Buyer Comments', accessorKey: 'buyerComments', cell: s => <span className="text-slate-600 truncate max-w-xs block">{s.buyerComments || '-'}</span> },
    { header: 'Status', accessorKey: 'status', cell: s => <StatusBadge status={s.status} /> },
    {
      header: 'Actions',
      cell: s => (
        <div className="flex items-center gap-1">
          {canOperate('Sample') && (
            <button
              onClick={() => handleOpenEdit(s)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-blue-600 transition-colors"
              title="Edit Sample Record"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete('Sample') && (
            <button
              onClick={() => handleOpenDelete(s)}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
              title="Delete Sample Record"
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
        title="Sample Management Module"
        description="Follow-up Development, Proto, Fit, Size Set, PP, Photo & Shipment Samples"
        actions={
          <div className="flex items-center gap-2">
            <ExportPrintToolbar title="Sample Follow-up" data={samples} filename="MJAL_Samples" />
            <PermissionGuard department="Sample">
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                New Sample Submission
              </button>
            </PermissionGuard>
          </div>
        }
      />

      <DataTable data={samples} columns={columns} keyExtractor={s => s.id} searchPlaceholder="Search sample records..." />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title={selectedSample ? 'Edit Sample Record' : 'New Sample Submission Record'}
      >
        <form onSubmit={handleSaveSample} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
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
                className="w-full rounded border p-2 text-xs font-bold"
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
                className="w-full rounded border p-2 text-xs font-bold"
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
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sample Type *</label>
              <select value={sampleType} onChange={e => setSampleType(e.target.value as any)} className="w-full rounded border p-2 text-xs font-bold">
                <option value="Development Sample">Development Sample</option>
                <option value="Proto Sample">Proto Sample</option>
                <option value="Fit Sample">Fit Sample</option>
                <option value="Size Set">Size Set</option>
                <option value="PP Sample">PP Sample</option>
                <option value="Photo Sample">Photo Sample</option>
                <option value="Shipment Sample">Shipment Sample</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full rounded border p-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Sample Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full rounded border p-2 text-xs font-bold">
              <option value="Submitted">Submitted</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Revise & Resubmit">Revise & Resubmit</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Buyer Comments / Feedback</label>
            <textarea
              placeholder="Enter Buyer comments, measurements, alterations..."
              value={buyerComments}
              onChange={e => setBuyerComments(e.target.value)}
              className="w-full rounded border p-2 text-xs h-20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 p-4 shrink-0 z-10">
            <button
              type="button"
              onClick={() => { setIsModalOpen(false); resetForm(); }}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
            >
              {isLoading ? 'Saving...' : selectedSample ? 'Update Sample' : 'Save Sample'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Confirm Deletion"
        message={`Are you sure you want to permanently delete the sample record for Style "${sampleToDelete?.styleNo}" (${sampleToDelete?.sampleType})?`}
        confirmLabel={isLoading ? 'Deleting...' : 'Delete Record'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => { setIsDeleteModalOpen(false); setSampleToDelete(null); }}
      />
    </div>
  );
};
