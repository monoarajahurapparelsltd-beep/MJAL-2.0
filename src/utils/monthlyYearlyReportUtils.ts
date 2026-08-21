import {
  OrderStyle,
  CuttingEntry,
  SewingProduction,
  WashingRecord,
  FinishingRecord,
  PackingRecord,
  ShipmentRecord,
  InterDeptTransfer,
  Department
} from '../types';

export interface DepartmentProductionSummary {
  department: string;
  orderQty: number;
  receivedQty: number;
  producedQty: number;
  transferQty: number;
  remainingQty: number;
  pendingQty: number;
  achievementPct: number;
  remarks?: string;
}

export interface MonthlyComparisonRow {
  monthIndex: number; // 1 to 12
  monthShort: string; // Jan, Feb, etc.
  monthFull: string; // January, February, etc.
  orderQty: number;
  receivedQty: number;
  producedQty: number;
  transferQty: number;
  remainingQty: number;
  pendingQty: number;
  achievementPct: number;
  cuttingQty: number;
  sewingQty: number;
  washingQty: number;
  finishingQty: number;
  packingQty: number;
  shippedQty: number;
  status: 'Target Exceeded' | 'On Track' | 'Action Needed' | 'No Activity';
}

export interface StyleReportRow {
  styleNo: string;
  styleName: string;
  buyer: string;
  garmentType: string;
  orderQty: number;
  cutQty: number;
  sewQty: number;
  washQty: number;
  finQty: number;
  packQty: number;
  shippedQty: number;
  balanceQty: number;
  achievementPct: number;
  orderValueUSD: number;
  status: string;
}

export interface POReportRow {
  poNo: string;
  styleNo: string;
  buyer: string;
  deliveryDate: string;
  poQty: number;
  cutQty: number;
  sewQty: number;
  washQty: number;
  finQty: number;
  shippedQty: number;
  balanceQty: number;
  status: string;
}

export interface ColourReportRow {
  styleNo: string;
  poNo: string;
  colour: string;
  plannedQty: number;
  cutQty: number;
  sewQty: number;
  washQty: number;
  finQty: number;
  shippedQty: number;
  pendingQty: number;
}

export interface SizeReportRow {
  styleNo: string;
  poNo: string;
  colour: string;
  size: string;
  orderQty: number;
  cutQty: number;
  sewQty: number;
  washQty: number;
  finQty: number;
  shippedQty: number;
  balanceQty: number;
}

export interface DateWiseProductionRow {
  date: string;
  dayOfWeek: string;
  dayNumber: number;
  cuttingQty: number;
  sewingQty: number;
  washingQty: number;
  finishingQty: number;
  packingQty: number;
  shippedQty: number;
  totalOutput: number;
  remarks: string;
}

export const MONTH_NAMES = [
  { index: 1, short: 'Jan', full: 'January' },
  { index: 2, short: 'Feb', full: 'February' },
  { index: 3, short: 'Mar', full: 'March' },
  { index: 4, short: 'Apr', full: 'April' },
  { index: 5, short: 'May', full: 'May' },
  { index: 6, short: 'Jun', full: 'June' },
  { index: 7, short: 'Jul', full: 'July' },
  { index: 8, short: 'Aug', full: 'August' },
  { index: 9, short: 'Sep', full: 'September' },
  { index: 10, short: 'Oct', full: 'October' },
  { index: 11, short: 'Nov', full: 'November' },
  { index: 12, short: 'Dec', full: 'December' },
];

/**
 * Checks if a date string matches the target year and month filter
 */
export function isDateInPeriod(
  dateStr: string | undefined | null,
  year: number,
  month: number | 'all'
): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const clean = dateStr.trim();
  if (clean.length < 4) return false;

  const itemYear = parseInt(clean.substring(0, 4), 10);
  if (isNaN(itemYear) || itemYear !== year) return false;

  if (month === 'all') return true;

  if (clean.length >= 7) {
    const itemMonth = parseInt(clean.substring(5, 7), 10);
    return itemMonth === month;
  }
  return true;
}

/**
 * Checks whether an order is active / created / delivered in the target period
 */
export function isOrderInPeriod(
  order: OrderStyle,
  year: number,
  month: number | 'all'
): boolean {
  if (isDateInPeriod(order.createdAt, year, month)) return true;
  if (isDateInPeriod(order.updatedAt, year, month)) return true;
  
  if (order.purchaseOrders && order.purchaseOrders.length > 0) {
    return order.purchaseOrders.some(
      po =>
        isDateInPeriod(po.poDate, year, month) ||
        isDateInPeriod(po.deliveryDate, year, month) ||
        isDateInPeriod(po.shipmentDate, year, month)
    );
  }
  return true;
}

/**
 * Calculates Department Production Summary for the selected Year and Month
 */
