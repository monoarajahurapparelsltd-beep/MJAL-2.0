import React from 'react';
import {
  Scissors,
  Shirt,
  Waves,
  Sparkles,
  Package,
  Truck,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';

interface StageData {
  title: string;
  code: string;
  qty: number;
  balance?: number;
  percentage?: number;
  status?: string;
  subLabel?: string;
}

interface Props {
  styleNo: string;
  styleName?: string;
  buyer?: string;
  garmentType?: string;
  isWashGarment: boolean;
  orderQty: number;
  cutQty: number;
  readyForSewingQty: number;
  cutToSewQty: number;
  sewInputs: number;
  sewOutput: number;
  sewWip: number;
  sewToWashQty: number;
  readyForWashQty: number;
  sewToFinishingDirectQty: number;
  readyForDirectFinishingQty: number;
  washReceivedQty: number;
  washToFinishingQty: number;
  readyFromWashForFinishingQty: number;
  finInputQty: number;
  finQty: number;
  packedQty: number;
  readyForPackingQty: number;
  shippedQty: number;
  readyForShipmentQty: number;
  currentStage?: string;
  compact?: boolean;
}

export const ProductionPipelineVisualizer: React.FC<Props> = ({
  styleNo,
  styleName,
  buyer,
  garmentType = 'Garment',
  isWashGarment,
  orderQty,
  cutQty,
  readyForSewingQty,
  cutToSewQty,
  sewInputs,
  sewOutput,
  sewWip,
  sewToWashQty,
  readyForWashQty,
  sewToFinishingDirectQty,
  readyForDirectFinishingQty,
  washReceivedQty,
  washToFinishingQty,
  readyFromWashForFinishingQty,
  finInputQty,
  finQty,
  packedQty,
  readyForPackingQty,
  shippedQty,
  readyForShipmentQty,
  currentStage,
  compact = false
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base">{styleNo}</span>
              {styleName && <span className="text-xs text-slate-500 hidden sm:inline">({styleName})</span>}
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-semibold">
                {buyer}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>Category: <strong className="text-slate-700 dark:text-slate-300">{garmentType}</strong></span>
              <span>•</span>
              <span>Order: <strong className="text-slate-900 dark:text-slate-100">{orderQty.toLocaleString()} pcs</strong></span>
            </div>
          </div>
        </div>

        {/* Route Badge */}
        <div className="flex items-center gap-2">
          {isWashGarment ? (
            <span className="px-3 py-1 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-cyan-600" />
              <span>Wash Garment (Sewing ➔ Washing Plant ➔ Finishing)</span>
            </span>
          ) : (
            <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Non-Wash Garment (Direct Sewing ➔ Finishing)</span>
            </span>
          )}
        </div>
      </div>

      {/* Pipeline Flow Stages */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 relative">
        {/* Stage 1: CUTTING */}
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Scissors className="w-4 h-4 text-amber-500" />
                <span>1. Cutting</span>
              </div>
              <span className="text-[11px] font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded">
                {orderQty > 0 ? Math.round((cutQty / orderQty) * 100) : 0}%
              </span>
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1">
              {cutQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">cut pcs</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Sent to Sewing:</span>
              <strong className="text-slate-800 dark:text-slate-200">{cutToSewQty.toLocaleString()} pcs</strong>
            </div>
            <div className="flex justify-between items-center text-blue-600 dark:text-blue-400 font-semibold">
              <span>Ready for Sew:</span>
              <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 rounded text-[11px] font-bold">
                {readyForSewingQty.toLocaleString()} pcs
              </span>
            </div>
          </div>
        </div>

        {/* Stage 2: SEWING */}
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Shirt className="w-4 h-4 text-blue-500" />
                <span>2. Sewing</span>
              </div>
              <span className="text-[11px] font-bold px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 rounded">
                {orderQty > 0 ? Math.round((sewOutput / orderQty) * 100) : 0}%
              </span>
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1">
              {sewOutput.toLocaleString()} <span className="text-xs font-normal text-slate-500">output pcs</span>
            </div>
            <div className="text-xs text-slate-500">
              Input: {sewInputs.toLocaleString()} | WIP: {sewWip.toLocaleString()}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
            {isWashGarment ? (
              <>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Sent to Wash:</span>
                  <strong className="text-cyan-700 dark:text-cyan-300">{sewToWashQty.toLocaleString()} pcs</strong>
                </div>
                <div className="flex justify-between items-center text-cyan-600 dark:text-cyan-400 font-semibold">
                  <span>Ready for Wash:</span>
                  <span className="px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-950/60 rounded text-[11px] font-bold">
                    {readyForWashQty.toLocaleString()} pcs
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Direct to Finishing:</span>
                  <strong className="text-emerald-700 dark:text-emerald-300">{sewToFinishingDirectQty.toLocaleString()} pcs</strong>
                </div>
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Ready for Finishing:</span>
                  <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 rounded text-[11px] font-bold">
                    {readyForDirectFinishingQty.toLocaleString()} pcs
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stage 3: WASHING (OR BYPASS) */}
        <div className={`border rounded-xl p-3 flex flex-col justify-between ${
          isWashGarment
            ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
            : 'bg-slate-50/50 dark:bg-slate-900/30 border-dashed border-slate-300 dark:border-slate-800 opacity-70'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Waves className="w-4 h-4 text-cyan-500" />
                <span>3. Washing</span>
              </div>
              {isWashGarment ? (
                <span className="text-[11px] font-bold px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 rounded">
                  {orderQty > 0 ? Math.round((washReceivedQty / orderQty) * 100) : 0}%
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 rounded">
                  Bypassed (Non-Wash)
                </span>
              )}
            </div>

            {isWashGarment ? (
              <>
                <div className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1">
                  {washReceivedQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">washed pcs</span>
                </div>
                <div className="text-xs text-slate-500">
                  Sent: {sewToWashQty.toLocaleString()}
                </div>
              </>
            ) : (
              <div className="py-2 text-center text-xs text-slate-400 italic">
                Direct to Finishing route (No wash required)
              </div>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
            {isWashGarment ? (
              <>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Sent to Finishing:</span>
                  <strong className="text-slate-800 dark:text-slate-200">{washToFinishingQty.toLocaleString()} pcs</strong>
                </div>
                <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400 font-semibold">
                  <span>Ready for Fin:</span>
                  <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 rounded text-[11px] font-bold">
                    {readyFromWashForFinishingQty.toLocaleString()} pcs
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-slate-500">
                <span>Handover:</span>
                <span>Direct Handover</span>
              </div>
            )}
          </div>
        </div>

        {/* Stage 4: FINISHING */}
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>4. Finishing</span>
              </div>
              <span className="text-[11px] font-bold px-1.5 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 rounded">
                {orderQty > 0 ? Math.round((finQty / orderQty) * 100) : 0}%
              </span>
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1">
              {finQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">finished pcs</span>
            </div>
            <div className="text-xs text-slate-500">
              Inbound: {finInputQty.toLocaleString()} pcs
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Packed in Cartons:</span>
              <strong className="text-slate-800 dark:text-slate-200">{packedQty.toLocaleString()} pcs</strong>
            </div>
            <div className="flex justify-between items-center text-purple-600 dark:text-purple-400 font-semibold">
              <span>Ready for Packing:</span>
              <span className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/60 rounded text-[11px] font-bold">
                {readyForPackingQty.toLocaleString()} pcs
              </span>
            </div>
          </div>
        </div>

        {/* Stage 5: PACKING & SHIPMENT */}
        <div className="col-span-2 sm:col-span-1 lg:col-span-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Truck className="w-4 h-4 text-emerald-500" />
                <span>5. Shipment</span>
              </div>
              <span className="text-[11px] font-bold px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded">
                {orderQty > 0 ? Math.round((shippedQty / orderQty) * 100) : 0}%
              </span>
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1">
              {shippedQty.toLocaleString()} <span className="text-xs font-normal text-slate-500">shipped pcs</span>
            </div>
            <div className="text-xs text-slate-500">
              Packed: {packedQty.toLocaleString()} pcs
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
            <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold">
              <span>Ready to Ship:</span>
              <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 rounded text-[11px] font-bold">
                {readyForShipmentQty.toLocaleString()} pcs
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Remaining Bal:</span>
              <strong className="text-slate-700 dark:text-slate-300">{Math.max(0, orderQty - shippedQty).toLocaleString()} pcs</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
