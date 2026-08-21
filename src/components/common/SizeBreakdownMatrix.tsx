import React, { useState } from 'react';
import { Ruler, CheckCircle2, Clock, ChevronDown, ChevronUp, Layers, LayoutGrid, Table, Check, Sparkles, ArrowRight } from 'lucide-react';
import { SizeProgressItem } from '../../types';

interface SizeBreakdownMatrixProps {
  sizeBreakdown: SizeProgressItem[];
  selectedSize?: string;
  onSelectSize?: (size: string) => void;
  currentModule?: 'Cutting' | 'Sewing' | 'Washing' | 'Finishing' | 'QC' | 'Packing' | 'Shipment' | 'Sample' | 'Store' | 'Merchandising' | 'General';
  title?: string;
  compact?: boolean;
}

export const SizeBreakdownMatrix: React.FC<SizeBreakdownMatrixProps> = ({
  sizeBreakdown,
  selectedSize,
  onSelectSize,
  currentModule = 'General',
  title = 'Size-Wise Production Breakdown & Factory Order Flow',
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  if (!sizeBreakdown || sizeBreakdown.length === 0) {
    return null;
  }

  const isCutting = currentModule === 'Cutting';
  
  // Calculate completed, transferred, received & remaining for the given item & module
  const getRowMetrics = (item: SizeProgressItem) => {
    const realOrderQty = item.realOrderQty !== undefined ? item.realOrderQty : item.orderQty;
    const factoryOrderQty = item.factoryOrderQty !== undefined && item.factoryOrderQty > 0 
      ? item.factoryOrderQty 
      : (item.orderQty > 0 ? item.orderQty : realOrderQty);
    const allowanceQty = item.allowanceQty !== undefined 
      ? item.allowanceQty 
      : Math.max(0, factoryOrderQty - realOrderQty);

    let produced = 0;
    let received = 0;
    let balance = 0;
    let percentage = 0;

    const transferred = item.transferredQty || 0;

    switch (currentModule) {
      case 'Cutting':
        produced = item.cutQty;
        received = factoryOrderQty; // Cutting begins with Factory Order Qty
        balance = item.cutBalance !== undefined ? item.cutBalance : Math.max(0, factoryOrderQty - produced);
        percentage = factoryOrderQty > 0 ? Math.round((produced / factoryOrderQty) * 100) : 0;
        break;
      case 'Sewing':
        received = item.sewingReceivedQty ?? item.receivedQty ?? 0;
        produced = item.sewOutput;
        balance = item.sewBalance !== undefined ? item.sewBalance : Math.max(0, received - produced);
        percentage = received > 0 ? Math.round((produced / received) * 100) : 0;
        break;
      case 'Washing':
        received = item.washingReceivedQty ?? item.receivedQty ?? 0;
        produced = item.washingReceivedQty ?? 0;
        balance = Math.max(0, received - produced);
        percentage = received > 0 ? Math.round((produced / received) * 100) : 0;
        break;
      case 'Finishing':
        received = item.finishingReceivedQty ?? item.receivedQty ?? 0;
        produced = item.finQty;
        balance = item.finBalance !== undefined ? item.finBalance : Math.max(0, received - produced);
        percentage = received > 0 ? Math.round((produced / received) * 100) : 0;
        break;
      case 'Packing':
        received = item.packingReceivedQty ?? item.receivedQty ?? 0;
        produced = item.packedQty;
        balance = item.packBalance !== undefined ? item.packBalance : Math.max(0, received - produced);
        percentage = received > 0 ? Math.round((produced / received) * 100) : 0;
        break;
      case 'Shipment':
        received = item.shipmentReceivedQty ?? item.receivedQty ?? 0;
        produced = item.shippedQty;
        balance = item.shipBalance !== undefined ? item.shipBalance : Math.max(0, received - produced);
        percentage = received > 0 ? Math.round((produced / received) * 100) : 0;
        break;
      case 'QC':
        received = item.receivedQty ?? factoryOrderQty;
        produced = item.qcPassedQty;
        balance = Math.max(0, received - produced);
        percentage = received > 0 ? Math.round((produced / received) * 100) : 0;
        break;
      default:
        received = item.receivedQty ?? factoryOrderQty;
        produced = item.shippedQty > 0 ? item.shippedQty : item.packedQty > 0 ? item.packedQty : item.finQty > 0 ? item.finQty : item.sewOutput > 0 ? item.sewOutput : item.cutQty;
        balance = Math.max(0, (isCutting ? factoryOrderQty : received) - produced);
        percentage = (isCutting ? factoryOrderQty : received) > 0 
          ? Math.round((produced / (isCutting ? factoryOrderQty : received)) * 100) 
          : 0;
    }

    return {
      realOrderQty,
      allowanceQty,
      factoryOrderQty,
      produced,
      transferred,
      received,
      remaining: balance,
      percentage
    };
  };

  // Totals
  const totalRealOrder = sizeBreakdown.reduce((s, i) => s + getRowMetrics(i).realOrderQty, 0);
  const totalAllowance = sizeBreakdown.reduce((s, i) => s + getRowMetrics(i).allowanceQty, 0);
  const totalFactoryOrder = sizeBreakdown.reduce((s, i) => s + getRowMetrics(i).factoryOrderQty, 0);
  const totalProduced = sizeBreakdown.reduce((s, i) => s + getRowMetrics(i).produced, 0);
  const totalTransferred = sizeBreakdown.reduce((s, i) => s + getRowMetrics(i).transferred, 0);
  const totalReceived = sizeBreakdown.reduce((s, i) => s + getRowMetrics(i).received, 0);
  const totalRemaining = sizeBreakdown.reduce((s, i) => s + getRowMetrics(i).remaining, 0);
  const overallTarget = isCutting ? totalFactoryOrder : (totalReceived > 0 ? totalReceived : totalFactoryOrder);
  const totalPct = overallTarget > 0 ? Math.round((totalProduced / overallTarget) * 100) : 0;

  return (
    <div id="size-breakdown-matrix-panel" className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs space-y-3 transition-all">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Ruler className="h-4 w-4" />
          </div>
          <div>
            <h5 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              {title}
              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                {sizeBreakdown.length} {sizeBreakdown.length === 1 ? 'Size' : 'Sizes'}
              </span>
            </h5>
            <p className="text-[11px] text-slate-500">
              Factory Order Qty = Real Order + Allowance (Main Production Target for all Departments)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Metrics Bar */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
              Factory Order: <strong className="text-blue-900 font-black">{totalFactoryOrder.toLocaleString()}</strong> pcs
            </span>
            <span className="bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-md border border-emerald-200 text-[11px]">
              Produced: <strong className="text-emerald-900 font-black">{totalProduced.toLocaleString()}</strong> pcs
            </span>
            <span className={`font-medium px-2 py-0.5 rounded-md border text-[11px] ${
              totalRemaining === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              Remaining: <strong className="font-extrabold">{totalRemaining.toLocaleString()}</strong> ({totalPct}%)
            </span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Detailed Table View"
            >
              <Table className="w-3 h-3" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid className="w-3 h-3" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>

          {/* Collapse/Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition border border-slate-200"
            title={isExpanded ? 'Collapse Size Matrix' : 'Expand Size Matrix'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isExpanded && (
        <div className="space-y-3">
          {/* 1. Quick "All Sizes" Master Selector Bar */}
          {onSelectSize && (
            <div className="flex items-center justify-between gap-2 bg-slate-50/90 border border-slate-200/80 px-2.5 py-1.5 rounded-lg text-xs">
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px] font-bold">Fast Size Selection:</span>
                <span className="text-[11px] text-slate-500">Choose all or specific size for input</span>
              </div>
              <button
                type="button"
                onClick={() => onSelectSize('All Sizes')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1.5 ${
                  !selectedSize || selectedSize === 'All Sizes'
                    ? 'bg-blue-600 text-white shadow-2xs ring-1 ring-blue-500'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                {(!selectedSize || selectedSize === 'All Sizes') && <Check className="w-3 h-3" />}
                <span>All Sizes (Master Batch)</span>
              </button>
            </div>
          )}

          {/* 2. Complete 8-Column Table View (Required Rule: Size | Real Order Qty | Allowance Qty | Factory Order Qty | Produced | Transferred | Received | Remaining) */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto rounded-xl border border-slate-300/80 shadow-xs">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#0b1329] text-[11px] text-white font-black tracking-wider uppercase border-b border-slate-800">
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3 text-right text-slate-300">Real Order Qty</th>
                    <th className="py-2.5 px-3 text-right text-amber-300">Allowance Qty</th>
                    <th className="py-2.5 px-3 text-right text-blue-300">Factory Order Qty</th>
                    <th className="py-2.5 px-3 text-right text-emerald-400">Produced</th>
                    <th className="py-2.5 px-3 text-right text-purple-300">Transferred</th>
                    <th className="py-2.5 px-3 text-right text-cyan-300">Received</th>
                    <th className="py-2.5 px-3 text-right text-amber-400">Remaining</th>
                    {onSelectSize && <th className="py-2.5 px-3 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {sizeBreakdown.map(item => {
                    const m = getRowMetrics(item);
                    const isSelected = selectedSize && selectedSize.trim().toUpperCase() === item.size.trim().toUpperCase();
                    const isFinished = m.remaining === 0 && m.factoryOrderQty > 0;

                    return (
                      <tr
                        key={item.size}
                        onClick={() => onSelectSize && onSelectSize(item.size)}
                        className={`transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/90 font-semibold text-blue-900'
                            : 'hover:bg-slate-50/80 text-slate-800'
                        }`}
                      >
                        <td className="py-2 px-3 font-bold flex items-center gap-1.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}
                          >
                            {item.size}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] text-blue-700 font-bold bg-blue-100 px-1.5 py-0.2 rounded">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {m.realOrderQty.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                          +{m.allowanceQty.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-blue-700">
                          {m.factoryOrderQty.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                          {m.produced.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-purple-700">
                          {m.transferred.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-cyan-800">
                          {m.received.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            m.remaining === 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 font-black'
                          }`}>
                            {m.remaining.toLocaleString()}
                          </span>
                        </td>
                        {onSelectSize && (
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSize(item.size);
                              }}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700 border border-slate-200'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-blue-50/70 font-black border-t-2 border-slate-300 text-slate-900 text-xs">
                    <td className="py-2.5 px-3 font-black uppercase text-[10px] tracking-wider">TOTAL</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">{totalRealOrder.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">+{totalAllowance.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-blue-900 text-sm">{totalFactoryOrder.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">{totalProduced.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-purple-800">{totalTransferred.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-cyan-900">{totalReceived.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-rose-700">{totalRemaining.toLocaleString()}</td>
                    {onSelectSize && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* 3. Interactive Cards Grid View */}
          {viewMode === 'cards' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {sizeBreakdown.map(item => {
                const m = getRowMetrics(item);
                const isSelected = selectedSize && selectedSize.trim().toUpperCase() === item.size.trim().toUpperCase();
                const isFinished = m.remaining === 0 && m.factoryOrderQty > 0;

                return (
                  <div
                    key={item.size}
                    onClick={() => onSelectSize && onSelectSize(item.size)}
                    className={`group relative cursor-pointer rounded-xl border p-2.5 transition-all flex flex-col justify-between select-none ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/40 shadow-xs scale-[1.02]'
                        : isFinished
                        ? 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-50/70'
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-2xs hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Top: Size Badge & Status */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span
                        className={`inline-flex items-center justify-center px-2 py-0.5 rounded-lg font-mono font-black text-xs transition ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-900 border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-700'
                        }`}
                      >
                        {item.size}
                      </span>

                      {isSelected ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-blue-700 bg-blue-100/90 px-1.5 py-0.5 rounded">
                          <Check className="w-2.5 h-2.5" /> Active
                        </span>
                      ) : isFinished ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Done
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500">
                          {m.percentage}%
                        </span>
                      )}
                    </div>

                    {/* Middle: Progress Bar */}
                    <div className="space-y-1 my-1.5">
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            m.percentage >= 100
                              ? 'bg-emerald-500'
                              : m.percentage >= 50
                              ? 'bg-blue-500'
                              : m.percentage > 0
                              ? 'bg-amber-500'
                              : 'bg-slate-200'
                          }`}
                          style={{ width: `${Math.min(100, m.percentage)}%` }}
                        />
                      </div>
                    </div>

                    {/* Bottom: Numerical Quantities */}
                    <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100 text-[10px] text-center font-mono">
                      <div>
                        <span className="block text-[8px] text-slate-400 font-sans font-semibold">Factory</span>
                        <span className="font-bold text-blue-700">{m.factoryOrderQty}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-emerald-600 font-sans font-semibold">Done</span>
                        <span className="font-bold text-emerald-700">{m.produced}</span>
                      </div>
                      <div>
                        <span className="block text-[8px] text-rose-500 font-sans font-semibold">Rem</span>
                        <span className={`font-black ${m.remaining === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {m.remaining}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