export function calculateDepartmentSummaries(params: {
  year: number;
  month: number | 'all';
  orders: OrderStyle[];
  cuttingEntries: CuttingEntry[];
  sewingProduction: SewingProduction[];
  washingRecords: WashingRecord[];
  finishingRecords: FinishingRecord[];
  packingRecords: PackingRecord[];
  shipmentRecords: ShipmentRecord[];
  transfers: InterDeptTransfer[];
}): DepartmentProductionSummary[] {
  const {
    year,
    month,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    packingRecords,
    shipmentRecords,
    transfers
  } = params;

  // Filter raw datasets to current period
  const periodCuts = cuttingEntries.filter(c => isDateInPeriod(c.date, year, month));
  const periodSewing = sewingProduction.filter(s => isDateInPeriod(s.date, year, month));
  const periodWash = washingRecords.filter(w => isDateInPeriod(w.date, year, month));
  const periodFin = finishingRecords.filter(f => isDateInPeriod(f.date, year, month));
  const periodPack = packingRecords.filter(p => isDateInPeriod(p.date, year, month));
  const periodShipments = shipmentRecords.filter(s => isDateInPeriod(s.shipmentDate || (s as any).date, year, month));
  const periodTransfers = transfers.filter(t => isDateInPeriod(t.transferDate || t.createdAt, year, month));

  // 1. CUTTING SUMMARY
  const cutOrderQty = periodCuts.reduce((s, c) => s + (c.orderQty || 0), 0) ||
    orders.reduce((s, o) => s + (o.totalOrderQty || 0), 0);
  const cutProduced = periodCuts.reduce((s, c) => s + (c.cutQty || 0), 0);
  const cutReceived = periodCuts.reduce((s, c) => s + (c.fabricAllocatedYds || 0), 0);
  const cutTransferred = periodTransfers
    .filter(t => t.fromDepartment === 'Cutting' && t.toDepartment === 'Sewing')
    .reduce((s, t) => s + (t.quantity || 0), 0);
  const cutRemaining = Math.max(0, cutOrderQty - cutProduced);
  const cutPending = Math.max(0, cutProduced - cutTransferred);
  const cutAchPct = cutOrderQty > 0 ? Math.round((cutProduced / cutOrderQty) * 100) : 100;

  // 2. SEWING SUMMARY
  const sewReceived = cutTransferred > 0 ? cutTransferred : periodSewing.reduce((s, x) => s + (x.inputQty || 0), 0);
  const sewProduced = periodSewing.reduce((s, x) => s + (x.totalOutput || 0), 0);
  const sewTarget = periodSewing.reduce((s, x) => s + (x.dailyTarget || 0), 0);
  const sewOrderQty = sewTarget > 0 ? sewTarget : cutOrderQty;
  const sewTransferred = periodTransfers
    .filter(t => t.fromDepartment === 'Sewing' && (t.toDepartment === 'Washing' || t.toDepartment === 'Finishing'))
    .reduce((s, t) => s + (t.quantity || 0), 0);
  const sewRemaining = Math.max(0, (sewReceived || cutProduced) - sewProduced);
  const sewPending = Math.max(0, sewProduced - sewTransferred);
  const sewAchPct = sewTarget > 0
    ? Math.round((sewProduced / sewTarget) * 100)
    : (sewReceived > 0 ? Math.round((sewProduced / sewReceived) * 100) : 0);

  // 3. WASHING UNIT (Internal Factory Wash)
  const internalWashRecords = periodWash.filter(w => !w.vendorName || w.vendorName.toLowerCase().includes('factory') || w.vendorName.toLowerCase().includes('in-house') || w.vendorName.toLowerCase().includes('internal'));
  const intWashReceived = internalWashRecords.reduce((s, w) => s + (w.sentQty || 0), 0) ||
    periodTransfers
      .filter(t => t.toDepartment === 'Washing' && !t.vendorName)
      .reduce((s, t) => s + (t.quantity || 0), 0);
  const intWashProduced = internalWashRecords.reduce((s, w) => s + (w.receivedQty || 0), 0);
  const intWashTransferred = periodTransfers
    .filter(t => t.fromDepartment === 'Washing' && t.toDepartment === 'Finishing')
    .reduce((s, t) => s + (t.quantity || 0), 0);
  const intWashRemaining = Math.max(0, intWashReceived - intWashProduced);
  const intWashPending = Math.max(0, intWashProduced - intWashTransferred);
  const intWashAchPct = intWashReceived > 0 ? Math.round((intWashProduced / intWashReceived) * 100) : 100;

  // 4. THIRD PARTY WASHING (Outsourced Washing Plants)
  const thirdPartyWashRecords = periodWash.filter(w => w.vendorName && !w.vendorName.toLowerCase().includes('factory') && !w.vendorName.toLowerCase().includes('in-house') && !w.vendorName.toLowerCase().includes('internal'));
  const tpWashSent = thirdPartyWashRecords.reduce((s, w) => s + (w.sentQty || 0), 0) ||
    periodTransfers.filter(t => Boolean(t.vendorName)).reduce((s, t) => s + (t.quantity || 0), 0);
  const tpWashReceivedBack = thirdPartyWashRecords.reduce((s, w) => s + (w.receivedQty || 0), 0);
  const tpWashDamageReject = thirdPartyWashRecords.reduce((s, w) => s + ((w.damageQty || 0) + (w.rejectQty || 0)), 0);
  const tpWashRemainingAtVendor = Math.max(0, tpWashSent - tpWashReceivedBack - tpWashDamageReject);
  const tpWashPending = tpWashRemainingAtVendor;
  const tpWashAchPct = tpWashSent > 0 ? Math.round((tpWashReceivedBack / tpWashSent) * 100) : 100;

  // 5. FINISHING UNIT
  const finReceived = periodFin.reduce((s, f) => s + (f.finishingInputQty || f.sewingReceiveQty || 0), 0) ||
    periodTransfers.filter(t => t.toDepartment === 'Finishing').reduce((s, t) => s + (t.quantity || 0), 0);
  const finProduced = periodFin.reduce((s, f) => s + (f.finishedQty || f.ironedQty || f.packedQty || 0), 0);
  const finTransferred = periodFin.reduce((s, f) => s + (f.readyForShipmentQty || 0), 0) ||
    periodTransfers.filter(t => t.fromDepartment === 'Finishing' && (t.toDepartment === 'Packing' || t.toDepartment === 'Shipment')).reduce((s, t) => s + (t.quantity || 0), 0);
  const finRemaining = Math.max(0, (finReceived || sewProduced) - finProduced);
  const finPending = Math.max(0, finProduced - finTransferred);
  const finAchPct = finReceived > 0 ? Math.round((finProduced / finReceived) * 100) : 100;

  // 6. PACKING FLOOR
  const packReceived = finProduced > 0 ? finProduced : periodPack.reduce((s, p) => s + (p.orderQty || 0), 0);
  const packProduced = periodPack.reduce((s, p) => s + (p.packedQty || 0), 0) || periodFin.reduce((s, f) => s + (f.packedQty || 0), 0);
  const packCartons = periodPack.reduce((s, p) => s + (p.cartonCount || 0), 0);
  const packTransferred = periodTransfers.filter(t => t.fromDepartment === 'Packing' || t.toDepartment === 'Shipment').reduce((s, t) => s + (t.quantity || 0), 0) || packProduced;
  const packRemaining = Math.max(0, packReceived - packProduced);
  const packPending = Math.max(0, packProduced - periodShipments.reduce((s, sh) => s + (sh.shippedQty || 0), 0));
  const packAchPct = packReceived > 0 ? Math.round((packProduced / packReceived) * 100) : 100;

  // 7. COMMERCIAL SHIPMENT
  const shipOrderQty = cutOrderQty;
  const shipProduced = periodShipments.reduce((s, sh) => s + (sh.shippedQty || 0), 0);
  const shipReadyQty = periodFin.reduce((s, f) => s + (f.readyForShipmentQty || 0), 0) || packProduced;
  const shipTransferred = shipProduced;
  const shipRemaining = Math.max(0, shipOrderQty - shipProduced);
  const shipPending = Math.max(0, shipReadyQty - shipProduced);
  const shipAchPct = shipOrderQty > 0 ? Math.round((shipProduced / shipOrderQty) * 100) : 100;

  return [
    {
      department: 'Cutting',
      orderQty: cutOrderQty,
      receivedQty: cutReceived,
      producedQty: cutProduced,
      transferQty: cutTransferred,
      remainingQty: cutRemaining,
      pendingQty: cutPending,
      achievementPct: cutAchPct,
      remarks: 'Fabric Lay & Pattern Cutting'
    },
    {
      department: 'Sewing',
      orderQty: sewOrderQty,
      receivedQty: sewReceived,
      producedQty: sewProduced,
      transferQty: sewTransferred,
      remainingQty: sewRemaining,
      pendingQty: sewPending,
      achievementPct: sewAchPct,
      remarks: 'Line Assembly & Stitching Output'
    },
    {
      department: 'Washing',
      orderQty: sewProduced,
      receivedQty: intWashReceived,
      producedQty: intWashProduced,
      transferQty: intWashTransferred,
      remainingQty: intWashRemaining,
      pendingQty: intWashPending,
      achievementPct: intWashAchPct,
      remarks: 'In-House Wet & Dry Processing'
    },
    {
      department: 'Third Party Washing',
      orderQty: tpWashSent,
      receivedQty: tpWashSent,
      producedQty: tpWashReceivedBack,
      transferQty: tpWashReceivedBack,
      remainingQty: tpWashRemainingAtVendor,
      pendingQty: tpWashPending,
      achievementPct: tpWashAchPct,
      remarks: 'Outsourced Plant Challan Follow-up'
    },
    {
      department: 'Finishing',
      orderQty: sewProduced,
      receivedQty: finReceived,
      producedQty: finProduced,
      transferQty: finTransferred,
      remainingQty: finRemaining,
      pendingQty: finPending,
      achievementPct: finAchPct,
      remarks: 'Ironing, Thread Trim & Poly Pack'
    },
    {
      department: 'Packing',
      orderQty: finProduced,
      receivedQty: packReceived,
      producedQty: packProduced,
      transferQty: packTransferred,
      remainingQty: packRemaining,
      pendingQty: packPending,
      achievementPct: packAchPct,
      remarks: `${packCartons.toLocaleString()} Master Cartons Packed`
    },
    {
      department: 'Shipment',
      orderQty: shipOrderQty,
      receivedQty: shipReadyQty,
      producedQty: shipProduced,
      transferQty: shipTransferred,
      remainingQty: shipRemaining,
      pendingQty: shipPending,
      achievementPct: shipAchPct,
      remarks: 'Commercial Export Consignments'
    }
  ];
}

