import React, { useState, useEffect } from 'react';
import { Warehouse, Plus, AlertTriangle, ArrowUpRight, ArrowDownLeft, Trash2, Edit, AlertCircle, Info } from 'lucide-react';
import { supabaseDataService } from '../../../services/supabaseDataService';
import { StoreStockItem, StoreTransaction } from '../../../types';
import { PageHeader } from '../../common/PageHeader';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { ConfirmationDialog } from '../../common/ConfirmationDialog';
import { ExportPrintToolbar } from '../../common/ExportPrintToolbar';
import { PermissionGuard } from '../../common/PermissionGuard';
import { useAuth } from '../../../context/AuthContext';
import { useERP } from '../../../context/ERPContext';

export const StoreModule: React.FC = () => {
  const { currentUser, canOperate, canDelete } = useAuth();
  const { activeModule } = useERP();
  const [stockItems, setStockItems] = useState<StoreStockItem[]>(supabaseDataService.getStoreStock());
  const [transactions, setTransactions] = useState<StoreTransaction[]>(supabaseDataService.getStoreTransactions());
  const [orders, setOrders] = useState(supabaseDataService.getOrders());
  const [activeTab, setActiveTab] = useState<'fabric' | 'trims' | 'fg' | 'ledger'>('fabric');

  useEffect(() => {
    if (activeModule === 'store' || activeModule === 'store_fabric') {
      setActiveTab('fabric');
    } else if (activeModule === 'store_trims') {
      setActiveTab('trims');
    } else if (activeModule === 'store_fg') {
      setActiveTab('fg');
    } else if (activeModule === 'store_ledger') {
      setActiveTab('ledger');
    }
  }, [activeModule]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'stock' | 'tx'; id: string; title: string } | null>(null);
  const [selectedStock, setSelectedStock] = useState<StoreStockItem | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transaction form
  const [storeType, setStoreType] = useState<'Fabric' | 'Trims' | 'Finished Goods'>('Fabric');
  const [transactionType, setTransactionType] = useState<'Receive' | 'Issue'>('Receive');
  const [styleNo, setStyleNo] = useState('');
  const [poNo, setPoNo] = useState('');
  const [colour, setColour] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('Yards');
  const [supplierOrDept, setSupplierOrDept] = useState('');

  // Stock Edit Form
  const [stockCurrent, setStockCurrent] = useState<number | ''>('');
  const [stockMin, setStockMin] = useState<number | ''>('');
  const [stockLocation, setStockLocation] = useState('');

  useEffect(() => {
    const update = () => {
      setStockItems([...supabaseDataService.getStoreStock()]);
      setTransactions([...supabaseDataService.getStoreTransactions()]);
      setOrders([...supabaseDataService.getOrders()]);
    };
    update();
    const unsub = supabaseDataService.subscribe(update);
    return unsub;
  }, []);

  const handleSelectOrderCombo = (combinedVal: string) => {
    if (!combinedVal) return;
    const [sNo, pNo, col] = combinedVal.split('||');
    setStyleNo(sNo || '');
    setPoNo(pNo || '');
    setColour(col || '');
  };

  const resetTxForm = () => {
    setStoreType('Fabric');
    setTransactionType('Receive');
    setStyleNo('');
    setPoNo('');
    setColour('');
    setItemName('');
    setQuantity('');
    setUnit('Yards');
    setSupplierOrDept('');
    setErrorMessage(null);
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleNo || !poNo || !colour || !itemName || quantity === '') {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const tx: StoreTransaction = {
      id: 'tx-' + Date.now(),
      date: new Date().toISOString().substring(0, 10),
      storeType,
      transactionType,
      styleNo,
      poNo,
      colour,
      itemName,
      quantity: Number(quantity),
      unit,
      supplierOrDept: supplierOrDept || 'Store Department',
      performedBy: currentUser?.name || 'Store In-charge'
    };

    const res = await supabaseDataService.addStoreTransaction(tx, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to submit transaction to Supabase.');
    } else {
      setIsModalOpen(false);
      resetTxForm();
    }
  };

  const handleOpenEditStock = (item: StoreStockItem) => {
    setSelectedStock(item);
    setStockCurrent(item.currentStock);
    setStockMin(item.minStockLevel);
    setStockLocation(item.location || 'Main Warehouse');
    setErrorMessage(null);
    setIsStockModalOpen(true);
  };

  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock || stockCurrent === '' || stockMin === '') return;
    setErrorMessage(null);
    setIsLoading(true);

    const updated: StoreStockItem = {
      ...selectedStock,
      currentStock: Number(stockCurrent),
      minStockLevel: Number(stockMin),
      location: stockLocation || 'Main Warehouse'
    };

    const res = await supabaseDataService.saveStoreStockItem(updated, currentUser?.name);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update stock in Supabase.');
    } else {
      setIsStockModalOpen(false);
      setSelectedStock(null);
    }
  };

  const handleOpenDelete = (type: 'stock' | 'tx', id: string, title: string) => {
    setItemToDelete({ type, id, title });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsLoading(true);
    let res;
    if (itemToDelete.type === 'stock') {
      res = await supabaseDataService.deleteStoreStockItem(itemToDelete.id, currentUser?.name);
    } else {
      res = await supabaseDataService.deleteStoreTransaction(itemToDelete.id, currentUser?.name);
    }
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to delete record from Supabase.');
    } else {
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const filteredItems = stockItems.filter(item => {
    if (activeTab === 'fabric') return item.storeType === 'Fabric';
    if (activeTab === 'trims') return item.storeType === 'Trims';
    if (activeTab === 'fg') return item.storeType === 'Finished Goods';
    return true;
  });

  const stockColumns: Column<StoreStockItem>[] = [
    { header: 'Item Name', accessorKey: 'itemName', sortable: true, cell: i => <span className="font-bold text-slate-800">{i.itemName}</span> },
    { header: 'Style / PO', cell: i => <div><span className="font-bold text-blue-600">{i.styleNo}</span> <span className="text-slate-500">({i.poNo})</span></div> },
    { header: 'Colour', accessorKey: 'colour' },
    {
      header: 'Current Stock',
      accessorKey: 'currentStock',
      sortable: true,
      cell: i => (
        <span className={`font-bold ${(i.currentStock || 0) <= i.minStockLevel ? 'text-rose-600' : 'text-slate-900'}`}>
          {(i.currentStock || 0).toLocaleString()} {i.unit}
        </span>
      )
    },
    { header: 'Min Level', cell: i => <span className="text-slate-500">{i.minStockLevel} {i.unit}</span> },
    { header: 'Location', accessorKey: 'location' },
    {
      header: 'Actions',
      cell: i => (
        <div className="flex items-center gap-1">
          {canOperate('Store') && (
            <button
              onClick={() => handleOpenEditStock(i)}
              title="Edit Stock Item"
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete('Store') && (
            <button
              onClick={() => handleOpenDelete('stock', i.id, i.itemName)}
              title="Delete Stock Item"
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  const ledgerColumns: Column<StoreTransaction>[] = [
    { header: 'Date', accessorKey: 'date', sortable: true },
    {
      header: 'Type',
      accessorKey: 'transactionType',
      cell: t => (
        <span className={`inline-flex items-center gap-1 font-bold text-xs ${t.transactionType === 'Receive' ? 'text-emerald-600' : 'text-amber-600'}`}>
          {t.transactionType === 'Receive' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
          {t.transactionType}
        </span>
      )
    },
    { header: 'Store Type', accessorKey: 'storeType' },
    { header: 'Style / PO / Colour', cell: t => <span>{t.styleNo} ({t.poNo} - {t.colour})</span> },
    { header: 'Item', accessorKey: 'itemName' },
    { header: 'Quantity', cell: t => <span className="font-bold">{(t.quantity || 0).toLocaleString()} {t.unit}</span> },
    { header: 'Supplier / Dept', accessorKey: 'supplierOrDept' },
    { header: 'Performed By', accessorKey: 'performedBy' },
    {
      header: 'Actions',
      cell: t => (
        <div className="flex items-center gap-1">
          {canDelete('Store') && (
            <button
              onClick={() => handleOpenDelete('tx', t.id, `${t.transactionType} ${t.quantity} ${t.unit} ${t.itemName}`)}
              title="Delete Transaction"
              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
        title="Store & Inventory Management"
        description="Fabric, Trim & Accessories, Finished Goods Receiving (GRN), Issue & Stock Ledgers"
        actions={
          <div className="flex items-center gap-2">
            <ExportPrintToolbar title="Store Inventory" data={stockItems} filename="MJAL_Store_Stock" />
            <PermissionGuard department="Store">
              <button
                onClick={() => { resetTxForm(); setIsModalOpen(true); }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Store Entry (GRN / Issue)
              </button>
            </PermissionGuard>
          </div>
        }
      />

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {activeTab === 'ledger' ? (
        <DataTable data={transactions} columns={ledgerColumns} keyExtractor={t => t.id} searchPlaceholder="Search transactions..." />
      ) : (
        <DataTable data={filteredItems} columns={stockColumns} keyExtractor={i => i.id} searchPlaceholder="Search inventory stock..." />
      )}

      {/* Transaction Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetTxForm(); }} title="Store Material Transaction (GRN / Issue)">
        <form onSubmit={handleTransaction} className="space-y-4">
          {/* Quick Select Active Order */}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Store Type *</label>
              <select value={storeType} onChange={e => setStoreType(e.target.value as any)} className="w-full rounded border p-2 text-xs font-bold">
                <option value="Fabric">Fabric Store</option>
                <option value="Trims">Trims & Accessories</option>
                <option value="Finished Goods">Finished Goods Store</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Action *</label>
              <select value={transactionType} onChange={e => setTransactionType(e.target.value as any)} className="w-full rounded border p-2 text-xs font-bold text-blue-600">
                <option value="Receive">Receive Material (GRN)</option>
                <option value="Issue">Issue Material to Floor</option>
              </select>
            </div>
          </div>

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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Item Name *</label>
            <input
              type="text"
              placeholder="Enter Item Name (e.g. 12.5 oz Stretch Indigo Denim)"
              value={itemName}
              onChange={e => setItemName(e.target.value)}
              className="w-full rounded border p-2 text-xs font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                placeholder="Enter Quantity"
                value={quantity}
                onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded border p-2 text-xs font-bold text-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit *</label>
              <input
                type="text"
                placeholder="e.g. Yards, Meters, Pcs, Kgs"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="w-full rounded border p-2 text-xs font-bold"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Receiving Department</label>
            <input
              type="text"
              placeholder="Enter Supplier Name or Destination Department"
              value={supplierOrDept}
              onChange={e => setSupplierOrDept(e.target.value)}
              className="w-full rounded border p-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 p-4 shrink-0 z-10">
            <button type="button" onClick={() => { setIsModalOpen(false); resetTxForm(); }} className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">Cancel</button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
            >
              {isLoading ? 'Submitting...' : 'Submit Transaction'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Edit Modal */}
      <Modal isOpen={isStockModalOpen} onClose={() => setIsStockModalOpen(false)} title={`Edit Stock: ${selectedStock?.itemName}`}>
        <form onSubmit={handleSaveStock} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Stock ({selectedStock?.unit}) *</label>
              <input
                type="number"
                placeholder="Enter Current Stock"
                value={stockCurrent}
                onChange={e => setStockCurrent(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded border p-2 text-xs font-bold text-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min Alert Level ({selectedStock?.unit}) *</label>
              <input
                type="number"
                placeholder="Enter Min Alert Level"
                value={stockMin}
                onChange={e => setStockMin(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded border p-2 text-xs"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Warehouse Location</label>
            <input
              type="text"
              placeholder="e.g. Main Warehouse Rack 4"
              value={stockLocation}
              onChange={e => setStockLocation(e.target.value)}
              className="w-full rounded border p-2 text-xs"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 p-4 shrink-0 z-10">
            <button type="button" onClick={() => setIsStockModalOpen(false)} className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">Cancel</button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
            >
              {isLoading ? 'Updating...' : 'Update Stock in Database'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Confirm Deletion"
        message={`Are you sure you want to permanently delete "${itemToDelete?.title}" from the database?`}
        confirmLabel={isLoading ? "Deleting..." : "Delete Permanently"}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
      />
    </div>
  );
};
