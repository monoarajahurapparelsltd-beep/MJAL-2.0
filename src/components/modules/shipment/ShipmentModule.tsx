import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  AlertCircle,
  PackageCheck,
  Printer,
  CheckCircle2,
  Layers,
  Eye,
  Search,
  Check,
  X,
  Calendar,
  UserCheck,
  Box,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import {
  ShipmentRecord,
  ShipmentItem,
  ReadyShipmentBatch
} from '../../../types';
import { PageHeader } from '../../common/PageHeader';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { useAuth } from '../../../context/AuthContext';
import { useERP } from '../../../context/ERPContext';
import { PermissionGuard } from '../../common/PermissionGuard';
import { printCommercialShipmentPDF } from '../../../utils/printUtils';

export const ShipmentModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { activeModule } = useERP();

  const [shipments, setShipments] = useState<ShipmentRecord[]>(supabaseDataService.getShipmentRecords());
  const [readyBatches, setReadyBatches] = useState<ReadyShipmentBatch[]>(supabaseDataService.getReadyShipmentBatches());
  const [activeTab, setActiveTab] = useState<'ready_queue' | 'consignments'>('ready_queue');

  // Sync tab with activeModule from navigation
  useEffect(() => {
    if (activeModule === 'shipment_history' || activeModule === 'shipment_records') {
      setActiveTab('consignments');
    } else {
      setActiveTab('ready_queue');
    }
  }, [activeModule]);

  // Real-time subscription to database changes
  useEffect(() => {
    const handleDataUpdate = () => {
      setShipments([...supabaseDataService.getShipmentRecords()]);
      setReadyBatches([...supabaseDataService.getReadyShipmentBatches()]);
    };
    handleDataUpdate();
    const unsub = supabaseDataService.subscribe(handleDataUpdate);
    return unsub;
  }, []);

  // UI Filters & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('Pending');
  const [expandedBatchKeys, setExpandedBatchKeys] = useState<Set<string>>(new Set());

  // Modal States
  const [isConsignmentModalOpen, setIsConsignmentModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedViewShipment, setSelectedViewShipment] = useState<ShipmentRecord | null>(null);
  const [shipmentToDelete, setShipmentToDelete] = useState<ShipmentRecord | null>(null);
  const [editingShipmentId, setEditingShipmentId] = useState<string | null>(null);

  // Notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Consignment Entry Form State
  const [formInvoiceNo, setFormInvoiceNo] = useState('');
  const [formPackingListNo, setFormPackingListNo] = useState('');
  const [formShipmentDate, setFormShipmentDate] = useState(new Date().toISOString().substring(0, 10));
  const [formVesselOrFlight, setFormVesselOrFlight] = useState('MSC GULSUN V-204');
  const [formContainerNo, setFormContainerNo] = useState('MSCU7829102');
  const [formPortOfLoading, setFormPortOfLoading] = useState('Chittagong Port, Bangladesh');
  const [formPortOfDischarge, setFormPortOfDischarge] = useState('Global Destination Port');
  const [formPreparedBy, setFormPreparedBy] = useState(currentUser?.name || 'Commercial Logistics Officer');
  const [formRemarks, setFormRemarks] = useState('');

  // Selected Batch for shipment entry
  const [selectedBatchKey, setSelectedBatchKey] = useState<string>('');
  // Size-wise shipment input quantity map: { [sizeName]: number }
  const [sizeInputMap, setSizeInputMap] = useState<Record<string, number>>({});
  const [sizeValidationErrors, setSizeValidationErrors] = useState<Record<string, string>>({});

  // Summary Metrics
  const totalReadyQty = useMemo(() => {
    return readyBatches.reduce((acc, b) => acc + (b.readyQty || 0), 0);
  }, [readyBatches]);

  const totalShippedQty = useMemo(() => {
    return shipments.reduce((acc, s) => acc + (s.shippedQty || 0), 0);
  }, [shipments]);

  const totalPendingQty = useMemo(() => {
    return readyBatches.reduce((acc, b) => acc + (b.pendingQty || 0), 0);
  }, [readyBatches]);

  const totalCartons = useMemo(() => {
    return shipments.reduce((acc, s) => acc + (s.cartonCount || 0), 0);
  }, [shipments]);

  // Unique lists for filtering
  const allBuyers = useMemo(() => {
    const buyers = new Set<string>();
    readyBatches.forEach(b => { if (b.buyer) buyers.add(b.buyer); });
    shipments.forEach(s => { if (s.buyer) buyers.add(s.buyer); });
    return Array.from(buyers);
  }, [readyBatches, shipments]);

  // Filtered Ready Batches
  const filteredReadyBatches = useMemo(() => {
    return readyBatches.filter(batch => {
      const matchSearch = !searchQuery ||
        batch.styleNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.poNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.colour.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.buyer.toLowerCase().includes(searchQuery.toLowerCase());

      const matchBuyer = selectedBuyerFilter === 'All' || batch.buyer === selectedBuyerFilter;
      
      let matchStatus = true;
      if (selectedStatusFilter === 'Pending') {
        matchStatus = batch.pendingQty > 0;
      } else if (selectedStatusFilter === 'Shipment Complete') {
        matchStatus = batch.isComplete || batch.status === 'Shipment Complete';
      } else if (selectedStatusFilter !== 'All') {
        matchStatus = batch.status === selectedStatusFilter;
      }

      return matchSearch && matchBuyer && matchStatus;
    });
  }, [readyBatches, searchQuery, selectedBuyerFilter, selectedStatusFilter]);

  // Filtered Shipment Records (History)
  const filteredShipments = useMemo(() => {
    return shipments.filter(ship => {
      const matchSearch = !searchQuery ||
        ship.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ship.packingListNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ship.styleNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ship.poNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ship.colour.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ship.buyer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ship.containerNo && ship.containerNo.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchBuyer = selectedBuyerFilter === 'All' || ship.buyer === selectedBuyerFilter;
      const matchStatus = selectedStatusFilter === 'All' ||
        (selectedStatusFilter === 'Shipped' && (ship.status === 'Shipped' || ship.status === 'Shipment Complete' || ship.status === 'Completed' || !ship.status)) ||
        ship.status === selectedStatusFilter;

      return matchSearch && matchBuyer && matchStatus;
    });
  }, [shipments, searchQuery, selectedBuyerFilter, selectedStatusFilter]);

  // Currently selected ready batch in the consignment modal
  const activeSelectedBatch = useMemo(() => {
    if (!selectedBatchKey) return null;
    return readyBatches.find(b => b.key === selectedBatchKey) || null;
  }, [selectedBatchKey, readyBatches]);

  // Total Quantity being shipped in this consignment entry
  const currentTotalShippingQty = useMemo(() => {
    return Object.values(sizeInputMap).reduce((acc: number, q: number) => acc + (Number(q) || 0), 0);
  }, [sizeInputMap]);

  // Check if any size input has validation errors or exceeds available ready qty
  const hasValidationErrors = useMemo(() => {
    if (!activeSelectedBatch) return true;
    if (currentTotalShippingQty <= 0) return true;
    
    // Check individual sizes
    for (const szItem of activeSelectedBatch.sizeBreakdown) {
      const entered = Number(sizeInputMap[szItem.size] || 0);
      if (entered < 0) return true;
      if (entered > szItem.availableReadyQty) return true;
    }
    return false;
  }, [activeSelectedBatch, currentTotalShippingQty, sizeInputMap]);

  // Toggle row expansion for size breakdown in ready queue
  const toggleBatchExpansion = (key: string) => {
    setExpandedBatchKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Open Consignment Entry Modal with pre-loaded batch if available
  const handleOpenConsignmentModal = (targetBatch?: ReadyShipmentBatch) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSizeValidationErrors({});

    const autoInvoiceNo = `MJAL-EXP-${new Date().getFullYear()}-${String(shipments.length + 1).padStart(3, '0')}`;
    const autoPackingListNo = `PL-MJAL-${new Date().getFullYear()}-${String(shipments.length + 1).padStart(3, '0')}`;

    setEditingShipmentId(null);
    setFormInvoiceNo(autoInvoiceNo);
    setFormPackingListNo(autoPackingListNo);
    setFormShipmentDate(new Date().toISOString().substring(0, 10));
    setFormVesselOrFlight('MSC GULSUN V-204');
    setFormContainerNo('MSCU7829102');
    setFormPortOfLoading('Chittagong Port, Bangladesh');
    setFormPortOfDischarge('Global Destination Port');
    setFormPreparedBy(currentUser?.name || 'Commercial Logistics Officer');
    setFormRemarks('');

    if (targetBatch) {
      setSelectedBatchKey(targetBatch.key);
      const initInputs: Record<string, number> = {};
      targetBatch.sizeBreakdown.forEach(sz => {
        initInputs[sz.size] = 0;
      });
      setSizeInputMap(initInputs);
    } else {
      const firstAvailable = readyBatches.find(b => b.pendingQty > 0);
      if (firstAvailable) {
        setSelectedBatchKey(firstAvailable.key);
        const initInputs: Record<string, number> = {};
        firstAvailable.sizeBreakdown.forEach(sz => {
          initInputs[sz.size] = 0;
        });
        setSizeInputMap(initInputs);
      } else {
        setSelectedBatchKey('');
        setSizeInputMap({});
      }
    }

    setIsConsignmentModalOpen(true);
  };

  // When changing selected batch in modal
  const handleSelectBatch = (key: string) => {
    setSelectedBatchKey(key);
    setSizeValidationErrors({});
    const batch = readyBatches.find(b => b.key === key);
    if (batch) {
      const initInputs: Record<string, number> = {};
      batch.sizeBreakdown.forEach(sz => {
        initInputs[sz.size] = 0;
      });
      setSizeInputMap(initInputs);
    } else {
      setSizeInputMap({});
    }
  };

  // Handle size input changes with real-time validation and restriction
  const handleSizeInputChange = (sizeName: string, value: string, maxAvailable: number) => {
    const num = value === '' ? 0 : parseInt(value, 10);
    const errors = { ...sizeValidationErrors };

    if (isNaN(num) || num < 0) {
      errors[sizeName] = 'Quantity must be a positive number.';
      setSizeInputMap(prev => ({ ...prev, [sizeName]: 0 }));
    } else if (num > maxAvailable) {
      errors[sizeName] = `Cannot exceed available Ready for Shipment quantity (${maxAvailable} pcs).`;
      setSizeInputMap(prev => ({ ...prev, [sizeName]: maxAvailable }));
    } else {
      delete errors[sizeName];
      setSizeInputMap(prev => ({ ...prev, [sizeName]: num }));
    }

    setSizeValidationErrors(errors);
  };

  // Quick Action: Ship 100% of Available Ready Quantity for all sizes
  const handleShipFullAvailable = () => {
    if (!activeSelectedBatch) return;
    const fullInputs: Record<string, number> = {};
    activeSelectedBatch.sizeBreakdown.forEach(sz => {
      fullInputs[sz.size] = sz.availableReadyQty;
    });
    setSizeInputMap(fullInputs);
    setSizeValidationErrors({});
  };

  // Quick Action: Clear all size inputs
  const handleClearInputs = () => {
    if (!activeSelectedBatch) return;
    const cleared: Record<string, number> = {};
    activeSelectedBatch.sizeBreakdown.forEach(sz => {
      cleared[sz.size] = 0;
    });
    setSizeInputMap(cleared);
    setSizeValidationErrors({});
  };

  // Submit Consignment Entry
  const handleSubmitConsignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSelectedBatch) {
      setErrorMessage('Please select a valid Style, PO, and Colour item.');
      return;
    }

    if (currentTotalShippingQty <= 0) {
      setErrorMessage('Please enter at least 1 piece to create a shipment consignment.');
      return;
    }

    if (hasValidationErrors) {
      setErrorMessage('Cannot ship more than the available Ready for Shipment quantity.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const shipmentItems: ShipmentItem[] = activeSelectedBatch.sizeBreakdown
        .map(sz => {
          const shippedQty = Number(sizeInputMap[sz.size] || 0);
          return {
            buyer: activeSelectedBatch.buyer,
            styleNo: activeSelectedBatch.styleNo,
            poNo: activeSelectedBatch.poNo,
            colour: activeSelectedBatch.colour,
            size: sz.size,
            orderQty: sz.orderQty,
            readyQty: sz.readyQty,
            shippedQty: shippedQty,
            pendingQty: Math.max(0, sz.readyQty - (sz.shippedQty + shippedQty)),
            balanceQty: Math.max(0, sz.orderQty - (sz.shippedQty + shippedQty)),
            cartonCount: Math.ceil(shippedQty / 20) || (shippedQty > 0 ? 1 : 0)
          };
        })
        .filter(it => it.shippedQty > 0);

      const totalShippedInConsignment = currentTotalShippingQty;
      const totalOrderQty = activeSelectedBatch.orderQty;
      const totalCartonCount = Math.ceil(totalShippedInConsignment / 20) || 1;

      const consignmentStatus: ShipmentRecord['status'] = 'Shipped';

      const newRecord: ShipmentRecord = {
        id: editingShipmentId || `ship-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        invoiceNo: formInvoiceNo.trim() || `MJAL-EXP-${Date.now()}`,
        packingListNo: formPackingListNo.trim() || `PL-MJAL-${Date.now()}`,
        shipmentDate: formShipmentDate,
        buyer: activeSelectedBatch.buyer,
        styleNo: activeSelectedBatch.styleNo,
        poNo: activeSelectedBatch.poNo,
        colour: activeSelectedBatch.colour,
        size: shipmentItems.length === 1 ? shipmentItems[0].size : 'Size Breakdown',
        shippedQty: totalShippedInConsignment,
        orderQty: totalOrderQty,
        balanceQty: Math.max(0, totalOrderQty - (activeSelectedBatch.shippedQty + totalShippedInConsignment)),
        cartonCount: totalCartonCount,
        vesselOrFlight: formVesselOrFlight.trim(),
        containerNo: formContainerNo.trim(),
        portOfLoading: formPortOfLoading.trim(),
        portOfDischarge: formPortOfDischarge.trim(),
        status: consignmentStatus,
        preparedBy: formPreparedBy.trim() || (currentUser?.name || 'Commercial Officer'),
        items: shipmentItems,
        remarks: formRemarks.trim() || undefined
      };

      const res = await supabaseDataService.saveShipmentRecord(newRecord, currentUser?.name);
      if (!res.success) {
        throw new Error(res.error || 'Failed to save shipment record.');
      }

      setSuccessMessage(`Shipment Consignment #${newRecord.invoiceNo} successfully created for ${totalShippedInConsignment} pcs.`);
      setIsConsignmentModalOpen(false);
      setEditingShipmentId(null);
    } catch (err: any) {
      console.error('Error saving consignment entry:', err);
      setErrorMessage(err?.message || 'Failed to save consignment entry.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Consignment Confirmation
  const handleDeleteShipment = async () => {
    if (!shipmentToDelete) return;
    setIsLoading(true);
    try {
      const res = await supabaseDataService.deleteShipmentRecord(shipmentToDelete.id, currentUser?.name);
      if (!res.success) throw new Error(res.error || 'Failed to delete shipment record.');
      setSuccessMessage(`Consignment #${shipmentToDelete.invoiceNo} deleted. Ready for shipment quantities restored.`);
      setIsDeleteModalOpen(false);
      setShipmentToDelete(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete consignment.');
    } finally {
      setIsLoading(false);
    }
  };

  // Columns for Ready for Shipment Goods Table
  const readyColumns: Column<ReadyShipmentBatch>[] = [
    {
      header: 'Buyer & Garment',
      accessorKey: 'buyer',
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-bold text-slate-900">{row.buyer}</span>
          <div className="text-xs text-slate-500">{row.garmentType || 'Garment'}</div>
        </div>
      )
    },
    {
      header: 'Style & PO Details',
      accessorKey: 'styleNo',
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-bold text-blue-600 tracking-tight">{row.styleNo}</span>
          <div className="text-xs font-medium text-slate-600">PO: {row.poNo}</div>
        </div>
      )
    },
    {
      header: 'Colour',
      accessorKey: 'colour',
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
          {row.colour}
        </span>
      )
    },
    {
      header: 'Order Target',
      accessorKey: 'orderQty',
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-bold text-slate-700">
          {Number(row.orderQty || 0).toLocaleString()} pcs
        </span>
      )
    },
    {
      header: 'Ready for Shipment Qty',
      accessorKey: 'readyQty',
      sortable: true,
      cell: (row) => (
        <div className="text-right">
          <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {Number(row.readyQty || 0).toLocaleString()} pcs
          </span>
        </div>
      )
    },
    {
      header: 'Shipped Qty',
      accessorKey: 'shippedQty',
      sortable: true,
      cell: (row) => (
        <div className="text-right">
          <span className="text-xs font-bold text-blue-700">
            {Number(row.shippedQty || 0).toLocaleString()} pcs
          </span>
        </div>
      )
    },
    {
      header: 'Shipment Pending Qty',
      accessorKey: 'pendingQty',
      sortable: true,
      cell: (row) => {
        const isComplete = row.isComplete || Number(row.pendingQty || 0) === 0;
        return (
          <div className="text-right">
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-md border ${
                isComplete
                  ? 'bg-slate-100 text-slate-500 border-slate-200 line-through'
                  : 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
              }`}
            >
              {Number(row.pendingQty || 0).toLocaleString()} pcs
            </span>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => {
        if (row.isComplete || row.status === 'Shipment Complete') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              Shipment Complete
            </span>
          );
        }
        if (row.status === 'Partial Shipment') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Partial Shipped
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
            Ready for Shipment
          </span>
        );
      }
    }
  ];

  // Actions renderer for Ready Table
  const renderReadyActions = (row: ReadyShipmentBatch) => {
    const isExpanded = expandedBatchKeys.has(row.key);
    const canShip = row.pendingQty > 0 && !row.isComplete;

    return (
      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => toggleBatchExpansion(row.key)}
          className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition-colors flex items-center gap-1"
          title="View Size-Wise Matrix"
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
          <span>Sizes</span>
        </button>

        {canShip ? (
          <PermissionGuard permission="CREATE" department="Shipment">
            <button
              type="button"
              onClick={() => handleOpenConsignmentModal(row)}
              className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-2xs transition-colors flex items-center gap-1"
              title="Create Shipment Consignment Entry"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Ship</span>
            </button>
          </PermissionGuard>
        ) : (
          <span className="px-2 py-1 text-xs font-medium text-slate-400 bg-slate-50 rounded border border-slate-200">
            Completed
          </span>
        )}
      </div>
    );
  };

  // Columns for Consignment Records Table (History)
  const historyColumns: Column<ShipmentRecord>[] = [
    {
      header: 'Consignment / Invoice No.',
      accessorKey: 'invoiceNo',
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-bold text-blue-600 tracking-tight">{row.invoiceNo}</span>
          <div className="text-xs text-slate-500">PL: {row.packingListNo}</div>
        </div>
      )
    },
    {
      header: 'Date',
      accessorKey: 'shipmentDate',
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-slate-400" />
          {row.shipmentDate}
        </span>
      )
    },
    {
      header: 'Buyer & Order',
      accessorKey: 'buyer',
      sortable: true,
      cell: (row) => (
        <div>
          <span className="font-bold text-slate-900">{row.buyer}</span>
          <div className="text-xs text-slate-600 font-medium">{row.styleNo} • {row.poNo}</div>
        </div>
      )
    },
    {
      header: 'Colour & Size',
      accessorKey: 'colour',
      sortable: true,
      cell: (row) => (
        <div>
          <span className="text-xs font-semibold text-slate-800">{row.colour}</span>
          <div className="text-xs text-slate-500 font-medium">
            {row.items && row.items.length > 0 ? (
              <span className="text-emerald-700 font-bold">{row.items.map(it => `${it.size}: ${it.shippedQty}`).join(', ')}</span>
            ) : (
              row.size || 'All Sizes'
            )}
          </div>
        </div>
      )
    },
    {
      header: 'Shipped Qty',
      accessorKey: 'shippedQty',
      sortable: true,
      cell: (row) => (
        <div className="text-right">
          <span className="text-sm font-black text-emerald-700">
            {Number(row.shippedQty || 0).toLocaleString()} pcs
          </span>
          <div className="text-xs text-slate-500">{row.cartonCount} cartons</div>
        </div>
      )
    },
    {
      header: 'Carrier & Container',
      accessorKey: 'vesselOrFlight',
      sortable: true,
      cell: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800">{row.vesselOrFlight || 'Commercial Carrier'}</span>
          <div className="text-slate-500 font-mono text-[11px]">{row.containerNo || 'N/A'}</div>
        </div>
      )
    },
    {
      header: 'Responsible User',
      accessorKey: 'preparedBy',
      sortable: true,
      cell: (row) => (
        <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
          <UserCheck className="w-3 h-3 text-slate-400" />
          {row.preparedBy || 'Commercial Officer'}
        </span>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: () => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <Truck className="w-3 h-3 text-emerald-600" />
          Shipped
        </span>
      )
    }
  ];

  // Actions renderer for Consignments History Table
  const renderHistoryActions = (row: ShipmentRecord) => (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => {
          setSelectedViewShipment(row);
          setIsViewModalOpen(true);
        }}
        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
        title="View Consignment Details"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          printCommercialShipmentPDF(row, row.items && row.items.length > 0 ? row.items : [{
            buyer: row.buyer,
            styleNo: row.styleNo,
            poNo: row.poNo,
            colour: row.colour,
            size: row.size,
            shippedQty: row.shippedQty,
            orderQty: row.orderQty,
            balanceQty: row.balanceQty,
            cartonCount: row.cartonCount
          }]);
        }}
        className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
        title="Print Official Commercial Invoice & Packing List (PDF)"
      >
        <Printer className="w-4 h-4" />
      </button>
      <PermissionGuard permission="DELETE" department="Shipment">
        <button
          type="button"
          onClick={() => {
            setShipmentToDelete(row);
            setIsDeleteModalOpen(true);
          }}
          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
          title="Delete Consignment (Restores Ready Qty)"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </PermissionGuard>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Module Page Header */}
      <PageHeader
        title="COMMERCIAL EXPORT & SHIPMENT MANAGEMENT"
        subtitle="Direct Ready-to-Ship Inventory Tracking, Size-Wise Consignment Entry & Export History"
        actions={
          <div className="flex items-center gap-2">
            <ExportPrintToolbar
              data={activeTab === 'ready_queue' ? filteredReadyBatches : filteredShipments}
              filename={`MJAL_Shipment_${activeTab === 'ready_queue' ? 'Ready_Queue' : 'Consignments'}_${new Date().toISOString().substring(0, 10)}`}
              title="Commercial Shipment Report"
            />
            <PermissionGuard permission="CREATE" department="Shipment">
              <button
                type="button"
                onClick={() => handleOpenConsignmentModal()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Shipment Consignment Entry</span>
              </button>
            </PermissionGuard>
          </div>
        }
      />

      {/* Alert Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-sm font-medium animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-sm font-medium animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Ready for Shipment Qty */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Ready for Shipment Qty
            </div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {totalReadyQty.toLocaleString()} <span className="text-xs font-bold text-slate-500 font-sans">pcs</span>
            </div>
            <div className="text-[11px] font-medium text-emerald-700 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Finished goods available</span>
            </div>
          </div>
        </div>

        {/* Metric 2: Shipped Qty */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Shipped Qty
            </div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {totalShippedQty.toLocaleString()} <span className="text-xs font-bold text-slate-500 font-sans">pcs</span>
            </div>
            <div className="text-[11px] font-medium text-blue-700 mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Total commercial dispatches</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Shipment Pending Qty */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Shipment Pending Qty
            </div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {totalPendingQty.toLocaleString()} <span className="text-xs font-bold text-slate-500 font-sans">pcs</span>
            </div>
            <div className="text-[11px] font-medium text-amber-700 mt-0.5">
              Ready goods awaiting dispatch
            </div>
          </div>
        </div>

        {/* Metric 4: Export Cartons & Consignments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Consignments & Cartons
            </div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">
              {shipments.length} <span className="text-xs font-bold text-slate-500 font-sans">consignments</span>
            </div>
            <div className="text-[11px] font-medium text-purple-700 mt-0.5">
              {totalCartons.toLocaleString()} total cartons shipped
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('ready_queue')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'ready_queue'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Ready for Shipment Queue</span>
            <span
              className={`ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeTab === 'ready_queue' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {readyBatches.filter(b => b.pendingQty > 0).length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('consignments')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'consignments'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Shipment Consignment Records & History</span>
            <span
              className={`ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-black ${
                activeTab === 'consignments' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {shipments.length}
            </span>
          </button>
        </div>

        {/* Global Search & Filters */}
        <div className="flex items-center gap-2 flex-wrap grow sm:grow-0 justify-end">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Style, PO, Colour, Buyer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>

          <select
            value={selectedBuyerFilter}
            onChange={(e) => setSelectedBuyerFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="All">All Buyers</option>
            {allBuyers.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="All">All Statuses</option>
            {activeTab === 'ready_queue' ? (
              <>
                <option value="Pending">Pending Shipment</option>
                <option value="Shipped">Shipped</option>
              </>
            ) : (
              <option value="Shipped">Shipped</option>
            )}
          </select>
        </div>
      </div>

      {/* Tab 1: Ready for Shipment Items Table */}
      {activeTab === 'ready_queue' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Available Ready for Shipment Items ({filteredReadyBatches.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Direct Ready-to-Ship Goods from Finishing Outputs
              </span>
            </div>

            <DataTable
              data={filteredReadyBatches}
              columns={readyColumns}
              keyExtractor={(item) => item.key}
              actions={renderReadyActions}
            />

            {/* Render any expanded batch size breakdown matrices below */}
            {Array.from(expandedBatchKeys).map(expandedKey => {
              const row = readyBatches.find(b => b.key === expandedKey);
              if (!row) return null;

              return (
                <div key={row.key} className="p-4 bg-slate-50/90 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Size Breakdown Matrix: {row.buyer} • Style {row.styleNo} • PO {row.poNo} • {row.colour}
                      </h4>
                    </div>
                    {row.pendingQty > 0 && !row.isComplete && (
                      <PermissionGuard permission="CREATE" department="Shipment">
                        <button
                          type="button"
                          onClick={() => handleOpenConsignmentModal(row)}
                          className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Create Consignment for this Style</span>
                        </button>
                      </PermissionGuard>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse bg-white rounded-xl overflow-hidden border border-slate-200 shadow-2xs">
                      <thead>
                        <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-2.5">Size</th>
                          <th className="p-2.5 text-right">Order Qty</th>
                          <th className="p-2.5 text-right text-emerald-700 font-black">Ready for Shipment Qty</th>
                          <th className="p-2.5 text-right text-blue-700">Already Shipped Qty</th>
                          <th className="p-2.5 text-right text-amber-800 font-black">Available to Ship</th>
                          <th className="p-2.5 text-right text-slate-600">Remaining Order Balance</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {row.sizeBreakdown.map(sz => (
                          <tr key={sz.size} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-2.5 font-bold text-slate-900">{sz.size}</td>
                            <td className="p-2.5 text-right text-slate-600">{sz.orderQty.toLocaleString()} pcs</td>
                            <td className="p-2.5 text-right font-black text-emerald-700">{sz.readyQty.toLocaleString()} pcs</td>
                            <td className="p-2.5 text-right font-bold text-blue-700">{sz.shippedQty.toLocaleString()} pcs</td>
                            <td className="p-2.5 text-right font-black text-amber-800 bg-amber-50/50">
                              {sz.availableReadyQty.toLocaleString()} pcs
                            </td>
                            <td className="p-2.5 text-right text-slate-500">{sz.balanceQty.toLocaleString()} pcs</td>
                            <td className="p-2.5 text-center">
                              {sz.status === 'Shipment Complete' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800">
                                  <Check className="w-3 h-3 text-purple-600" /> Complete
                                </span>
                              ) : sz.shippedQty > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                                  Partial ({sz.shippedQty}/{sz.readyQty})
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                  Ready
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                          <td className="p-2.5 uppercase tracking-wide">Total:</td>
                          <td className="p-2.5 text-right">{row.orderQty.toLocaleString()} pcs</td>
                          <td className="p-2.5 text-right text-emerald-700 font-black">{row.readyQty.toLocaleString()} pcs</td>
                          <td className="p-2.5 text-right text-blue-700">{row.shippedQty.toLocaleString()} pcs</td>
                          <td className="p-2.5 text-right text-amber-800 font-black">{row.pendingQty.toLocaleString()} pcs</td>
                          <td className="p-2.5 text-right text-slate-600">{Math.max(0, row.orderQty - row.shippedQty).toLocaleString()} pcs</td>
                          <td className="p-2.5 text-center">
                            {row.isComplete ? 'Shipment Complete' : `${row.pendingQty} pcs pending`}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Shipment Consignments & History Table */}
      {activeTab === 'consignments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Export Consignment History ({filteredShipments.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Official Commercial Invoice & BL dispatch statements
              </span>
            </div>

            <DataTable
              data={filteredShipments}
              columns={historyColumns}
              keyExtractor={(item) => item.id}
              actions={renderHistoryActions}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SHIPMENT CONSIGNMENT ENTRY MODAL */}
      {/* ========================================================================= */}
      {isConsignmentModalOpen && (
        <Modal
          isOpen={isConsignmentModalOpen}
          onClose={() => {
            if (!isLoading) {
              setIsConsignmentModalOpen(false);
              setEditingShipmentId(null);
            }
          }}
          title="Create Shipment Consignment Entry"
          size="2xl"
        >
          <form onSubmit={handleSubmitConsignment} className="space-y-6">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Consignment Header Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Consignment / Invoice No. *
                </label>
                <input
                  type="text"
                  required
                  value={formInvoiceNo}
                  onChange={(e) => setFormInvoiceNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. MJAL-EXP-2026-001"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Packing List No. *
                </label>
                <input
                  type="text"
                  required
                  value={formPackingListNo}
                  onChange={(e) => setFormPackingListNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. PL-MJAL-2026-001"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Shipment Date *
                </label>
                <input
                  type="date"
                  required
                  value={formShipmentDate}
                  onChange={(e) => setFormShipmentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Prepared By *
                </label>
                <input
                  type="text"
                  required
                  value={formPreparedBy}
                  onChange={(e) => setFormPreparedBy(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Select Ready for Shipment Item */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-800 mb-1.5 flex items-center justify-between">
                <span>Select Ready Item (Style, PO & Colour) *</span>
                <span className="text-[11px] font-medium text-slate-500">
                  Only items with available ready quantities are shown
                </span>
              </label>

              <select
                value={selectedBatchKey}
                onChange={(e) => handleSelectBatch(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-bold bg-white border-2 border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900"
              >
                <option value="" disabled>-- Select Ready for Shipment Item --</option>
                {readyBatches.filter(b => b.pendingQty > 0).map(b => (
                  <option
                    key={b.key}
                    value={b.key}
                  >
                    {b.buyer} | Style: {b.styleNo} | PO: {b.poNo} | Colour: {b.colour} — Available Ready: {b.pendingQty} pcs
                  </option>
                ))}
              </select>
            </div>

            {/* Size-Wise Breakdown & Input Table */}
            {activeSelectedBatch && (
              <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wide text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      Size-Wise Ready for Shipment Breakdown & Consignment Input
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Enter quantity to ship for each size. Quantity cannot exceed Available Ready Quantity.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleShipFullAvailable}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Ship Full Available (100%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearInputs}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                        <th className="p-2.5 text-left">Size</th>
                        <th className="p-2.5 text-right">Order Qty</th>
                        <th className="p-2.5 text-right text-emerald-700">Ready Qty</th>
                        <th className="p-2.5 text-right text-blue-700">Already Shipped</th>
                        <th className="p-2.5 text-right text-amber-800 font-black">Available Ready</th>
                        <th className="p-2.5 text-center w-36 bg-blue-50/80 font-black text-blue-900 border-l border-r border-blue-200">
                          Shipment Input (Pcs) *
                        </th>
                        <th className="p-2.5 text-right text-slate-600">Balance After Ship</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeSelectedBatch.sizeBreakdown.map(sz => {
                        const entered = Number(sizeInputMap[sz.size] || 0);
                        const remainingAfter = Math.max(0, sz.availableReadyQty - entered);
                        const hasError = !!sizeValidationErrors[sz.size];

                        return (
                          <tr key={sz.size} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 font-black text-slate-900">{sz.size}</td>
                            <td className="p-2.5 text-right text-slate-600">{sz.orderQty.toLocaleString()} pcs</td>
                            <td className="p-2.5 text-right font-bold text-emerald-700">{sz.readyQty.toLocaleString()} pcs</td>
                            <td className="p-2.5 text-right font-medium text-blue-700">{sz.shippedQty.toLocaleString()} pcs</td>
                            <td className="p-2.5 text-right font-black text-amber-800">
                              {sz.availableReadyQty.toLocaleString()} pcs
                            </td>
                            <td className="p-1.5 bg-blue-50/40 border-l border-r border-blue-100">
                              <input
                                type="number"
                                min={0}
                                max={sz.availableReadyQty}
                                disabled={sz.availableReadyQty <= 0}
                                value={sizeInputMap[sz.size] ?? 0}
                                onChange={(e) => handleSizeInputChange(sz.size, e.target.value, sz.availableReadyQty)}
                                className={`w-full px-2.5 py-1.5 text-xs text-right font-black rounded-lg border focus:ring-2 focus:outline-none transition-all ${
                                  hasError
                                    ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-400'
                                    : entered > 0
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 focus:ring-emerald-400'
                                    : 'border-slate-300 bg-white text-slate-900 focus:ring-blue-400'
                                }`}
                              />
                              {hasError && (
                                <div className="text-[10px] text-rose-600 font-bold mt-0.5 text-right">
                                  {sizeValidationErrors[sz.size]}
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-700">
                              {remainingAfter.toLocaleString()} pcs
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                        <td className="p-2.5 uppercase tracking-wide">Total:</td>
                        <td className="p-2.5 text-right">{activeSelectedBatch.orderQty.toLocaleString()} pcs</td>
                        <td className="p-2.5 text-right text-emerald-700">{activeSelectedBatch.readyQty.toLocaleString()} pcs</td>
                        <td className="p-2.5 text-right text-blue-700">{activeSelectedBatch.shippedQty.toLocaleString()} pcs</td>
                        <td className="p-2.5 text-right text-amber-800">{activeSelectedBatch.pendingQty.toLocaleString()} pcs</td>
                        <td className="p-2.5 text-center bg-blue-100 font-black text-blue-900 border-l border-r border-blue-300">
                          {currentTotalShippingQty.toLocaleString()} pcs
                        </td>
                        <td className="p-2.5 text-right text-slate-800 font-black">
                          {Math.max(0, activeSelectedBatch.pendingQty - currentTotalShippingQty).toLocaleString()} pcs
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Real-Time Live Status Outcome */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700">Consignment Dispatch Total:</span>
                    <span className="font-black text-emerald-700 text-sm">{currentTotalShippingQty.toLocaleString()} pcs</span>
                    <span className="text-slate-500 font-medium">({Math.ceil(currentTotalShippingQty / 20) || 1} Cartons)</span>
                  </div>

                  <div>
                    {currentTotalShippingQty > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Truck className="w-3.5 h-3.5 text-emerald-600" />
                        Status: Shipped
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Logistics & Commercial Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Vessel / Carrier
                </label>
                <input
                  type="text"
                  value={formVesselOrFlight}
                  onChange={(e) => setFormVesselOrFlight(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. MSC GULSUN V-204"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Container No.
                </label>
                <input
                  type="text"
                  value={formContainerNo}
                  onChange={(e) => setFormContainerNo(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. MSCU7829102"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Port of Loading
                </label>
                <input
                  type="text"
                  value={formPortOfLoading}
                  onChange={(e) => setFormPortOfLoading(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Chittagong Port, Bangladesh"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Port of Discharge
                </label>
                <input
                  type="text"
                  value={formPortOfDischarge}
                  onChange={(e) => setFormPortOfDischarge(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Global Destination Port"
                />
              </div>

              <div className="sm:col-span-2 md:col-span-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Remarks / Bill of Lading Notes
                </label>
                <input
                  type="text"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Optional shipment notes, carton marks, customs instructions..."
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setIsConsignmentModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || hasValidationErrors || currentTotalShippingQty <= 0}
                className="px-5 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all flex items-center gap-2"
              >
                {isLoading ? (
                  <span>Saving Consignment...</span>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>Confirm & Dispatch Consignment ({currentTotalShippingQty} pcs)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* VIEW SHIPMENT CONSIGNMENT DETAILS MODAL */}
      {/* ========================================================================= */}
      {isViewModalOpen && selectedViewShipment && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedViewShipment(null);
          }}
          title={`Export Consignment Details: ${selectedViewShipment.invoiceNo}`}
          size="xl"
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Invoice No:</span>
                <span className="text-xs font-black text-slate-900">{selectedViewShipment.invoiceNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Packing List:</span>
                <span className="text-xs font-bold text-slate-900">{selectedViewShipment.packingListNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Date:</span>
                <span className="text-xs font-medium text-slate-700">{selectedViewShipment.shipmentDate}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Status:</span>
                <span className="text-xs font-black text-emerald-700">{selectedViewShipment.status}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Buyer:</span>
                <span className="text-xs font-bold text-blue-600">{selectedViewShipment.buyer}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Style / PO:</span>
                <span className="text-xs font-medium text-slate-800">{selectedViewShipment.styleNo} • {selectedViewShipment.poNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Vessel:</span>
                <span className="text-xs font-medium text-slate-800">{selectedViewShipment.vesselOrFlight || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Container:</span>
                <span className="text-xs font-mono font-medium text-slate-800">{selectedViewShipment.containerNo || 'N/A'}</span>
              </div>
            </div>

            {/* Size Breakdown in Consignment */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Consignment Size Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5">Size</th>
                      <th className="p-2.5 text-right">Order Target</th>
                      <th className="p-2.5 text-right text-emerald-700 font-black">Shipped Qty</th>
                      <th className="p-2.5 text-right">Cartons</th>
                      <th className="p-2.5 text-right text-slate-600">Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {selectedViewShipment.items && selectedViewShipment.items.length > 0 ? (
                      selectedViewShipment.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{it.size || 'All Sizes'}</td>
                          <td className="p-2.5 text-right text-slate-600">{(it.orderQty || 0).toLocaleString()} pcs</td>
                          <td className="p-2.5 text-right font-black text-emerald-700">{(it.shippedQty || 0).toLocaleString()} pcs</td>
                          <td className="p-2.5 text-right font-bold text-slate-700">{(it.cartonCount || Math.ceil((it.shippedQty || 0) / 20) || 1).toLocaleString()} ctns</td>
                          <td className="p-2.5 text-right text-slate-500">{(it.balanceQty || 0).toLocaleString()} pcs</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">{selectedViewShipment.size || 'All Sizes'}</td>
                        <td className="p-2.5 text-right text-slate-600">{selectedViewShipment.orderQty.toLocaleString()} pcs</td>
                        <td className="p-2.5 text-right font-black text-emerald-700">{selectedViewShipment.shippedQty.toLocaleString()} pcs</td>
                        <td className="p-2.5 text-right font-bold text-slate-700">{selectedViewShipment.cartonCount} ctns</td>
                        <td className="p-2.5 text-right text-slate-500">{selectedViewShipment.balanceQty.toLocaleString()} pcs</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <td className="p-2.5 uppercase tracking-wide">Total Consignment:</td>
                      <td className="p-2.5 text-right">{selectedViewShipment.orderQty.toLocaleString()} pcs</td>
                      <td className="p-2.5 text-right text-emerald-700 font-black">{selectedViewShipment.shippedQty.toLocaleString()} pcs</td>
                      <td className="p-2.5 text-right">{selectedViewShipment.cartonCount} ctns</td>
                      <td className="p-2.5 text-right text-slate-600">{selectedViewShipment.balanceQty.toLocaleString()} pcs</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  printCommercialShipmentPDF(
                    selectedViewShipment,
                    selectedViewShipment.items && selectedViewShipment.items.length > 0
                      ? selectedViewShipment.items
                      : [{
                          buyer: selectedViewShipment.buyer,
                          styleNo: selectedViewShipment.styleNo,
                          poNo: selectedViewShipment.poNo,
                          colour: selectedViewShipment.colour,
                          size: selectedViewShipment.size,
                          shippedQty: selectedViewShipment.shippedQty,
                          orderQty: selectedViewShipment.orderQty,
                          balanceQty: selectedViewShipment.balanceQty,
                          cartonCount: selectedViewShipment.cartonCount
                        }]
                  );
                }}
                className="px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Invoice & Packing List (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsViewModalOpen(false);
                  setSelectedViewShipment(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONSIGNMENT CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      {isDeleteModalOpen && shipmentToDelete && (
        <ConfirmationDialog
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setShipmentToDelete(null);
          }}
          onConfirm={handleDeleteShipment}
          title="Delete Export Consignment Entry?"
          message={`Are you sure you want to delete Consignment #${shipmentToDelete.invoiceNo} (${shipmentToDelete.shippedQty} pcs)? This will automatically restore the available Ready for Shipment quantity.`}
          confirmLabel="Delete Consignment"
          variant="danger"
          isLoading={isLoading}
        />
      )}
    </div>
  );
};