/**
 * Calculates 12-Month Comparison Grid for the entire year
 */
export function calculateYearlyComparison(params: {
  year: number;
  orders: OrderStyle[];
  cuttingEntries: CuttingEntry[];
  sewingProduction: SewingProduction[];
  washingRecords: WashingRecord[];
  finishingRecords: FinishingRecord[];
  packingRecords: PackingRecord[];
  shipmentRecords: ShipmentRecord[];
  transfers: InterDeptTransfer[];
}): MonthlyComparisonRow[] {
  const {
    year,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    packingRecords,
    shipmentRecords,
    transfers
  } = params;

  return MONTH_NAMES.map(m => {
    const monthIdx = m.index;

    const mCuts = cuttingEntries.filter(c => isDateInPeriod(c.date, year, monthIdx));
    const mSewing = sewingProduction.filter(s => isDateInPeriod(s.date, year, monthIdx));
    const mWash = washingRecords.filter(w => isDateInPeriod(w.date, year, monthIdx));
    const mFin = finishingRecords.filter(f => isDateInPeriod(f.date, year, monthIdx));
    const mPack = packingRecords.filter(p => isDateInPeriod(p.date, year, monthIdx));
    const mShip = shipmentRecords.filter(s => isDateInPeriod(s.shipmentDate || (s as any).date, year, monthIdx));
    const mTransfers = transfers.filter(t => isDateInPeriod(t.transferDate || t.createdAt, year, monthIdx));

    const cutQty = mCuts.reduce((s, c) => s + (c.cutQty || 0), 0);
    const sewQty = mSewing.reduce((s, x) => s + (x.totalOutput || 0), 0);
    const washQty = mWash.reduce((s, w) => s + (w.receivedQty || 0), 0);
    const finQty = mFin.reduce((s, f) => s + (f.finishedQty || 0), 0);
    const packQty = mPack.reduce((s, p) => s + (p.packedQty || 0), 0);
    const shipQty = mShip.reduce((s, sh) => s + (sh.shippedQty || 0), 0);

    // Primary Production Metric for the Month: Main Sewing Output + Cutting + Finishing
    const totalProduced = sewQty > 0 ? sewQty : (cutQty > 0 ? cutQty : finQty);
    
    // Order planned in this month
    const mOrders = orders.filter(o => isOrderInPeriod(o, year, monthIdx));
    const orderQty = mOrders.reduce((s, o) => s + (o.totalOrderQty || 0), 0) ||
      mCuts.reduce((s, c) => s + (c.orderQty || 0), 0) ||
      mSewing.reduce((s, x) => s + (x.dailyTarget || 0), 0);

    // Received into sewing/floors
    const receivedQty = mTransfers.reduce((s, t) => s + (t.quantity || 0), 0) || cutQty;
    const transferQty = mTransfers.reduce((s, t) => s + (t.quantity || 0), 0) || shipQty;

    const remainingQty = Math.max(0, orderQty - totalProduced);
    const pendingQty = Math.max(0, totalProduced - shipQty);
    const achievementPct = orderQty > 0 ? Math.round((totalProduced / orderQty) * 100) : (totalProduced > 0 ? 100 : 0);

    let status: 'Target Exceeded' | 'On Track' | 'Action Needed' | 'No Activity' = 'No Activity';
    if (totalProduced > 0 || orderQty > 0) {
      if (achievementPct >= 100) status = 'Target Exceeded';
      else if (achievementPct >= 80) status = 'On Track';
      else status = 'Action Needed';
    }

    return {
      monthIndex: monthIdx,
      monthShort: m.short,
      monthFull: m.full,
      orderQty,
      receivedQty,
      producedQty: totalProduced,
      transferQty,
      remainingQty,
      pendingQty,
      achievementPct,
      cuttingQty: cutQty,
      sewingQty: sewQty,
      washingQty: washQty,
      finishingQty: finQty,
      packingQty: packQty,
      shippedQty: shipQty,
      status
    };
  });
}

