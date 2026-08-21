/**
 * FACTORY ALLOWANCE – SIZE-WISE CALCULATION UTILITIES
 * 
 * Rules:
 * 1. Original Customer Order Qty must remain unchanged.
 * 2. Factory Allowance must be calculated separately for every Size.
 *    Formula:
 *      Factory Allowance Qty = Size Order Qty * Allowance %
 *      Factory Order Qty = Size Order Qty + Factory Allowance Qty
 * 3. Allowance is calculated directly from each Size quantity (never randomly distributed from grand totals).
 * 4. Recalculation is always based on the ORIGINAL Order Qty (idempotent; repeated saves never accumulate).
 * 5. Hierarchy: Buyer -> PO -> Style -> Colour -> Size -> Original Order Qty -> Factory Allowance % -> Factory Order Qty.
 */

import { OrderStyle } from '../types';
import { formatBDT, USD_TO_BDT_RATE, BDTFormatResult } from './currencyUtils';

export interface SizeAllowanceItem {
  size: string;
  orderQty: number;
  allowancePct: number;
  allowanceQty: number;
  factoryQty: number;
}

export interface SizeWiseAllowanceResult {
  sizeQuantities: Record<string, number>;          // Original Customer Order Quantities
  factorySizeQuantities: Record<string, number>;   // Size-wise Factory Quantities
  allowanceSizeQuantities: Record<string, number>; // Size-wise Allowance Quantities
  items: SizeAllowanceItem[];                      // Detailed size-by-size breakdown
  totalOrderQty: number;                           // Sum of original size quantities
  totalAllowanceQty: number;                       // Sum of size allowance quantities
  totalFactoryQty: number;                         // Sum of size factory quantities
  allowancePct: number;                            // Applied allowance percentage
}

/**
 * Calculates size-wise factory order quantity and allowance quantity directly from original size quantities.
 * Strictly idempotent: always calculates directly from `sizeQuantities`, never from prior factory totals.
 * 
 * @param sizeQuantities Map of Size -> Original Customer Order Quantity (e.g. { S: 100, M: 200, L: 300, XL: 400 })
 * @param allowancePct Factory Allowance % (e.g. 5)
 * @returns SizeWiseAllowanceResult with size-wise details and exact totals
 */
export function calculateSizeWiseAllowance(
  sizeQuantities: Record<string, number> = {},
  allowancePct: number = 0
): SizeWiseAllowanceResult {
  const cleanPct = Math.max(0, Number(allowancePct) || 0);
  const cleanSizeQuantities: Record<string, number> = {};
  const factorySizeQuantities: Record<string, number> = {};
  const allowanceSizeQuantities: Record<string, number> = {};
  const items: SizeAllowanceItem[] = [];

  let totalOrderQty = 0;
  let totalAllowanceQty = 0;
  let totalFactoryQty = 0;

  // Process each size entry
  const entries = Object.entries(sizeQuantities);
  for (const [sizeKey, rawQty] of entries) {
    const size = sizeKey.trim();
    if (!size) continue;

    const orderQty = Math.max(0, Number(rawQty) || 0);
    // Formula: Factory Allowance Qty = Size Order Qty * Allowance % (rounded to nearest integer)
    const allowanceQty = Math.round(orderQty * (cleanPct / 100));
    // Formula: Factory Order Qty = Size Order Qty + Factory Allowance Qty
    const factoryQty = orderQty + allowanceQty;

    cleanSizeQuantities[size] = orderQty;
    factorySizeQuantities[size] = factoryQty;
    allowanceSizeQuantities[size] = allowanceQty;

    items.push({
      size,
      orderQty,
      allowancePct: cleanPct,
      allowanceQty,
      factoryQty
    });

    totalOrderQty += orderQty;
    totalAllowanceQty += allowanceQty;
    totalFactoryQty += factoryQty;
  }

  // If sizeQuantities was empty but totalQty was specified elsewhere, handle gracefully
  return {
    sizeQuantities: cleanSizeQuantities,
    factorySizeQuantities,
    allowanceSizeQuantities,
    items,
    totalOrderQty,
    totalAllowanceQty,
    totalFactoryQty,
    allowancePct: cleanPct
  };
}

