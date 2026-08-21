import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  ArrowRight,
  CheckCircle2,
  Clock,
  Printer,
  Plus,
  Search,
  Filter,
  FileText,
  AlertCircle,
  Inbox,
  Send,
  Sparkles,
  Waves,
  Scissors,
  Shirt,
  Package,
  Trash2,
  RotateCcw,
  ShieldCheck,
  Building,
  Undo2
} from 'lucide-react';
import { InterDeptTransfer } from '../../types';
import { supabaseDataService } from '../../services/supabaseDataService';
import { useAuth } from '../../context/AuthContext';
import { TransferChallanModal, DepartmentType } from './TransferChallanModal';
import { printTransferChallanPDF } from '../../utils/printUtils';
import { getDepartmentIncharge } from '../../utils/authorityUtils';
import { isGlobalUser } from '../../utils/authUtils';

interface Props {
  department?: DepartmentType | 'All';
  title?: string;
  defaultToDept?: DepartmentType;
  initialStyleNo?: string;
  maxAvailableQty?: number;
}

export const DepartmentTransferQueue: React.FC<Props> = ({
  department = 'All',
  title,
  defaultToDept,
  initialStyleNo,
  maxAvailableQty
}) => {
  const { currentUser } = useAuth();
  const isGlobal = isGlobalUser(currentUser);
  const userDept = currentUser?.department as DepartmentType | undefined;
  const effectiveDept: DepartmentType | 'All' = department && department !== 'All' 
    ? (department as DepartmentType)
    : (isGlobal ? 'All' : (userDept || 'Finishing'));

  const [transfers, setTransfers] = useState<InterDeptTransfer[]>(() => {
    return effectiveDept === 'All'
      ? supabaseDataService.getTransfers()
      : supabaseDataService.getTransfersByDepartment(effectiveDept);
  });

  const refreshData = useCallback(() => {
    if (effectiveDept === 'All') {
      setTransfers([...supabaseDataService.getTransfers()]);
    } else {
      setTransfers([...supabaseDataService.getTransfersByDepartment(effectiveDept)]);
    }
  }, [effectiveDept]);

  useEffect(() => {
    refreshData();
    const unsubscribe = supabaseDataService.subscribe(refreshData);
    return () => unsubscribe();
  }, [refreshData]);

  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound' | 'returns' | 'all'>('inbound');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Dispatched' | 'Received'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTransferType, setModalTransferType] = useState<'Transfer' | 'Return'>('Transfer');
  const [modalFromDept, setModalFromDept] = useState<DepartmentType>(effectiveDept === 'All' ? 'Cutting' : effectiveDept);
  const [modalToDept, setModalToDept] = useState<DepartmentType>(defaultToDept || (effectiveDept === 'Cutting' ? 'Sewing' : effectiveDept === 'Sewing' ? 'Finishing' : 'Packing'));
  const [modalStyleNo, setModalStyleNo] = useState<string>(initialStyleNo || '');
  const [modalPoNo, setModalPoNo] = useState<string>('');
  const [modalColour, setModalColour] = useState<string>('');
  const [modalSize, setModalSize] = useState<string>('All Sizes');
  const [modalQty, setModalQty] = useState<number>(maxAvailableQty || 0);
  const [modalOriginalChallan, setModalOriginalChallan] = useState<string>('');

  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiverNameInput, setReceiverNameInput] = useState('');
  const [receivingQtyInput, setReceivingQtyInput] = useState<number>(0);

  const handleReceive = async (transferId: string) => {
    const targetTransfer = transfers.find(t => t.id === transferId);
    const defaultReceiver = targetTransfer ? getDepartmentIncharge(targetTransfer.toDepartment).name : 'Section Receiver';
    const receiver = receiverNameInput.trim() || currentUser?.name || defaultReceiver;
    const qtyToReceive = receivingQtyInput > 0 ? receivingQtyInput : (targetTransfer?.quantity || 0);
    const res = await supabaseDataService.receiveTransfer(transferId, receiver, currentUser?.name, qtyToReceive);
    if (res.success) {
      setReceivingId(null);
      setReceiverNameInput('');
      setReceivingQtyInput(0);
      refreshData();
    } else {
      alert(res.error || 'Failed to acknowledge receipt');
    }
  };

  const handleDeleteTransfer = async (transferId: string, challanNo: string) => {
    if (window.confirm(`Are you sure you want to delete transfer challan ${challanNo}?`)) {
      const res = await supabaseDataService.deleteTransfer(transferId, currentUser?.name);
      if (res.success) {
        refreshData();
      } else {
        alert(res.error || 'Failed to delete transfer record');
      }
    }
  };

  const handleClearAllTransfers = async () => {
    if (window.confirm('Are you sure you want to delete all transfer records from the queue?')) {
      const res = await supabaseDataService.clearAllTransfers(currentUser?.name);
      if (res.success) {
        refreshData();
      } else {
        alert(res.error || 'Failed to clear transfer records');
      }
    }
  };

  const handleOpenTransferModal = (type: 'Transfer' | 'Return') => {
    setModalTransferType(type);
    setModalFromDept(effectiveDept === 'All' ? 'Cutting' : effectiveDept);
    if (type === 'Return') {
      // In return mode, suggest returning to predecessor
      const returnTarget: DepartmentType =
        effectiveDept === 'Sewing' ? 'Cutting' :
        effectiveDept === 'Washing' ? 'Sewing' :
        effectiveDept === 'Finishing' ? 'Washing' :
        effectiveDept === 'Shipment' ? 'Finishing' :
        'Cutting';
      setModalToDept(returnTarget);
    } else {
      setModalToDept(defaultToDept || (
        effectiveDept === 'Cutting' ? 'Sewing' :
        effectiveDept === 'Sewing' ? 'Washing' :
        effectiveDept === 'Washing' ? 'Finishing' :
        effectiveDept === 'Finishing' ? 'Shipment' :
        effectiveDept === 'Packing' ? 'Shipment' :
        'Sewing'
      ));
    }
    setModalStyleNo(initialStyleNo || '');
    setModalPoNo('');
    setModalColour('');
    setModalSize('All Sizes');
    setModalQty(maxAvailableQty || 0);
    setModalOriginalChallan('');
    setIsModalOpen(true);
  };

  const handleQuickReturn = (item: InterDeptTransfer) => {
    setModalTransferType('Return');
    // Return to the sender department
    setModalFromDept(item.toDepartment);
    setModalToDept(item.fromDepartment);
    setModalStyleNo(item.styleNo);
    setModalPoNo(item.poNo);
    setModalColour(item.colour);
    setModalSize(item.size || 'All Sizes');
    setModalQty(item.quantity);
    setModalOriginalChallan(item.challanNo);
    setIsModalOpen(true);
  };

  const isMatchDept = (deptToCheck?: string, target?: string) => {
    if (!target || target === 'All') return true;
    if (!deptToCheck) return false;
    return deptToCheck.trim().toLowerCase() === target.trim().toLowerCase();
  };

  // Filter transfers
  const inboundList = transfers.filter(t => isMatchDept(t.toDepartment, effectiveDept));
  const outboundList = transfers.filter(t => isMatchDept(t.fromDepartment, effectiveDept));
  const returnsList = transfers.filter(t => t.transferType === 'Return' && (isMatchDept(t.fromDepartment, effectiveDept) || isMatchDept(t.toDepartment, effectiveDept)));

  const currentDisplayList = (
    activeTab === 'inbound' ? inboundList :
    activeTab === 'outbound' ? outboundList :
    activeTab === 'returns' ? returnsList :
    transfers
  ).filter(t => {
    const term = (searchTerm || '').toLowerCase();
    const matchSearch = !term || (
      (t.challanNo || '').toLowerCase().includes(term) ||
      (t.styleNo || '').toLowerCase().includes(term) ||
      (t.poNo || '').toLowerCase().includes(term) ||
      (t.colour || '').toLowerCase().includes(term) ||
      (t.fromDepartment || '').toLowerCase().includes(term) ||
      (t.toDepartment || '').toLowerCase().includes(term) ||
      (t.authorizedBy && t.authorizedBy.toLowerCase().includes(term)) ||
      (t.returnReason && t.returnReason.toLowerCase().includes(term))
    );
    const matchStatus = selectedStatus === 'All' || t.status === selectedStatus;
    return matchSearch && matchStatus;
  });

  const pendingInboundCount = inboundList.filter(t => t.status === 'Dispatched').length;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden space-y-4 p-4">
      {/* Header with Title & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              <span>{title || `${department} Section Transfer & Handover Queue`}</span>
              {pendingInboundCount > 0 && activeTab === 'inbound' && (
                <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full border border-amber-400 animate-pulse">
                  {pendingInboundCount} Pending Inbound
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Strict Department Transfer Control with real-time Output Qty validation & Authorized Signatory flow.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {transfers.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllTransfers}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-rose-200 dark:border-rose-800 transition-colors"
              title="Delete all previous transfer records"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Data</span>
            </button>
          )}

          {/* New Return Challan Button */}
          <button
            type="button"
            onClick={() => handleOpenTransferModal('Return')}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-lg flex items-center gap-1.5 border border-rose-300 dark:border-rose-700 transition-colors shadow-2xs"
            title="Create Product Return Challan to previous department"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>Product Return Challan</span>
          </button>

          {/* New Transfer Challan Button */}
          <button
            type="button"
            onClick={() => handleOpenTransferModal('Transfer')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Transfer Challan</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('inbound')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'inbound'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Inbound Incoming ({inboundList.length})</span>
            {pendingInboundCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('outbound')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'outbound'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Outbound Dispatched ({outboundList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('returns')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'returns'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            <span>Product Returns ({returnsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>All ({transfers.length})</span>
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search Challan / Style / PO / Auth..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 w-48 sm:w-64 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-medium"
          >
            <option value="All">All Status</option>
            <option value="Dispatched">Dispatched (In Transit)</option>
            <option value="Received">Received (Acknowledged)</option>
          </select>
        </div>
      </div>

      {/* Transfers Data Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/80 rounded-xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="p-3">Type & Challan / Date</th>
              <th className="p-3">Route (From ➔ To)</th>
              <th className="p-3">Style / PO / Colour</th>
              <th className="p-3">Category & Status</th>
              <th className="p-3 text-right">Quantity</th>
              <th className="p-3">Authorized Signatory</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-normal">
            {currentDisplayList.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-2">
                    <Truck className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="font-medium text-slate-600 dark:text-slate-400">No transfer records found in this queue.</p>
                    <p className="text-[11px] text-slate-400">Click "New Transfer Challan" or "Product Return Challan" to initiate an inter-departmental transfer.</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentDisplayList.map(item => {
                const isReturn = item.transferType === 'Return';
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Type & Challan & Date */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        {isReturn ? (
                          <span className="px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-black rounded flex items-center gap-1">
                            <RotateCcw className="w-3 h-3" />
                            <span>RETURN</span>
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-black rounded flex items-center gap-1">
                            <Truck className="w-3 h-3" />
                            <span>TRANSFER</span>
                          </span>
                        )}
                        <span className={`font-mono font-bold ${isReturn ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {item.challanNo}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {item.transferDate}
                      </span>
                      {isReturn && item.returnReason && (
                        <span className="block text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5 truncate max-w-[180px]" title={item.returnReason}>
                          Reason: {item.returnReason}
                        </span>
                      )}
                    </td>

                    {/* Route */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                          {item.fromDepartment}
                        </span>
                        <ArrowRight className={`w-3 h-3 flex-shrink-0 ${isReturn ? 'text-rose-500' : 'text-blue-500'}`} />
                        <span className={`px-2 py-0.5 rounded font-bold ${isReturn ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300' : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'}`}>
                          {item.toDepartment}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Sender: {item.senderName}
                      </span>
                    </td>

                    {/* Style / PO / Colour */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {item.styleNo}
                        </span>
                        {item.items && item.items.length > 1 && (
                          <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold">
                            +{item.items.length} items
                          </span>
                        )}
                      </div>
                      <span className="text-slate-600 dark:text-slate-400 block text-xs">
                        PO: {item.poNo} | {item.colour}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Size: <strong>{item.size || 'All Sizes'}</strong>
                      </span>
                    </td>

                    {/* Category & Wash Status */}
                    <td className="p-3">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                        {item.garmentType || 'Garment'}
                      </span>
                      {item.isWashGarment ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 rounded text-[10px] font-bold">
                          <Waves className="w-3 h-3" />
                          <span>Wash Garment</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-bold">
                          <Sparkles className="w-3 h-3" />
                          <span>Non-Wash Direct</span>
                        </span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="p-3 text-right">
                      <span className={`font-black text-sm block ${isReturn ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {item.quantity.toLocaleString()} pcs
                      </span>
                      {item.bundleCount && (
                        <span className="text-[11px] text-slate-500">
                          {item.bundleCount} bundles
                        </span>
                      )}
                    </td>

                    {/* Authorized Signatory */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                            {item.authorizedBy || 'Factory GM / Management'}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {item.authorizedDesignation || 'Factory Management'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3">
                      {item.status === 'Received' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Received</span>
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            By: {item.receiverName} ({item.receiveDate})
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-full font-bold text-[11px]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>In Transit / Dispatched</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Receive Action for Inbound */}
                        {item.status === 'Dispatched' && (effectiveDept === 'All' || isMatchDept(item.toDepartment, effectiveDept)) && (
                          receivingId === item.id ? (
                            <div className="flex flex-col gap-1 p-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-lg shadow-sm">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  placeholder="Receiver name..."
                                  value={receiverNameInput}
                                  onChange={e => setReceiverNameInput(e.target.value)}
                                  className="px-2 py-1 text-xs border rounded bg-white dark:bg-slate-800 w-28 font-medium"
                                />
                                <input
                                  type="number"
                                  placeholder="Qty"
                                  min={1}
                                  max={item.quantity}
                                  value={receivingQtyInput}
                                  onChange={e => setReceivingQtyInput(Math.max(1, parseInt(e.target.value) || 0))}
                                  title={`Receive Qty (Max: ${item.quantity} pcs)`}
                                  className="px-2 py-1 text-xs border rounded bg-white dark:bg-slate-800 w-20 font-black text-emerald-700 dark:text-emerald-300"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleReceive(item.id)}
                                  className="px-2.5 py-1 bg-emerald-600 text-white rounded font-bold text-[11px] hover:bg-emerald-700 shadow-sm"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReceivingId(null)}
                                  className="text-slate-400 text-xs px-1 hover:text-slate-600"
                                >
                                  ✕
                                </button>
                              </div>
                              {receivingQtyInput > 0 && receivingQtyInput < item.quantity && (
                                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold">
                                  Remaining {item.quantity - receivingQtyInput} pcs stays in inbound queue
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReceivingId(item.id);
                                setReceiverNameInput(currentUser?.name || '');
                                setReceivingQtyInput(item.quantity);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[11px] flex items-center gap-1 shadow-sm transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Receive</span>
                            </button>
                          )
                        )}

                        {/* Quick Return Button when item is received or belongs to destination */}
                        {item.status === 'Received' && (effectiveDept === 'All' || isMatchDept(item.toDepartment, effectiveDept)) && (
                          <button
                            type="button"
                            onClick={() => handleQuickReturn(item)}
                            title={`Return items back to ${item.fromDepartment}`}
                            className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                          >
                            <Undo2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Print Challan Gate Pass */}
                        <button
                          type="button"
                          onClick={() => printTransferChallanPDF(item)}
                          title="Open PDF / Print Delivery Challan & Gate Pass"
                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Delete Transfer Record */}
                        <button
                          type="button"
                          onClick={() => handleDeleteTransfer(item.id, item.challanNo)}
                          title="Delete Transfer Record"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="bg-slate-950 text-white font-black text-xs sticky bottom-0">
            <tr>
              <td className="p-3 text-white uppercase tracking-wider" colSpan={4}>
                TOTAL SUMMARY ({currentDisplayList.length} CHALLANS)
              </td>
              <td className="p-3 text-right text-emerald-400 font-mono text-sm">
                <div>{currentDisplayList.reduce((sum, item) => sum + (item.quantity || 0), 0).toLocaleString()} pcs</div>
                {currentDisplayList.some(item => item.bundleCount) && (
                  <div className="text-[10px] text-cyan-300 font-normal">
                    {currentDisplayList.reduce((sum, item) => sum + (item.bundleCount || 0), 0)} bundles
                  </div>
                )}
              </td>
              <td className="p-3 text-slate-300 text-xs" colSpan={3}>
                <span className="text-emerald-400">{currentDisplayList.filter(i => i.status === 'Received').length} Received</span>
                {' • '}
                <span className="text-amber-400">{currentDisplayList.filter(i => i.status === 'Dispatched').length} In Transit</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Transfer / Return Challan Modal */}
      <TransferChallanModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          refreshData();
        }}
        onSuccess={() => {
          refreshData();
        }}
        defaultFromDept={modalFromDept}
        defaultToDept={modalToDept}
        initialStyleNo={modalStyleNo}
        initialPoNo={modalPoNo}
        initialColour={modalColour}
        initialSize={modalSize}
        maxAvailableQty={modalQty}
        initialTransferType={modalTransferType}
        initialOriginalChallanNo={modalOriginalChallan}
      />
    </div>
  );
};