/**
 * Calculates Style-wise breakdown for the selected period & department
 */
export function calculateStyleReport(params: {
  year: number;
  month: number | 'all';
  department: string;
  orders: OrderStyle[];
  cuttingEntries: CuttingEntry[];
  sewingProduction: SewingProduction[];
  washingRecords: WashingRecord[];
  finishingRecords: FinishingRecord[];
  packingRecords: PackingRecord[];
  shipmentRecords: ShipmentRecord[];
}): StyleReportRow[] {
  const {
    year,
    month,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    packingRecords,
    shipmentRecords
  } = params;

  // Collect all active styles
  const styleMap = new Map<string, StyleReportRow>();

  // 1. Initialize from Orders
  orders.forEach(order => {
    const sNo = (order.styleNo || '').trim();
    if (!sNo) return;
    styleMap.set(sNo.toUpperCase(), {
      styleNo: sNo,
      styleName: order.styleName || 'Apparel Item',
      buyer: order.buyer || 'Direct Client',
      garmentType: order.garmentType || 'Garment',
      orderQty: order.totalOrderQty || 0,
      cutQty: 0,
      sewQty: 0,
      washQty: 0,
      finQty: 0,
      packQty: 0,
      shippedQty: 0,
      balanceQty: order.totalOrderQty || 0,
      achievementPct: 0,
      orderValueUSD: order.totalOrderValue || 0,
      status: order.status || 'Running'
    });
  });

  // 2. Accumulate Cutting
  cuttingEntries.filter(c => isDateInPeriod(c.date, year, month)).forEach(c => {
    const key = (c.styleNo || '').trim().toUpperCase();
    if (!key) return;
    const existing = styleMap.get(key) || {
      styleNo: c.styleNo,
      styleName: 'Style Item',
      buyer: 'MJAL Buyer',
      garmentType: 'Garment',
      orderQty: c.orderQty || 0,
      cutQty: 0,
      sewQty: 0,
      washQty: 0,
      finQty: 0,
      packQty: 0,
      shippedQty: 0,
      balanceQty: c.orderQty || 0,
      achievementPct: 0,
      orderValueUSD: 0,
      status: 'Running'
    };
    existing.cutQty += Number(c.cutQty || 0);
    if (!existing.orderQty && c.orderQty) existing.orderQty = c.orderQty;
    styleMap.set(key, existing);
  });

  // 3. Accumulate Sewing
  sewingProduction.filter(s => isDateInPeriod(s.date, year, month)).forEach(s => {
    const key = (s.styleNo || '').trim().toUpperCase();
    if (!key) return;
    const existing = styleMap.get(key);
    if (existing) {
      existing.sewQty += Number(s.totalOutput || 0);
      if (s.buyer && existing.buyer === 'MJAL Buyer') existing.buyer = s.buyer;
    }
  });

  // 4. Accumulate Washing
  washingRecords.filter(w => isDateInPeriod(w.date, year, month)).forEach(w => {
    const key = (w.styleNo || '').trim().toUpperCase();
    if (!key) return;
    const existing = styleMap.get(key);
    if (existing) {
      existing.washQty += Number(w.receivedQty || 0);
    }
  });

  // 5. Accumulate Finishing
  finishingRecords.filter(f => isDateInPeriod(f.date, year, month)).forEach(f => {
    const key = (f.styleNo || '').trim().toUpperCase();
    if (!key) return;
    const existing = styleMap.get(key);
    if (existing) {
      existing.finQty += Number(f.finishedQty || 0);
    }
  });

  // 6. Accumulate Packing
  packingRecords.filter(p => isDateInPeriod(p.date, year, month)).forEach(p => {
    const key = (p.styleNo || '').trim().toUpperCase();
    if (!key) return;
    const existing = styleMap.get(key);
    if (existing) {
      existing.packQty += Number(p.packedQty || 0);
    }
  });

  // 7. Accumulate Shipment
  shipmentRecords.filter(s => isDateInPeriod(s.shipmentDate || (s as any).date, year, month)).forEach(s => {
    const key = (s.styleNo || '').trim().toUpperCase();
    if (!key) return;
    const existing = styleMap.get(key);
    if (existing) {
      existing.shippedQty += Number(s.shippedQty || 0);
    }
  });

  // Calculate final balances and achievement
  const results: StyleReportRow[] = [];
  styleMap.forEach(row => {
    const maxFloor = Math.max(row.cutQty, row.sewQty, row.finQty, row.packQty, row.shippedQty);
    if (row.orderQty === 0 && maxFloor === 0) return; // Skip inactive

    row.balanceQty = Math.max(0, row.orderQty - row.shippedQty);
    const benchmark = row.orderQty > 0 ? row.orderQty : maxFloor;
    row.achievementPct = benchmark > 0 ? Math.min(100, Math.round((row.sewQty || row.cutQty || row.finQty) / benchmark * 100)) : 100;
    
    if (row.shippedQty >= row.orderQty && row.orderQty > 0) {
      row.status = 'Shipment Complete';
    } else if (row.shippedQty > 0) {
      row.status = 'Partial Shipment';
    } else if (row.finQty >= row.orderQty && row.orderQty > 0) {
      row.status = 'Ready for Shipment';
    } else if (row.sewQty > 0 || row.cutQty > 0) {
      row.status = 'Running';
    }

    results.push(row);
  });

  return results.sort((a, b) => b.orderQty - a.orderQty);
}