/**
 * Calculates single size factory quantity and allowance.
 */
export function calculateSingleSizeFactoryQty(
  orderQty: number,
  allowancePct: number
): { orderQty: number; allowancePct: number; allowanceQty: number; factoryQty: number } {
  const cleanOrderQty = Math.max(0, Number(orderQty) || 0);
  const cleanPct = Math.max(0, Number(allowancePct) || 0);
  const allowanceQty = Math.round(cleanOrderQty * (cleanPct / 100));
  const factoryQty = cleanOrderQty + allowanceQty;

  return {
    orderQty: cleanOrderQty,
    allowancePct: cleanPct,
    allowanceQty,
    factoryQty
  };
}

export interface OrderAllowanceSummaryResult {
  totalOrderQty: number;
  totalAllowanceQty: number;
  totalFactoryQty: number;
  totalOrderValueUSD: number;
  totalFactoryValueUSD: number;
  totalAllowanceValueUSD: number;
  totalOrderValueBDT: number;
  totalFactoryValueBDT: number;
  totalAllowanceValueBDT: number;
  overallAllowancePct: string;
  baseBdtFormatted: BDTFormatResult;
  factoryBdtFormatted: BDTFormatResult;
  allowanceBdtFormatted: BDTFormatResult;
}

/**
 * Calculates single order's factory quantity, allowance quantity, and valuations.
 */
export function calculateSingleOrderAllowance(order: OrderStyle): {
  baseOrderQty: number;
  allowanceQty: number;
  factoryQty: number;
  baseValueUSD: number;
  factoryValueUSD: number;
  allowanceValueUSD: number;
  baseValueBDT: number;
  factoryValueBDT: number;
  allowanceValueBDT: number;
  allowancePct: number;
} {
  const baseQty = Math.max(0, Number(order.totalOrderQty) || 0);
  const baseValUSD = Math.max(0, Number(order.totalOrderValue) || 0);

  let factoryQty = 0;
  let allowanceQty = 0;
  let factoryValUSD = 0;

  if (order.purchaseOrders && order.purchaseOrders.length > 0) {
    let poSumFactQty = 0;
    let poSumAllwQty = 0;
    let poSumFactVal = 0;

    for (const po of order.purchaseOrders) {
      const poBaseQty = Math.max(0, Number(po.totalPoQty) || 0);
      const unitPrice = Number(po.unitPrice) || (baseQty > 0 ? baseValUSD / baseQty : 0);
      
      let poFactQty = Number(po.factoryPoQty) || 0;
      let poAllwQty = Number(po.allowanceQty) || 0;

      if (poFactQty === 0 && po.colours && po.colours.length > 0) {
        let colFactQty = 0;
        let colAllwQty = 0;
        for (const col of po.colours) {
          if (col.factoryQty && col.factoryQty > 0) {
            colFactQty += Number(col.factoryQty);
            colAllwQty += Number(col.allowanceQty || (col.factoryQty - col.totalQty));
          } else if (col.allowancePct && col.allowancePct > 0) {
            const res = calculateSizeWiseAllowance(col.sizeQuantities || {}, col.allowancePct);
            colFactQty += res.totalFactoryQty > 0 ? res.totalFactoryQty : Math.round((col.totalQty || 0) * (1 + col.allowancePct / 100));
            colAllwQty += res.totalAllowanceQty > 0 ? res.totalAllowanceQty : Math.round((col.totalQty || 0) * (col.allowancePct / 100));
          } else {
            colFactQty += Number(col.totalQty) || 0;
          }
        }
        if (colFactQty > 0) {
          poFactQty = colFactQty;
          poAllwQty = colAllwQty;
        }
      }

      if (poFactQty === 0 && (po.allowancePct || order.allowancePct)) {
        const pct = Number(po.allowancePct || order.allowancePct) || 0;
        poAllwQty = Math.round(poBaseQty * (pct / 100));
        poFactQty = poBaseQty + poAllwQty;
      }

      if (poFactQty === 0) {
        poFactQty = poBaseQty + poAllwQty;
      }
      if (poAllwQty === 0 && poFactQty > poBaseQty) {
        poAllwQty = poFactQty - poBaseQty;
      }

      poSumFactQty += poFactQty;
      poSumAllwQty += poAllwQty;
      poSumFactVal += poFactQty * unitPrice;
    }

    if (poSumFactQty > 0) {
      factoryQty = poSumFactQty;
      allowanceQty = poSumAllwQty;
      factoryValUSD = poSumFactVal;
    }
  }

  if (factoryQty === 0) {
    if (order.factoryOrderQty && order.factoryOrderQty > 0) {
      factoryQty = Number(order.factoryOrderQty);
      allowanceQty = Math.max(0, factoryQty - baseQty);
    } else if (order.allowanceQty && order.allowanceQty > 0) {
      allowanceQty = Number(order.allowanceQty);
      factoryQty = baseQty + allowanceQty;
    } else if (order.allowancePct && order.allowancePct > 0) {
      allowanceQty = Math.round(baseQty * (Number(order.allowancePct) / 100));
      factoryQty = baseQty + allowanceQty;
    } else {
      factoryQty = baseQty;
      allowanceQty = 0;
    }

    const avgUnitPrice = baseQty > 0 ? baseValUSD / baseQty : 0;
    factoryValUSD = factoryQty * avgUnitPrice;
  }

  const allowanceValUSD = Math.max(0, factoryValUSD - baseValUSD);
  const baseValBDT = baseValUSD * USD_TO_BDT_RATE;
  const factoryValBDT = factoryValUSD * USD_TO_BDT_RATE;
  const allowanceValBDT = allowanceValUSD * USD_TO_BDT_RATE;
  const allowancePct = baseQty > 0 ? Number(((allowanceQty / baseQty) * 100).toFixed(1)) : 0;

  return {
    baseOrderQty: baseQty,
    allowanceQty,
    factoryQty,
    baseValueUSD: baseValUSD,
    factoryValueUSD: factoryValUSD,
    allowanceValueUSD: allowanceValUSD,
    baseValueBDT: baseValBDT,
    factoryValueBDT: factoryValBDT,
    allowanceValueBDT: allowanceValBDT,
    allowancePct
  };
}

