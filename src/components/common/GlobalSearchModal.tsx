import React from 'react';
import { Search, ShoppingBag, Shirt, Users, ArrowRight } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';

export const GlobalSearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    globalSearchQuery,
    setGlobalSearchQuery,
    searchResults,
    setActiveModule
  } = useERP();

  if (!isSearchOpen) return null;

  const totalResults =
    searchResults.orders.length + searchResults.sewing.length + searchResults.employees.length;

  return (
    <Modal
      isOpen={isSearchOpen}
      onClose={() => setIsSearchOpen(false)}
      title="Global Factory Search"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            autoFocus
            value={globalSearchQuery}
            onChange={e => setGlobalSearchQuery(e.target.value)}
            placeholder="Search by Buyer, Style No (MJ-101), PO No (PO-5001), Colour, Employee ID..."
            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-11 pr-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950 shadow-sm transition-all"
          />
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto space-y-6 pt-2 overscroll-contain">
          {!globalSearchQuery ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Search className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Type a keyword to search factory records</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try searching "PO-5001", "H&M", "MJ-101", "Navy", "Rafiqul"</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No matching records found for "{globalSearchQuery}"</p>
            </div>
          ) : (
            <>
              {/* Orders & Styles Results */}
              {searchResults.orders.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <ShoppingBag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Orders & Styles ({searchResults.orders.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
                    {searchResults.orders.map(order => (
                      <div
                        key={order.id}
                        onClick={() => {
                          setActiveModule('orders');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-blue-600 dark:text-blue-400">{order.styleNo}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">• {order.buyer}</span>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{order.styleName} ({order.season})</p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            <span>Qty: {order.totalOrderQty.toLocaleString()} pcs</span>
                            <span>•</span>
                            <span>POs: {order.purchaseOrders.map(p => p.poNo).join(', ')}</span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sewing Production Results */}
              {searchResults.sewing.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Shirt className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Sewing Production Records ({searchResults.sewing.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
                    {searchResults.sewing.map(sew => (
                      <div
                        key={sew.id}
                        onClick={() => {
                          setActiveModule('sewing');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{sew.lineNo}</span>
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{sew.styleNo}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">({sew.poNo} - {sew.colour})</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            Date: {sew.date} | Output: {sew.totalOutput} pcs (Target: {sew.dailyTarget})
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Employees Results */}
              {searchResults.employees.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Employees ({searchResults.employees.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
                    {searchResults.employees.map(emp => (
                      <div
                        key={emp.id}
                        onClick={() => {
                          setActiveModule('hr');
                          setIsSearchOpen(false);
                        }}
                        className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{emp.name}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">({emp.empId})</span>
                            <StatusBadge status={emp.status} />
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{emp.designation} — {emp.department}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