/**
 * Calculates PO-wise breakdown for the selected period
 */
export function calculatePOReport(params: {
  year: number;
  month: number | 'all';
  orders: OrderStyle[];
  cuttingEntries: CuttingEntry[];
  sewingProduction: SewingProduction[];
  washingRecords: WashingRecord[];
  finishingRecords: FinishingRecord[];
  shipmentRecords: ShipmentRecord[];
}): POReportRow[] {
  const {
    year,
    month,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    shipmentRecords
  } = params;

  const poMap = new Map<string, POReportRow>();

  // From Orders
  orders.forEach(o => {
    (o.purchaseOrders || []).forEach(po => {
      const key = `${(po.poNo || 'MAIN').toUpperCase()}___${(o.styleNo || '').toUpperCase()}`;
      poMap.set(key, {
        poNo: po.poNo || 'PO-MAIN',
        styleNo: o.styleNo,
        buyer: o.buyer || 'Client',
        deliveryDate: po.deliveryDate || po.shipmentDate || '2026-10-30',
        poQty: po.totalPoQty || 0,
        cutQty: 0,
        sewQty: 0,
        washQty: 0,
        finQty: 0,
        shippedQty: 0,
        balanceQty: po.totalPoQty || 0,
        status: po.status || 'Running'
      });
    });
  });

  // Cutting
  cuttingEntries.filter(c => isDateInPeriod(c.date, year, month)).forEach(c => {
    const key = `${(c.poNo || 'MAIN').toUpperCase()}___${(c.styleNo || '').toUpperCase()}`;
    const row = poMap.get(key) || {
      poNo: c.poNo || 'PO-MAIN',
      styleNo: c.styleNo,
      buyer: 'MJAL Buyer',
      deliveryDate: '2026-10-30',
      poQty: c.orderQty || 0,
      cutQty: 0,
      sewQty: 0,
      washQty: 0,
      finQty: 0,
      shippedQty: 0,
      balanceQty: c.orderQty || 0,
      status: 'Running'
    };
    row.cutQty += Number(c.cutQty || 0);
    poMap.set(key, row);
  });

  // Sewing
  sewingProduction.filter(s => isDateInPeriod(s.date, year, month)).forEach(s => {
    const key = `${(s.poNo || 'MAIN').toUpperCase()}___${(s.styleNo || '').toUpperCase()}`;
    const row = poMap.get(key);
    if (row) row.sewQty += Number(s.totalOutput || 0);
  });

  // Washing
  washingRecords.filter(w => isDateInPeriod(w.date, year, month)).forEach(w => {
    const key = `${(w.poNo || 'MAIN').toUpperCase()}___${(w.styleNo || '').toUpperCase()}`;
    const row = poMap.get(key);
    if (row) row.washQty += Number(w.receivedQty || 0);
  });

  // Finishing
  finishingRecords.filter(f => isDateInPeriod(f.date, year, month)).forEach(f => {
    const key = `${(f.poNo || 'MAIN').toUpperCase()}___${(f.styleNo || '').toUpperCase()}`;
    const row = poMap.get(key);
    if (row) row.finQty += Number(f.finishedQty || 0);
  });

  // Shipment
  shipmentRecords.filter(s => isDateInPeriod(s.shipmentDate || (s as any).date, year, month)).forEach(s => {
    const key = `${(s.poNo || 'MAIN').toUpperCase()}___${(s.styleNo || '').toUpperCase()}`;
    const row = poMap.get(key);
    if (row) row.shippedQty += Number(s.shippedQty || 0);
  });

  const list = Array.from(poMap.values()).map(r => {
    r.balanceQty = Math.max(0, r.poQty - r.shippedQty);
    if (r.poQty > 0 && r.shippedQty >= r.poQty) {
      r.status = 'Shipment Complete';
    }
    return r;
  });

  return list.filter(r => r.poQty > 0 || r.cutQty > 0 || r.sewQty > 0);
}

