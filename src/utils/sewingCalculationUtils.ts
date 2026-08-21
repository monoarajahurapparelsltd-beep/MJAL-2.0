import { InterDeptTransfer, SewingProduction, HourlySewingOutput } from '../types';

export interface SewingInputSummary {
  styleNo: string;
  poNo: string;
  colour: string;
  size: string;
  totalReceivedQty: number;
  challanCount: number;
  lastReceiveDate: string;
}

export interface SewingLineReportItem {
  lineNo: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size: string;
  inputQty: number;
  dailyTarget: number;
  totalOutput: number;
  dueQty: number;
  achievementPercent: number;
  wipQty: number;
  alterQty: number;
  rejectQty: number;
  supervisor: string;
}

/**
 * Standard Bangladesh Garments Floor Operational Schedule (15-16 hours BD Time).
 * Includes 13:00 - 14:00 (1:00 PM - 2:00 PM) Lunch & Prayer Break.
 */
export const DEFAULT_BD_HOURLY_SLOTS: (HourlySewingOutput & { isBreak?: boolean; label?: string })[] = [
  { hour: '08:00 - 09:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: '1st Hour' },
  { hour: '09:00 - 10:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: '2nd Hour' },
  { hour: '10:00 - 11:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: '3rd Hour' },
  { hour: '11:00 - 12:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: '4th Hour' },
  { hour: '12:00 - 12:59', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: '5th Hour' },
  { hour: '13:00 - 14:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, isBreak: true, label: 'Lunch Break (1-2 PM)' },
  { hour: '14:00 - 15:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: '6th Hour' },
  { hour: '15:00 - 16:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: '7th Hour' },
  { hour: '16:00 - 17:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: '8th Hour' },
  { hour: '17:00 - 18:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: 'OT Hour 1' },
  { hour: '18:00 - 19:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: 'OT Hour 2' },
  { hour: '19:00 - 20:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: 'OT Hour 3' },
  { hour: '20:00 - 21:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: 'OT Hour 4' },
  { hour: '21:00 - 22:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: 'OT Hour 5' },
  { hour: '22:00 - 23:00', target: 0, output: 0, alterQty: 0, rejectQty: 0, label: 'Night Shift / OT 6' },
];

export interface SewingSizeWiseItem {
  size: string;
  orderQty: number;
  receivedQty: number;
  doneQty: number;
  remainingQty: number;
  completionPercent: number;
}

export interface SewingStylePoGroup {
  styleNo: string;
  poNo: string;
  colour: string;
  buyer?: string;
  totalOrderQty: number;
  totalReceivedQty: number;
  totalDoneQty: number;
  totalRemainingQty: number;
  overallCompletionPercent: number;
  sizes: SewingSizeWiseItem[];
}

export function normalizeSizeName(sz: string | undefined | null): string {
  if (!sz) return 'All Sizes';
  const trimmed = sz.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'all sizes' || lower === 'all sizes (assorted)' || lower === 'all' || lower === 'assorted' || lower === 'all size') {
    return 'All Sizes';
  }
  // Strip redundant 'size' prefix if present so 'Size 30' -> '30', 'SIZE 32' -> '32'
  return trimmed.replace(/^size\s*[-_:]*\s*/i, '').trim();
}

export function isAssortedOrMultiSize(sz: string | undefined | null): boolean {
  if (!sz) return true;
  const trimmed = sz.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === 'all sizes' ||
    lower === 'all sizes (assorted)' ||
    lower === 'all' ||
    lower === 'assorted' ||
    lower === 'mixed' ||
    lower === 'all size' ||
    lower === 'all sizes(assorted)'
  ) {
    return true;
  }
  // If string contains comma, slash, plus, or ampersand separating sizes
  if (trimmed.includes(',') || trimmed.includes('/') || trimmed.includes('+') || trimmed.includes('&')) {
    return true;
  }
  return false;
}

export function extractSizesFromMultiSize(sz: string): string[] {
  if (!sz) return [];
  const clean = sz.replace(/^sizes?[\s:_]*/i, '');
  return clean
    .split(/[,/&+]/)
    .map(s => normalizeSizeName(s))
    .filter(s => s.length > 0 && s !== 'All Sizes');
}

/**
 * Splits a comma-, slash-, or ampersand-separated string into trimmed individual values.
 */
export function splitMultipleValues(val?: string | null): string[] {
  if (!val) return [];
  return val
    .split(/[,/&+]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Checks if a candidate string matches a target string directly or as part of a list.
 */
export function matchesCandidateOrList(candidate?: string | null, target?: string | null): boolean {
  if (!target || !target.trim()) return true;
  if (!candidate || !candidate.trim()) return true;
  const normTarget = target.trim().toUpperCase();
  const normCand = candidate.trim().toUpperCase();
  if (normCand === normTarget || normCand === 'ALL' || normCand === 'ALL COLOURS' || normCand === 'ALL SIZES') {
    return true;
  }
  const parts = splitMultipleValues(candidate).map(p => p.toUpperCase());
  return parts.includes(normTarget);
}

/**
 * Distributes a transfer item's quantity to the target group's received sizes map.
 */
export function distributeTransferToGroup(
  g: {
    orderSizeMap: Map<string, number>;
    receivedSizeMap: Map<string, number>;
  },
  rawSize: string | undefined | null,
  qty: number
) {
  if (qty <= 0) return;

  const isMulti = isAssortedOrMultiSize(rawSize);
  const normSz = normalizeSizeName(rawSize);

  // 1. If not clearly multi-size, check if it matches an exact single size in orderSizeMap
  if (!isMulti) {
    let directMatchKey: string | null = null;
    for (const oSz of g.orderSizeMap.keys()) {
      if (normalizeSizeName(oSz) === normSz) {
        directMatchKey = oSz;
        break;
      }
    }
    if (directMatchKey) {
      const curr = g.receivedSizeMap.get(directMatchKey) || 0;
      g.receivedSizeMap.set(directMatchKey, curr + qty);
      return;
    }
  }

  // 2. If it's multi-size (like "30, 32, 34, 36" or "All Sizes") or didn't match a single size:
  // Check if we can find specific sub-sizes inside the string
  const extractedSubSizes = isMulti ? extractSizesFromMultiSize(rawSize || '') : [];
  const targetSizes: Array<[string, number]> = [];

  if (extractedSubSizes.length > 0) {
    for (const extSz of extractedSubSizes) {
      for (const [oSz, oQty] of g.orderSizeMap.entries()) {
        if (normalizeSizeName(oSz) === extSz) {
          targetSizes.push([oSz, oQty || 0]);
          break;
        }
      }
    }
  }

  // If no specific matched sub-sizes found, use all sizes from orderSizeMap
  if (targetSizes.length === 0 && g.orderSizeMap.size > 0) {
    for (const [oSz, oQty] of g.orderSizeMap.entries()) {
      targetSizes.push([oSz, oQty || 0]);
    }
  }

  const totalTargetOrder = targetSizes.reduce((sum, [, q]) => sum + (q || 0), 0);

  if (targetSizes.length > 0 && totalTargetOrder > 0) {
    let allocated = 0;
    targetSizes.forEach(([szKey, szOrderQty], idx) => {
      let portion: number;
      if (idx === targetSizes.length - 1) {
        portion = Math.max(0, qty - allocated);
      } else {
        portion = Math.round((qty * szOrderQty) / totalTargetOrder);
        allocated += portion;
      }
      const curr = g.receivedSizeMap.get(szKey) || 0;
      g.receivedSizeMap.set(szKey, curr + portion);
    });
  } else if (targetSizes.length > 0) {
    // Equal distribution if order quantities are 0
    const perSize = Math.floor(qty / targetSizes.length);
    const rem = qty % targetSizes.length;
    targetSizes.forEach(([szKey], idx) => {
      const portion = perSize + (idx === 0 ? rem : 0);
      const curr = g.receivedSizeMap.get(szKey) || 0;
      g.receivedSizeMap.set(szKey, curr + portion);
    });
  } else {
    // Fallback if no order size exists at all
    const fallbackKey = isMulti ? 'All Sizes' : normSz;
    const curr = g.receivedSizeMap.get(fallbackKey) || 0;
    g.receivedSizeMap.set(fallbackKey, curr + qty);
  }
}

/**
 * Calculates size-wise received quantities for any department (Sewing, Washing, Finishing, QC, Packing, etc.)
 * Strictly matches incoming transfers by Buyer, Style, PO, Colour and Size.
 */
export function getDepartmentReceivedSizeMap(
  department: string,
  styleNo: string,
  poNo: string,
  colour: string,
  orderSizeMap: Record<string, number>,
  transfers: InterDeptTransfer[],
  buyer?: string
): Record<string, number> {
  const normStyle = (styleNo || '').trim().toUpperCase();
  const normPo = (poNo || '').trim().toUpperCase();
  const normCol = (colour || '').trim().toUpperCase();
  const normBuyer = (buyer || '').trim().toUpperCase();

  const group = {
    orderSizeMap: new Map<string, number>(),
    receivedSizeMap: new Map<string, number>()
  };

  Object.entries(orderSizeMap).forEach(([sz, q]) => {
    group.orderSizeMap.set(sz, Number(q) || 0);
    group.receivedSizeMap.set(sz, 0);
  });

  const totalThisColourOrder = Object.values(orderSizeMap).reduce((s, v) => s + (Number(v) || 0), 0);

  const deptTransfers = transfers.filter(t => {
    const isToDept = (t.toDepartment || '').trim().toLowerCase() === department.trim().toLowerCase();
    const isValidStatus = t.status === 'Received' || t.status === 'Dispatched' || t.status === 'In Transit' || !t.status;
    return isToDept && isValidStatus;
  });

  deptTransfers.forEach(t => {
    // 1. If transfer has individual item breakdowns, match items strictly by (Buyer, Style, PO, Colour)
    if (t.items && t.items.length > 0) {
      const relevantItems = t.items.filter(it => {
        const matchStyle = !normStyle || (it.styleNo || '').trim().toUpperCase() === normStyle;
        const matchPo = !normPo || matchesCandidateOrList(it.poNo, normPo);
        const matchCol = !normCol || matchesCandidateOrList(it.colour, normCol);
        const matchBuy = !normBuyer || !it.buyer || matchesCandidateOrList(it.buyer, normBuyer);
        return matchStyle && matchPo && matchCol && matchBuy;
      });

      if (relevantItems.length > 0) {
        relevantItems.forEach(item => {
          distributeTransferToGroup(group, item.size, Number(item.quantity) || 0);
        });
      }
      return;
    }

    // 2. If transfer does not have items array (single header transfer)
    const matchDirectStyle = (t.styleNo || '').trim().toUpperCase() === normStyle;
    const matchStyle = matchDirectStyle || matchesCandidateOrList(t.styleNo, normStyle);
    if (!matchStyle) return;

    const matchPo = !normPo || matchesCandidateOrList(t.poNo, normPo);
    if (!matchPo) return;

    const matchCol = !normCol || matchesCandidateOrList(t.colour, normCol);
    if (!matchCol) return;

    const matchBuyer = !normBuyer || !t.buyer || matchesCandidateOrList(t.buyer, normBuyer);
    if (!matchBuyer) return;

    // Check if the transfer header lists multiple colours (e.g. "Blue, Black")
    const colourList = splitMultipleValues(t.colour);
    let qtyToDistribute = Number(t.quantity) || 0;

    if (colourList.length > 1 && normCol) {
      // Transfer contains multiple colours combined.
      // Allocate the share belonging to this colour:
      if (totalThisColourOrder > 0 && qtyToDistribute >= totalThisColourOrder) {
        qtyToDistribute = totalThisColourOrder;
      } else if (colourList.length > 0) {
        qtyToDistribute = Math.round(qtyToDistribute / colourList.length);
      }
    }

    distributeTransferToGroup(group, t.size, qtyToDistribute);
  });

  const result: Record<string, number> = {};
  group.receivedSizeMap.forEach((qty, sz) => {
    result[sz] = qty;
  });
  return result;
}

/**
 * Calculates Style, PO, Colour & Size-wise Order vs Received vs Done vs Remaining Balance for Sewing.
 */
export function getSewingSizeWiseBreakdownGroup(
  orders: any[],
  transfers: InterDeptTransfer[],
  production: SewingProduction[]
): SewingStylePoGroup[] {
  // Sewing transfers (both Received and In-Transit / Dispatched from Cutting)
  const sewingTransfers = transfers.filter(
    t => t.toDepartment === 'Sewing' && (t.status === 'Received' || t.status === 'Dispatched' || t.status === 'In Transit')
  );
  
  // Collect all unique (styleNo, poNo, colour) keys
  const groupMap = new Map<string, {
    styleNo: string;
    poNo: string;
    colour: string;
    buyer?: string;
    orderSizeMap: Map<string, number>;
    receivedSizeMap: Map<string, number>;
    doneSizeMap: Map<string, number>;
  }>();

  const normalizeKey = (s: string, p: string, c: string) =>
    `${(s || '').trim().toUpperCase()}|${(p || '').trim().toUpperCase()}|${(c || '').trim().toUpperCase()}`;

  const getOrCreateGroup = (styleNo: string, poNo: string, colour: string, buyer?: string) => {
    const key = normalizeKey(styleNo, poNo, colour);
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        styleNo: styleNo.trim(),
        poNo: poNo.trim(),
        colour: colour.trim(),
        buyer,
        orderSizeMap: new Map<string, number>(),
        receivedSizeMap: new Map<string, number>(),
        doneSizeMap: new Map<string, number>()
      });
    }
    const g = groupMap.get(key)!;
    if (buyer && !g.buyer) g.buyer = buyer;
    return g;
  };

  const addToSizeMap = (map: Map<string, number>, sz: string, qty: number) => {
    const norm = normalizeSizeName(sz);
    let targetKey = norm;
    for (const k of map.keys()) {
      if (normalizeSizeName(k) === norm) {
        targetKey = k;
        break;
      }
    }
    const curr = map.get(targetKey) || 0;
    map.set(targetKey, curr + qty);
  };

  // 1. Populate from Master Orders (using Size-wise Factory Order Qty as target)
  if (Array.isArray(orders)) {
    for (const styleObj of orders) {
      const styleNo = styleObj.styleNo;
      const buyer = styleObj.buyer;
      const styleAllowancePct = Number(styleObj.allowancePct || 0);
      if (styleObj.purchaseOrders && Array.isArray(styleObj.purchaseOrders)) {
        for (const po of styleObj.purchaseOrders) {
          const poNo = po.poNo;
          const poAllowancePct = Number(po.allowancePct ?? styleAllowancePct);
          if (po.colours && Array.isArray(po.colours)) {
            for (const col of po.colours) {
              const colour = col.colour;
              const colAllowancePct = Number(col.allowancePct ?? poAllowancePct);
              const g = getOrCreateGroup(styleNo, poNo, colour, buyer);
              if (col.sizeQuantities && typeof col.sizeQuantities === 'object') {
                for (const [sz, qty] of Object.entries(col.sizeQuantities)) {
                  const normSz = normalizeSizeName(sz);
                  const realQty = Number(qty) || 0;
                  let szAllowance = 0;
                  if (col.allowanceSizeQuantities && col.allowanceSizeQuantities[sz] !== undefined) {
                    szAllowance = Number(col.allowanceSizeQuantities[sz]) || 0;
                  } else {
                    szAllowance = Math.round(realQty * (colAllowancePct / 100));
                  }
                  let factoryQty = realQty + szAllowance;
                  if (col.factorySizeQuantities && col.factorySizeQuantities[sz] !== undefined) {
                    factoryQty = Number(col.factorySizeQuantities[sz]) || factoryQty;
                  }
                  // Factory Order Qty is the primary target quantity
                  g.orderSizeMap.set(normSz, factoryQty > 0 ? factoryQty : realQty);
                }
              }
            }
          }
        }
      }
    }
  }

  // 2. Populate from Received / Dispatched Transfers into Sewing
  for (const t of sewingTransfers) {
    // If the transfer has itemized breakdown (items array), use each item
    if (t.items && t.items.length > 0) {
      for (const it of t.items) {
        if (!it.styleNo || !it.poNo || !it.colour) continue;
        const g = getOrCreateGroup(it.styleNo, it.poNo, it.colour, it.buyer || t.buyer);
        const itQty = Number(it.quantity) || 0;
        if (itQty <= 0) continue;
        distributeTransferToGroup(g, it.size, itQty);
      }
      continue;
    }

    if (!t.styleNo || !t.poNo || !t.colour) continue;
    
    // Check if the transfer header contains multiple colours
    const colours = splitMultipleValues(t.colour);
    const pos = splitMultipleValues(t.poNo);
    const tQty = Number(t.quantity) || 0;
    if (tQty <= 0) continue;

    if (colours.length > 1 || pos.length > 1) {
      // Find matching existing groups created from master orders
      const matchingGroups = Array.from(groupMap.values()).filter(g => 
        (g.styleNo || '').trim().toUpperCase() === (t.styleNo || '').trim().toUpperCase() &&
        matchesCandidateOrList(t.poNo, g.poNo) &&
        matchesCandidateOrList(t.colour, g.colour)
      );

      if (matchingGroups.length > 0) {
        matchingGroups.forEach(g => {
          const groupOrderTarget = Array.from(g.orderSizeMap.values()).reduce((a, b) => a + b, 0);
          let alloc = tQty;
          if (groupOrderTarget > 0 && alloc >= groupOrderTarget) {
            alloc = groupOrderTarget;
          } else if (matchingGroups.length > 0) {
            alloc = Math.round(tQty / matchingGroups.length);
          }
          distributeTransferToGroup(g, t.size, alloc);
        });
        continue;
      }
    }

    const g = getOrCreateGroup(t.styleNo, t.poNo, t.colour, t.buyer);
    distributeTransferToGroup(g, t.size, tQty);
  }

  // 3. Populate from Sewing Production Output
  for (const p of production) {
    if (!p.styleNo || !p.poNo || !p.colour) continue;
    const g = getOrCreateGroup(p.styleNo, p.poNo, p.colour, p.buyer);
    const normSz = normalizeSizeName(p.size);
    let matchingKey = normSz;
    for (const oSz of g.orderSizeMap.keys()) {
      if (normalizeSizeName(oSz) === normSz) {
        matchingKey = oSz;
        break;
      }
    }
    addToSizeMap(g.doneSizeMap, matchingKey, p.totalOutput || 0);
  }

  // Build final array of SewingStylePoGroup
  const result: SewingStylePoGroup[] = [];

  for (const [, g] of groupMap.entries()) {
    // Gather all unique sizes across order, received, done
    const sizeSet = new Set<string>();
    
    // Maintain order from master order first
    for (const sz of g.orderSizeMap.keys()) {
      sizeSet.add(sz);
    }

    // Only add extra sizes from received/done if they are valid individual sizes
    // (do NOT create multi-size combo cards if individual order sizes exist)
    for (const sz of g.receivedSizeMap.keys()) {
      if (g.orderSizeMap.size > 0 && (isAssortedOrMultiSize(sz) || sz === 'All Sizes')) {
        continue;
      }
      sizeSet.add(sz);
    }
    for (const sz of g.doneSizeMap.keys()) {
      if (g.orderSizeMap.size > 0 && (isAssortedOrMultiSize(sz) || sz === 'All Sizes')) {
        continue;
      }
      sizeSet.add(sz);
    }

    if (sizeSet.size === 0) {
      sizeSet.add('All Sizes');
    }

    const sizes: SewingSizeWiseItem[] = [];
    let totalOrderQty = 0;
    let totalReceivedQty = 0;
    let totalDoneQty = 0;

    for (const sz of Array.from(sizeSet)) {
      const orderQty = g.orderSizeMap.get(sz) || 0;
      const receivedQty = g.receivedSizeMap.get(sz) || 0;
      const doneQty = g.doneSizeMap.get(sz) || 0;

      const targetBasis = orderQty > 0 ? orderQty : receivedQty;
      const remainingQty = Math.max(0, targetBasis - doneQty);
      const completionPercent = targetBasis > 0 ? Math.min(100, Math.round((doneQty / targetBasis) * 100)) : 0;

      sizes.push({
        size: sz,
        orderQty,
        receivedQty,
        doneQty,
        remainingQty,
        completionPercent
      });

      totalOrderQty += orderQty;
      totalReceivedQty += receivedQty;
      totalDoneQty += doneQty;
    }

    const overallTargetBasis = totalOrderQty > 0 ? totalOrderQty : totalReceivedQty;
    const totalRemainingQty = Math.max(0, overallTargetBasis - totalDoneQty);
    const overallCompletionPercent = overallTargetBasis > 0 ? Math.min(100, Math.round((totalDoneQty / overallTargetBasis) * 100)) : 0;

    result.push({
      styleNo: g.styleNo,
      poNo: g.poNo,
      colour: g.colour,
      buyer: g.buyer,
      totalOrderQty,
      totalReceivedQty,
      totalDoneQty,
      totalRemainingQty,
      overallCompletionPercent,
      sizes
    });
  }

  return result;
}

/**
 * Calculates Style & Size-wise confirmed Sewing Input Received breakdown from inter-dept transfers.
 */
export function getSewingInputReceivedBreakdown(
  transfers: InterDeptTransfer[]
): {
  totalInputReceived: number;
  pendingInputToReceive: number;
  breakdown: SewingInputSummary[];
  receivedTransfers: InterDeptTransfer[];
  pendingTransfers: InterDeptTransfer[];
} {
  const sewingTransfers = transfers.filter(t => t.toDepartment === 'Sewing');

  const receivedTransfers = sewingTransfers.filter(t => t.status === 'Received');
  const pendingTransfers = sewingTransfers.filter(t => t.status === 'Dispatched' || t.status === 'In Transit');

  const totalInputReceived = receivedTransfers.reduce((sum, t) => sum + (t.quantity || 0), 0);
  const pendingInputToReceive = pendingTransfers.reduce((sum, t) => sum + (t.quantity || 0), 0);

  const groupMap = new Map<string, SewingInputSummary>();

  for (const t of receivedTransfers) {
    if (t.items && t.items.length > 0) {
      for (const it of t.items) {
        const styleNo = it.styleNo || t.styleNo || 'N/A';
        const poNo = it.poNo || t.poNo || 'N/A';
        const colour = it.colour || t.colour || 'N/A';
        const size = it.size || 'All Sizes';
        const key = `${styleNo}|${poNo}|${colour}|${size}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            styleNo,
            poNo,
            colour,
            size,
            totalReceivedQty: 0,
            challanCount: 0,
            lastReceiveDate: t.receiveDate || t.transferDate
          });
        }

        const item = groupMap.get(key)!;
        item.totalReceivedQty += it.quantity || 0;
        item.challanCount += 1;
        if (t.receiveDate && t.receiveDate > item.lastReceiveDate) {
          item.lastReceiveDate = t.receiveDate;
        }
      }
      continue;
    }

    const styleNo = t.styleNo || 'N/A';
    const poNo = t.poNo || 'N/A';
    const colour = t.colour || 'N/A';
    const size = t.size || 'All Sizes';
    const key = `${styleNo}|${poNo}|${colour}|${size}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        styleNo,
        poNo,
        colour,
        size,
        totalReceivedQty: 0,
        challanCount: 0,
        lastReceiveDate: t.receiveDate || t.transferDate
      });
    }

    const item = groupMap.get(key)!;
    item.totalReceivedQty += t.quantity || 0;
    item.challanCount += 1;
    if (t.receiveDate && t.receiveDate > item.lastReceiveDate) {
      item.lastReceiveDate = t.receiveDate;
    }
  }

  return {
    totalInputReceived,
    pendingInputToReceive,
    breakdown: Array.from(groupMap.values()),
    receivedTransfers,
    pendingTransfers
  };
}

/**
 * Computes line-wise production summary including Due Qty.
 */
export function getLineWiseSewingReport(
  production: SewingProduction[]
): SewingLineReportItem[] {
  return production.map(p => {
    const dueQty = Math.max(0, (p.dailyTarget || 0) - (p.totalOutput || 0));
    const achPercent = p.dailyTarget > 0 ? Math.round((p.totalOutput / p.dailyTarget) * 100) : 0;

    return {
      lineNo: p.lineNo,
      styleNo: p.styleNo,
      poNo: p.poNo,
      colour: p.colour,
      size: p.size || 'All Sizes',
      inputQty: p.inputQty || 0,
      dailyTarget: p.dailyTarget || 0,
      totalOutput: p.totalOutput || 0,
      dueQty,
      achievementPercent: achPercent,
      wipQty: p.wipQty || 0,
      alterQty: p.alterQty || 0,
      rejectQty: p.rejectQty || 0,
      supervisor: p.lineSupervisor || p.submittedBy || 'In-charge'
    };
  });
}