/**
 * Calculates grand summary of orders including base quantities/values and allowance-inclusive quantities/values (USD & BDT).
 */
export function calculateOrdersAllowanceSummary(orders: OrderStyle[]): OrderAllowanceSummaryResult {
  let totalOrderQty = 0;
  let totalAllowanceQty = 0;
  let totalFactoryQty = 0;
  let totalOrderValueUSD = 0;
  let totalFactoryValueUSD = 0;

  for (const o of orders) {
    const single = calculateSingleOrderAllowance(o);
    totalOrderQty += single.baseOrderQty;
    totalAllowanceQty += single.allowanceQty;
    totalFactoryQty += single.factoryQty;
    totalOrderValueUSD += single.baseValueUSD;
    totalFactoryValueUSD += single.factoryValueUSD;
  }

  const totalAllowanceValueUSD = Math.max(0, totalFactoryValueUSD - totalOrderValueUSD);
  const totalOrderValueBDT = totalOrderValueUSD * USD_TO_BDT_RATE;
  const totalFactoryValueBDT = totalFactoryValueUSD * USD_TO_BDT_RATE;
  const totalAllowanceValueBDT = totalAllowanceValueUSD * USD_TO_BDT_RATE;
  const overallAllowancePct = totalOrderQty > 0 ? ((totalAllowanceQty / totalOrderQty) * 100).toFixed(1) : '0.0';

  return {
    totalOrderQty,
    totalAllowanceQty,
    totalFactoryQty,
    totalOrderValueUSD,
    totalFactoryValueUSD,
    totalAllowanceValueUSD,
    totalOrderValueBDT,
    totalFactoryValueBDT,
    totalAllowanceValueBDT,
    overallAllowancePct,
    baseBdtFormatted: formatBDT(totalOrderValueBDT),
    factoryBdtFormatted: formatBDT(totalFactoryValueBDT),
    allowanceBdtFormatted: formatBDT(totalAllowanceValueBDT)
  };
}