/**
 * Calculates Colour-wise breakdown for the selected period
 */
export function calculateColourReport(params: {
  year: number;
  month: number | 'all';
  orders: OrderStyle[];
  cuttingEntries: CuttingEntry[];
  sewingProduction: SewingProduction[];
  washingRecords: WashingRecord[];
  finishingRecords: FinishingRecord[];
  shipmentRecords: ShipmentRecord[];
}): ColourReportRow[] {
  const {
    year,
    month,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    shipmentRecords
  } = params;

  const colourMap = new Map<string, ColourReportRow>();

  // From Orders
  orders.forEach(o => {
    (o.purchaseOrders || []).forEach(po => {
      (po.colours || []).forEach(col => {
        const key = `${(o.styleNo || '').toUpperCase()}___${(po.poNo || '').toUpperCase()}___${(col.colour || '').toUpperCase()}`;
        colourMap.set(key, {
          styleNo: o.styleNo,
          poNo: po.poNo,
          colour: col.colour,
          plannedQty: col.totalQty || 0,
          cutQty: 0,
          sewQty: 0,
          washQty: 0,
          finQty: 0,
          shippedQty: 0,
          pendingQty: col.totalQty || 0
        });
      });
    });
  });

  // From Floor entries
  cuttingEntries.filter(c => isDateInPeriod(c.date, year, month)).forEach(c => {
    const key = `${(c.styleNo || '').toUpperCase()}___${(c.poNo || '').toUpperCase()}___${(c.colour || '').toUpperCase()}`;
    const row = colourMap.get(key) || {
      styleNo: c.styleNo,
      poNo: c.poNo,
      colour: c.colour,
      plannedQty: c.orderQty || 0,
      cutQty: 0,
      sewQty: 0,
      washQty: 0,
      finQty: 0,
      shippedQty: 0,
      pendingQty: c.orderQty || 0
    };
    row.cutQty += Number(c.cutQty || 0);
    colourMap.set(key, row);
  });

  sewingProduction.filter(s => isDateInPeriod(s.date, year, month)).forEach(s => {
    const key = `${(s.styleNo || '').toUpperCase()}___${(s.poNo || '').toUpperCase()}___${(s.colour || '').toUpperCase()}`;
    const row = colourMap.get(key);
    if (row) row.sewQty += Number(s.totalOutput || 0);
  });

  washingRecords.filter(w => isDateInPeriod(w.date, year, month)).forEach(w => {
    const key = `${(w.styleNo || '').toUpperCase()}___${(w.poNo || '').toUpperCase()}___${(w.colour || '').toUpperCase()}`;
    const row = colourMap.get(key);
    if (row) row.washQty += Number(w.receivedQty || 0);
  });

  finishingRecords.filter(f => isDateInPeriod(f.date, year, month)).forEach(f => {
    const key = `${(f.styleNo || '').toUpperCase()}___${(f.poNo || '').toUpperCase()}___${(f.colour || '').toUpperCase()}`;
    const row = colourMap.get(key);
    if (row) row.finQty += Number(f.finishedQty || 0);
  });

  shipmentRecords.filter(s => isDateInPeriod(s.shipmentDate || (s as any).date, year, month)).forEach(s => {
    const key = `${(s.styleNo || '').toUpperCase()}___${(s.poNo || '').toUpperCase()}___${(s.colour || '').toUpperCase()}`;
    const row = colourMap.get(key);
    if (row) row.shippedQty += Number(s.shippedQty || 0);
  });

  return Array.from(colourMap.values()).map(r => {
    r.pendingQty = Math.max(0, r.plannedQty - r.shippedQty);
    return r;
  }).filter(r => r.plannedQty > 0 || r.cutQty > 0 || r.sewQty > 0);
}

/**
 * Calculates Size-wise breakdown for the selected period
 */
export function calculateSizeReport(params: {
  year: number;
  month: number | 'all';
  orders: OrderStyle[];
  cuttingEntries: CuttingEntry[];
  sewingProduction: SewingProduction[];
  washingRecords: WashingRecord[];
  finishingRecords: FinishingRecord[];
  shipmentRecords: ShipmentRecord[];
}): SizeReportRow[] {
  const {
    year,
    month,
    orders,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    shipmentRecords
  } = params;

  const sizeMap = new Map<string, SizeReportRow>();

  // Orders
  orders.forEach(o => {
    (o.purchaseOrders || []).forEach(po => {
      (po.colours || []).forEach(col => {
        Object.entries(col.sizeQuantities || {}).forEach(([sz, q]) => {
          if (!sz) return;
          const key = `${(o.styleNo || '').toUpperCase()}___${(po.poNo || '').toUpperCase()}___${(col.colour || '').toUpperCase()}___${sz.toUpperCase()}`;
          sizeMap.set(key, {
            styleNo: o.styleNo,
            poNo: po.poNo,
            colour: col.colour,
            size: sz,
            orderQty: Number(q || 0),
            cutQty: 0,
            sewQty: 0,
            washQty: 0,
            finQty: 0,
            shippedQty: 0,
            balanceQty: Number(q || 0)
          });
        });
      });
    });
  });

  // Cutting Entries
  cuttingEntries.filter(c => isDateInPeriod(c.date, year, month)).forEach(c => {
    const sz = c.size || 'All Sizes';
    const key = `${(c.styleNo || '').toUpperCase()}___${(c.poNo || '').toUpperCase()}___${(c.colour || '').toUpperCase()}___${sz.toUpperCase()}`;
    const row = sizeMap.get(key) || {
      styleNo: c.styleNo,
      poNo: c.poNo,
      colour: c.colour,
      size: sz,
      orderQty: c.orderQty || 0,
      cutQty: 0,
      sewQty: 0,
      washQty: 0,
      finQty: 0,
      shippedQty: 0,
      balanceQty: c.orderQty || 0
    };
    row.cutQty += Number(c.cutQty || 0);
    sizeMap.set(key, row);
  });

  // Sewing
  sewingProduction.filter(s => isDateInPeriod(s.date, year, month)).forEach(s => {
    const sz = s.size || 'All Sizes';
    const key = `${(s.styleNo || '').toUpperCase()}___${(s.poNo || '').toUpperCase()}___${(s.colour || '').toUpperCase()}___${sz.toUpperCase()}`;
    const row = sizeMap.get(key);
    if (row) row.sewQty += Number(s.totalOutput || 0);
  });

  // Finishing
  finishingRecords.filter(f => isDateInPeriod(f.date, year, month)).forEach(f => {
    const sz = f.size || 'All Sizes';
    const key = `${(f.styleNo || '').toUpperCase()}___${(f.poNo || '').toUpperCase()}___${(f.colour || '').toUpperCase()}___${sz.toUpperCase()}`;
    const row = sizeMap.get(key);
    if (row) row.finQty += Number(f.finishedQty || 0);
  });

  return Array.from(sizeMap.values()).map(r => {
    r.balanceQty = Math.max(0, r.orderQty - r.shippedQty);
    return r;
  }).filter(r => r.orderQty > 0 || r.cutQty > 0 || r.sewQty > 0);
}

/**
 * Calculates Date-wise daily production calendar rows for the selected month and year
 */
export function calculateDateWiseReport(params: {
  year: number;
  month: number | 'all';
  cuttingEntries: CuttingEntry[];
  sewingProduction: SewingProduction[];
  washingRecords: WashingRecord[];
  finishingRecords: FinishingRecord[];
  packingRecords: PackingRecord[];
  shipmentRecords: ShipmentRecord[];
}): DateWiseProductionRow[] {
  const {
    year,
    month,
    cuttingEntries,
    sewingProduction,
    washingRecords,
    finishingRecords,
    packingRecords,
    shipmentRecords
  } = params;

  const targetMonth = month === 'all' ? 8 : month; // Default to August or selected month
  const daysInMonth = new Date(year, targetMonth, 0).getDate();
  const rows: DateWiseProductionRow[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dayPad = day < 10 ? `0${day}` : `${day}`;
    const monthPad = targetMonth < 10 ? `0${targetMonth}` : `${targetMonth}`;
    const dateStr = `${year}-${monthPad}-${dayPad}`;

    const dateObj = new Date(year, targetMonth - 1, day);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    const dayCuts = cuttingEntries.filter(c => c.date === dateStr);
    const daySew = sewingProduction.filter(s => s.date === dateStr);
    const dayWash = washingRecords.filter(w => w.date === dateStr);
    const dayFin = finishingRecords.filter(f => f.date === dateStr);
    const dayPack = packingRecords.filter(p => p.date === dateStr);
    const dayShip = shipmentRecords.filter(s => (s.shipmentDate === dateStr || (s as any).date === dateStr));

    const cutQty = dayCuts.reduce((s, c) => s + (c.cutQty || 0), 0);
    const sewQty = daySew.reduce((s, x) => s + (x.totalOutput || 0), 0);
    const washQty = dayWash.reduce((s, w) => s + (w.receivedQty || 0), 0);
    const finQty = dayFin.reduce((s, f) => s + (f.finishedQty || 0), 0);
    const packQty = dayPack.reduce((s, p) => s + (p.packedQty || 0), 0);
    const shipQty = dayShip.reduce((s, sh) => s + (sh.shippedQty || 0), 0);

    const totalOutput = cutQty + sewQty + washQty + finQty + packQty;

    let remarks = '';
    if (shipQty > 0) remarks = `Dispatched ${shipQty.toLocaleString()} pcs for Export`;
    else if (sewQty > 1000) remarks = `High output on lines (${sewQty.toLocaleString()} pcs)`;
    else if (cutQty > 1000) remarks = `Bulk cutting completed (${cutQty.toLocaleString()} pcs)`;
    else if (dayOfWeek === 'Fri') remarks = 'Weekly Holiday / Maintenance';

    rows.push({
      date: dateStr,
      dayOfWeek,
      dayNumber: day,
      cuttingQty: cutQty,
      sewingQty: sewQty,
      washingQty: washQty,
      finishingQty: finQty,
      packingQty: packQty,
      shippedQty: shipQty,
      totalOutput,
      remarks
    });
  }

  return rows;
}
