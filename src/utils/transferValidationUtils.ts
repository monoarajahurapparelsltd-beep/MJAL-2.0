import { InterDeptTransfer } from '../types';
import { supabaseDataService } from '../services/supabaseDataService';
import { normalizeSizeName, isAssortedOrMultiSize, extractSizesFromMultiSize } from './sewingCalculationUtils';

export function cleanStyleName(str?: string): string {
  if (!str) return '';
  return str.split('(')[0].trim().toUpperCase();
}

export function matchesStyle(itemStyle?: string, targetStyle?: string): boolean {
  if (!targetStyle) return true;
  if (!itemStyle) return false;
  const s1 = cleanStyleName(itemStyle);
  const s2 = cleanStyleName(targetStyle);
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  const raw1 = itemStyle.trim().toUpperCase();
  const raw2 = targetStyle.trim().toUpperCase();
  return raw1 === raw2 || raw1.includes(raw2) || raw2.includes(raw1);
}

export function matchesPo(itemPo?: string, targetPo?: string): boolean {
  if (!targetPo) return true;
  if (!itemPo) return false;
  const p1 = itemPo.trim().toUpperCase();
  const p2 = targetPo.trim().toUpperCase();
  if (p1 === p2) return true;
  if (p1.includes(p2) || p2.includes(p1)) return true;
  const parts = p1.split(/[,/|]/).map(p => p.trim());
  return parts.includes(p2);
}

export function matchesColour(itemColour?: string, targetColour?: string): boolean {
  if (!targetColour) return true;
  if (!itemColour) return false;
  const c1 = itemColour.split('(')[0].trim().toUpperCase();
  const c2 = targetColour.split('(')[0].trim().toUpperCase();
  if (c1 === c2) return true;
  if (c1.includes(c2) || c2.includes(c1)) return true;
  const parts = itemColour.trim().toUpperCase().split(/[,/|]/).map(c => c.split('(')[0].trim());
  return parts.includes(c2);
}

export interface DepartmentTransferAvailability {
  department: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size: string; // Specific size or 'All Sizes'
  orderQty: number; // Factory Order Quantity (including allowance)
  buyerOrderQty?: number; // Base Buyer Order Quantity
  factoryOrderQty?: number; // Master Factory Order Quantity
  allowanceQty?: number; // Allowance Quantity
  allowancePct?: number; // Allowance Percentage
  actualOutputQty: number; // Department's total produced / received output for this size (For Washing: Third-Party Wash Received Qty)
  alreadyTransferredQty: number; // Total valid transfers issued outwards by this department for this Style/PO/Col/Size
  pendingTransferQty: number; // Available Output Qty = actualOutputQty - alreadyTransferredQty
  availableOutputQty: number; // Same as pendingTransferQty (max allowable to transfer)
  isTransferBlocked: boolean; // True if availableOutputQty <= 0
  totalColourOutputQty: number; // Total output across all sizes for this Style/PO/Colour
  totalColourTransferredQty: number; // Total transferred across all sizes for this Style/PO/Colour
  totalColourPendingQty: number; // Remaining pending across all sizes for this Style/PO/Colour
  unit: string;
  // Extra detailed metrics for Washing -> Finishing flow
  sewingReceiveQty?: number;
  thirdPartyWashSentQty?: number;
  thirdPartyWashReceivedQty?: number;
  isThirdPartyWash?: boolean;
  blockReason?: string;
}

export interface WashingToFinishingSizeItem {
  buyer?: string;
  styleNo: string;
  poNo: string;
  colour: string;
  size: string;
  orderQty: number;
  sewingReceiveQty: number;
  plantSentQty: number;
  thirdPartyWashSentQty: number;
  plantReceivedQty: number;
  thirdPartyWashReceivedQty: number;
  alreadyTransferredQty: number;
  availableTransferQty: number;
  isEligible: boolean;
  status: 'Pending Third-Party Receive' | 'Available for Finishing Transfer' | 'Already Transferred' | 'Completed';
  statusDescription: string;
  blockReason?: string;
}

export interface ValidateTransferItemInput {
  styleNo: string;
  poNo: string;
  colour: string;
  size?: string;
  quantity: number;
}

export interface TransferValidationResult {
  isValid: boolean;
  errors: string[];
  itemValidations: Array<{
    styleNo: string;
    poNo: string;
    colour: string;
    size: string;
    requestedQty: number;
    actualOutputQty: number;
    alreadyTransferredQty: number;
    availableOutputQty: number;
    isValid: boolean;
    error?: string;
  }>;
}

/**
 * Calculates Style, PO, Colour & Size-wise Transfer Availability for a given source department.
 * - If "All Sizes" is transferred for a Style/PO/Colour, the whole Style/PO/Colour output is marked transferred.
 * - Afterwards, selecting ANY individual size of that Style/PO/Colour will show 0 available pending and block further transfer.
 * - Department cannot transfer more quantity than its actual Output Qty.
 * - Once the full Output Qty has been handed over/transferred, no further transfer is allowed.
 * - Already Transferred Qty = Sum of all valid forward transfers from this department.
 * - Transfer Pending Qty = Available Output Qty = Output Qty − Already Transferred Qty.
 */
export function getDepartmentTransferAvailability(
  department: string,
  styleNo: string,
  poNo: string,
  colour: string,
  size: string = 'All Sizes',
  excludeTransferId?: string
): DepartmentTransferAvailability {
  const sStyle = (styleNo || '').trim().toUpperCase();
  const sPo = (poNo || '').trim().toUpperCase();
  const sCol = (colour || '').trim().toUpperCase();
  const targetNormSize = normalizeSizeName(size || 'All Sizes');

  // 1. Fetch Master Order info & Factory Allowance Order Quantities
  const orders = supabaseDataService.getOrders();
  const ord = orders.find(o => matchesStyle(o.styleNo, sStyle));
  const poObj = ord?.purchaseOrders?.find(p => matchesPo(p.poNo, sPo));
  const colObj = poObj?.colours?.find(c => matchesColour(c.colour, sCol));

  const colAllowancePct = Number(colObj?.allowancePct ?? poObj?.allowancePct ?? ord?.allowancePct ?? 0);
  const colBaseOrderQty = colObj?.totalQty || 0;

  let colFactoryQty = Number(colObj?.factoryQty) || 0;
  if (colObj && !colFactoryQty) {
    if (colObj.factorySizeQuantities && Object.keys(colObj.factorySizeQuantities).length > 0) {
      colFactoryQty = Object.values(colObj.factorySizeQuantities).reduce((sum, q) => sum + (Number(q) || 0), 0);
    } else if (colAllowancePct > 0) {
      colFactoryQty = Math.round(colBaseOrderQty * (1 + colAllowancePct / 100));
    } else {
      colFactoryQty = colBaseOrderQty;
    }
  }

  // Effective Factory Order Quantity across color (Allowance inclusive)
  const colTotalOrderQty = colFactoryQty > 0 ? colFactoryQty : colBaseOrderQty;

  let sizeBuyerOrderQty = 0;
  let sizeFactoryOrderQty = 0;

  if (colObj) {
    if (targetNormSize === 'All Sizes') {
      sizeBuyerOrderQty = colBaseOrderQty;
      sizeFactoryOrderQty = colTotalOrderQty;
    } else {
      if (colObj.sizeQuantities && typeof colObj.sizeQuantities === 'object') {
        for (const [k, v] of Object.entries(colObj.sizeQuantities)) {
          if (normalizeSizeName(k) === targetNormSize) {
            sizeBuyerOrderQty = Number(v) || 0;
            break;
          }
        }
      }
      if (colObj.factorySizeQuantities && typeof colObj.factorySizeQuantities === 'object') {
        for (const [k, v] of Object.entries(colObj.factorySizeQuantities)) {
          if (normalizeSizeName(k) === targetNormSize) {
            sizeFactoryOrderQty = Number(v) || 0;
            break;
          }
        }
      }
      if (!sizeFactoryOrderQty && sizeBuyerOrderQty > 0) {
        sizeFactoryOrderQty = colAllowancePct > 0
          ? sizeBuyerOrderQty + Math.round(sizeBuyerOrderQty * (colAllowancePct / 100))
          : sizeBuyerOrderQty;
      }
    }
  }

  // Use Factory Order Qty as the effective order qty for all department transfers and challans
  const sizeOrderQty = sizeFactoryOrderQty > 0 ? sizeFactoryOrderQty : sizeBuyerOrderQty;

  // 2. Fetch Actual Output Qty for the Department
  const deptNormalized = (department || '').trim().toLowerCase();
  let totalColourOutputQty = 0;
  let sizeActualOutputQty = 0;
  let inboundTotal = 0;
  let totalWashSent = 0;
  let exactSizeSentQty = 0;
  let isStyleWash = ord?.isWashGarment === true || !!ord?.washType;

  if (deptNormalized === 'cutting') {
    const cuts = supabaseDataService.getCuttingEntries().filter(
      c => matchesStyle(c.styleNo, sStyle) &&
           matchesPo(c.poNo, sPo) &&
           matchesColour(c.colour, sCol)
    );

    totalColourOutputQty = cuts.reduce((sum, c) => sum + (c.cutQty || 0), 0);

    if (targetNormSize === 'All Sizes') {
      sizeActualOutputQty = totalColourOutputQty;
    } else {
      if (sizeOrderQty <= 0) {
        sizeActualOutputQty = 0;
      } else {
        const exactCuts = cuts.filter(c => normalizeSizeName(c.size) === targetNormSize);
        const exactQty = exactCuts.reduce((sum, c) => sum + (c.cutQty || 0), 0);
        const allSizesCuts = cuts.filter(c => !c.size || normalizeSizeName(c.size) === 'All Sizes');
        const allSizesTotal = allSizesCuts.reduce((sum, c) => sum + (c.cutQty || 0), 0);

        const proportion = colTotalOrderQty > 0 ? (sizeOrderQty / colTotalOrderQty) : 0;
        sizeActualOutputQty = exactQty + (allSizesTotal > 0 && proportion > 0 ? Math.round(allSizesTotal * proportion) : (exactQty === 0 && proportion > 0 ? Math.round(totalColourOutputQty * proportion) : 0));
      }
    }
  } else if (deptNormalized === 'sewing') {
    const sews = supabaseDataService.getSewingProduction().filter(
      s => matchesStyle(s.styleNo, sStyle) &&
           matchesPo(s.poNo, sPo) &&
           matchesColour(s.colour, sCol)
    );

    totalColourOutputQty = sews.reduce((sum, s) => sum + (s.totalOutput || 0), 0);

    if (targetNormSize === 'All Sizes') {
      sizeActualOutputQty = totalColourOutputQty;
    } else {
      if (sizeOrderQty <= 0) {
        sizeActualOutputQty = 0;
      } else {
        const exactSews = sews.filter(s => normalizeSizeName(s.size) === targetNormSize);
        const exactQty = exactSews.reduce((sum, s) => sum + (s.totalOutput || 0), 0);
        const allSizesSews = sews.filter(s => !s.size || normalizeSizeName(s.size) === 'All Sizes');
        const allSizesTotal = allSizesSews.reduce((sum, s) => sum + (s.totalOutput || 0), 0);

        const proportion = colTotalOrderQty > 0 ? (sizeOrderQty / colTotalOrderQty) : 0;
        sizeActualOutputQty = exactQty + (allSizesTotal > 0 && proportion > 0 ? Math.round(allSizesTotal * proportion) : (exactQty === 0 && proportion > 0 ? Math.round(totalColourOutputQty * proportion) : 0));
      }
    }
  } else if (deptNormalized === 'washing') {
    // 1. Inbound received transfers from Sewing floor into Washing
    const allTransfers = supabaseDataService.getTransfers();
    const inboundTransfers = allTransfers.filter(
      t => (t.toDepartment || '').trim().toLowerCase() === 'washing' &&
           t.transferType !== 'Return' &&
           t.status !== 'Rejected' &&
           (
             (matchesStyle(t.styleNo, sStyle) && matchesPo(t.poNo, sPo) && matchesColour(t.colour, sCol)) ||
             (t.items && t.items.some(it => matchesStyle(it.styleNo, sStyle) && matchesPo(it.poNo, sPo) && matchesColour(it.colour, sCol)))
           )
    );

    let exactInboundSizeQty = 0;
    let inboundSizeFound = false;

    inboundTransfers.forEach(t => {
      if (t.items && t.items.length > 0) {
        const matchingItems = t.items.filter(it =>
          matchesStyle(it.styleNo || t.styleNo, sStyle) &&
          matchesPo(it.poNo || t.poNo, sPo) &&
          matchesColour(it.colour || t.colour, sCol)
        );

        matchingItems.forEach(it => {
          const itQty = it.quantity || 0;
          inboundTotal += itQty;
          const itNorm = normalizeSizeName(it.size);
          if (itNorm === targetNormSize) {
            exactInboundSizeQty += itQty;
            inboundSizeFound = true;
          }
        });
      } else {
        const tColClean = (t.colour || '').trim().toUpperCase();
        const isMultiCol = tColClean.includes(',') || tColClean.includes('/') || tColClean === 'ALL COLOURS' || !tColClean;
        const tQty = t.quantity || 0;

        if (isMultiCol) {
          const poTotalOrder = poObj?.totalPoQty || poObj?.colours?.reduce((sum, c) => sum + (c.totalQty || 0), 0) || colTotalOrderQty;
          const colRatio = poTotalOrder > 0 ? (colTotalOrderQty / poTotalOrder) : 1;
          const colInboundQty = Math.round(tQty * colRatio);
          inboundTotal += colTotalOrderQty > 0 ? Math.min(colInboundQty, colTotalOrderQty) : colInboundQty;
        } else {
          inboundTotal += colTotalOrderQty > 0 ? Math.min(tQty, colTotalOrderQty) : tQty;
        }
      }
    });

    // 2. Outward plant dispatch & Inward returned records from 3rd-party washing plants
    const rawWashes = supabaseDataService.getWashingRecords();
    const washes = rawWashes.filter(
      w => matchesStyle(w.styleNo, sStyle) &&
           matchesPo(w.poNo, sPo) &&
           matchesColour(w.colour, sCol)
    );

    let totalWashReceived = 0;
    let exactSizeReceivedQty = 0;
    let sizeFoundInWashItems = false;

    washes.forEach(w => {
      const sQty = w.sentQty || 0;
      const rQty = (w.receivedQty !== undefined && w.receivedQty > 0)
        ? w.receivedQty
        : (w.status === 'Received' || w.status === 'Completed' ? (w.sentQty || 0) : 0);

      totalWashSent += sQty;

      let rawItems: any[] | undefined = w.items;
      if ((!rawItems || rawItems.length === 0) && w.remarks && typeof w.remarks === 'string' && w.remarks.includes('__ITEMS_JSON__:')) {
        try {
          const parts = w.remarks.split('__ITEMS_JSON__:');
          const parsed = JSON.parse(parts[1]?.trim() || '[]');
          if (Array.isArray(parsed) && parsed.length > 0) rawItems = parsed;
        } catch {}
      }

      if (rawItems && Array.isArray(rawItems) && rawItems.length > 0) {
        const matchingItems = rawItems.filter(si =>
          matchesStyle(si.styleNo || w.styleNo, sStyle) &&
          matchesPo(si.poNo || w.poNo, sPo) &&
          matchesColour(si.colour || w.colour, sCol)
        );

        if (matchingItems.length > 0) {
          matchingItems.forEach(si => {
            const itemSentQty = si.sentQty || 0;
            const itemRecQty = (si.receivedQty !== undefined && si.receivedQty > 0)
              ? si.receivedQty
              : (si.goodReceivedQty !== undefined && si.goodReceivedQty > 0
                  ? si.goodReceivedQty
                  : (w.status === 'Received' || w.status === 'Completed' ? (si.sentQty || 0) : 0));

            totalWashReceived += itemRecQty;

            const siNorm = normalizeSizeName(si.size);
            if (siNorm === targetNormSize) {
              exactSizeSentQty += itemSentQty;
              exactSizeReceivedQty += itemRecQty;
              sizeFoundInWashItems = true;
            }
          });
        }
      } else {
        const wColClean = (w.colour || '').trim().toUpperCase();
        const isMultiColRecord = wColClean.includes(',') || wColClean.includes('/') || wColClean === 'ALL COLOURS' || !wColClean;

        if (isMultiColRecord) {
          const poTotalOrder = poObj?.totalPoQty || poObj?.colours?.reduce((sum, c) => sum + (c.totalQty || 0), 0) || colTotalOrderQty;
          const colRatio = poTotalOrder > 0 ? (colTotalOrderQty / poTotalOrder) : 1;
          const colWashQty = Math.round(rQty * colRatio);
          totalWashReceived += colTotalOrderQty > 0 ? Math.min(colWashQty, colTotalOrderQty) : colWashQty;
        } else {
          totalWashReceived += colTotalOrderQty > 0 ? Math.min(rQty, colTotalOrderQty) : rQty;
        }
      }
    });

    // Check if this style is a wash garment or requires third-party washing
    isStyleWash = ord?.isWashGarment === true || !!ord?.washType || washes.length > 0 || inboundTotal > 0;

    // CRITICAL USER MANDATE:
    // "Washing -> Finishing Transfer is NOT allowed until the corresponding Third-Party Washing quantity has actually been RECEIVED back into the system."
    // "Available Finishing Transfer Qty = Third-Party Wash Received Qty (for this size) - Already Transferred to Finishing Qty (for this size)"
    // "If: Third-Party Wash Received = 0 pcs, Then: Washing -> Finishing Transfer = NOT ALLOWED (0 pcs)"
    // NEVER use Washing Receive as Finishing Transfer eligibility!

    if (isStyleWash || washes.length > 0) {
      // STRICT THIRD-PARTY WASH FLOW:
      // Output is EXCLUSIVELY what was received back from 3rd-party wash plant.
      totalColourOutputQty = totalWashReceived;

      if (targetNormSize === 'All Sizes') {
        sizeActualOutputQty = totalColourOutputQty;
      } else {
        if (sizeOrderQty <= 0) {
          sizeActualOutputQty = 0;
        } else if (sizeFoundInWashItems) {
          sizeActualOutputQty = exactSizeReceivedQty;
        } else if (totalWashReceived > 0 && colTotalOrderQty > 0) {
          // Proportional distribution if washed as bulk/assorted
          const proportion = sizeOrderQty / colTotalOrderQty;
          sizeActualOutputQty = Math.round(totalWashReceived * proportion);
        } else {
          sizeActualOutputQty = 0;
        }
      }
    } else {
      // Non-Third-Party / Direct In-House Washing Flow
      if (targetNormSize === 'All Sizes') {
        totalColourOutputQty = totalWashReceived > 0 ? totalWashReceived : inboundTotal;
        sizeActualOutputQty = totalColourOutputQty;
      } else {
        if (sizeOrderQty <= 0) {
          sizeActualOutputQty = 0;
          totalColourOutputQty = totalWashReceived > 0 ? totalWashReceived : inboundTotal;
        } else if (totalWashReceived > 0) {
          totalColourOutputQty = totalWashReceived;
          const proportion = colTotalOrderQty > 0 ? (sizeOrderQty / colTotalOrderQty) : 0;
          sizeActualOutputQty = sizeFoundInWashItems ? exactSizeReceivedQty : Math.round(totalColourOutputQty * proportion);
        } else {
          totalColourOutputQty = inboundTotal;
          const proportion = colTotalOrderQty > 0 ? (sizeOrderQty / colTotalOrderQty) : 0;
          sizeActualOutputQty = inboundSizeFound ? exactInboundSizeQty : Math.round(inboundTotal * proportion);
        }
      }
    }
  } else if (deptNormalized === 'finishing') {
    const fins = supabaseDataService.getFinishingRecords().filter(
      f => matchesStyle(f.styleNo, sStyle) &&
           matchesPo(f.poNo, sPo) &&
           matchesColour(f.colour, sCol)
    );

    totalColourOutputQty = fins.reduce((sum, f) => sum + (f.finishedQty || f.packedQty || 0), 0);

    if (targetNormSize === 'All Sizes') {
      sizeActualOutputQty = totalColourOutputQty;
    } else {
      if (sizeOrderQty <= 0) {
        sizeActualOutputQty = 0;
      } else {
        const exactFins = fins.filter(f => normalizeSizeName(f.size) === targetNormSize);
        const exactQty = exactFins.reduce((sum, f) => sum + (f.finishedQty || f.packedQty || 0), 0);
        const allSizesFins = fins.filter(f => !f.size || normalizeSizeName(f.size) === 'All Sizes');
        const allSizesTotal = allSizesFins.reduce((sum, f) => sum + (f.finishedQty || f.packedQty || 0), 0);

        const proportion = colTotalOrderQty > 0 ? (sizeOrderQty / colTotalOrderQty) : 0;
        sizeActualOutputQty = exactQty + (allSizesTotal > 0 && proportion > 0 ? Math.round(allSizesTotal * proportion) : (exactQty === 0 && proportion > 0 ? Math.round(totalColourOutputQty * proportion) : 0));
      }
    }
  } else if (deptNormalized === 'packing') {
    const packs = supabaseDataService.getPackingRecords().filter(
      p => matchesStyle(p.styleNo, sStyle) &&
           matchesPo(p.poNo, sPo) &&
           matchesColour(p.colour, sCol)
    );

    totalColourOutputQty = packs.reduce((sum, p) => sum + (p.packedQty || 0), 0);

    if (targetNormSize === 'All Sizes') {
      sizeActualOutputQty = totalColourOutputQty;
    } else {
      if (sizeOrderQty <= 0) {
        sizeActualOutputQty = 0;
      } else {
        let szPack = 0;
        let breakdownFound = false;
        packs.forEach(p => {
          if (p.cartons && p.cartons.length > 0) {
            p.cartons.forEach(ctn => {
              if (ctn.sizeBreakdown) {
                for (const [szK, val] of Object.entries(ctn.sizeBreakdown)) {
                  if (normalizeSizeName(szK) === targetNormSize) {
                    szPack += Number(val) || 0;
                    breakdownFound = true;
                  }
                }
              }
            });
          }
        });

        if (!breakdownFound) {
          const proportion = colTotalOrderQty > 0 ? (sizeOrderQty / colTotalOrderQty) : 0;
          szPack = proportion > 0 ? Math.round(totalColourOutputQty * proportion) : 0;
        }
        sizeActualOutputQty = szPack;
      }
    }
  } else {
    // Generic fallback for Store, Shipment, etc.
    const progress = supabaseDataService.getStylePoColourProgress(styleNo, poNo, colour);
    totalColourOutputQty = progress.orderQty;
    sizeActualOutputQty = targetNormSize === 'All Sizes' ? totalColourOutputQty : sizeOrderQty;
  }

  // CRITICAL USER MANDATE:
  // "order qty er besi available qty kno section ey hobe na 2 size er actual order qty er besi available qty hobe na"
  // (Available/Output quantity can NEVER exceed the actual order quantity in any section, nor can any size exceed its size order quantity).
  if (colTotalOrderQty > 0) {
    totalColourOutputQty = Math.min(totalColourOutputQty, colTotalOrderQty);
  }

  if (sizeOrderQty > 0) {
    sizeActualOutputQty = Math.min(sizeActualOutputQty, sizeOrderQty);
  } else if (targetNormSize === 'All Sizes' && colTotalOrderQty > 0) {
    sizeActualOutputQty = Math.min(sizeActualOutputQty, colTotalOrderQty);
  }

  // 3. Compute Already Transferred Qty
  // All forward transfers originating from this department (excluding Rejected and Return transfers)
  const transfers = supabaseDataService.getTransfers().filter(
    t => (t.fromDepartment || '').trim().toLowerCase() === deptNormalized &&
         t.transferType !== 'Return' &&
         t.status !== 'Rejected' &&
         (!excludeTransferId || t.id !== excludeTransferId)
  );

  let totalColourTransferredQty = 0;
  let sizeAlreadyTransferredQty = 0;

  for (const t of transfers) {
    if (t.items && t.items.length > 0) {
      for (const it of t.items) {
        const itStyle = it.styleNo || t.styleNo || '';
        const itPo = it.poNo || t.poNo || '';
        const itCol = it.colour || t.colour || '';

        if (matchesStyle(itStyle, sStyle) && matchesPo(itPo, sPo) && matchesColour(itCol, sCol)) {
          const qty = it.quantity || 0;
          totalColourTransferredQty += qty;

          const itNormSz = normalizeSizeName(it.size);
          if (targetNormSize === 'All Sizes') {
            sizeAlreadyTransferredQty += qty;
          } else if (itNormSz === targetNormSize) {
            sizeAlreadyTransferredQty += qty;
          } else if (itNormSz === 'All Sizes') {
            // Attribute proportional amount of All Sizes transfers to this specific size
            const proportion = colTotalOrderQty > 0 ? (sizeOrderQty / colTotalOrderQty) : 0;
            sizeAlreadyTransferredQty += Math.round(qty * proportion);
          }
        }
      }
    } else {
      const tStyle = t.styleNo || '';
      const tPo = t.poNo || '';
      const tCol = t.colour || '';

      if (matchesStyle(tStyle, sStyle) && matchesPo(tPo, sPo) && matchesColour(tCol, sCol)) {
        const qty = t.quantity || 0;
        totalColourTransferredQty += qty;

        const tNormSz = normalizeSizeName(t.size);
        if (targetNormSize === 'All Sizes') {
          sizeAlreadyTransferredQty += qty;
        } else if (tNormSz === targetNormSize) {
          sizeAlreadyTransferredQty += qty;
        } else if (tNormSz === 'All Sizes') {
          const proportion = colTotalOrderQty > 0 ? (sizeOrderQty / colTotalOrderQty) : 0;
          sizeAlreadyTransferredQty += Math.round(qty * proportion);
        }
      }
    }
  }

  // 4. Calculate Pending Transfer Qty & Available Output Qty
  // Total colour pending remaining
  let totalColourPendingQty = Math.max(0, totalColourOutputQty - totalColourTransferredQty);
  if (colTotalOrderQty > 0) {
    totalColourPendingQty = Math.min(totalColourPendingQty, Math.max(0, colTotalOrderQty - totalColourTransferredQty));
  }

  // If the entire Style/PO/Colour output has been transferred, ANY size (or All Sizes) has 0 pending
  let availableOutputQty = 0;
  let alreadyTransferredQty = sizeAlreadyTransferredQty;
  let actualOutputQty = sizeActualOutputQty;

  if (targetNormSize === 'All Sizes') {
    actualOutputQty = totalColourOutputQty;
    alreadyTransferredQty = totalColourTransferredQty;
    availableOutputQty = totalColourPendingQty;
    if (colTotalOrderQty > 0) {
      availableOutputQty = Math.min(availableOutputQty, Math.max(0, colTotalOrderQty - alreadyTransferredQty));
    }
  } else {
    // If entire colour output is already transferred out (e.g. by 'All Sizes' or previous items)
    if (totalColourPendingQty <= 0) {
      alreadyTransferredQty = sizeActualOutputQty > 0 ? sizeActualOutputQty : sizeAlreadyTransferredQty;
      availableOutputQty = 0;
    } else {
      const sizePending = Math.max(0, sizeActualOutputQty - sizeAlreadyTransferredQty);
      availableOutputQty = Math.min(sizePending, totalColourPendingQty);
      if (sizeOrderQty > 0) {
        availableOutputQty = Math.min(availableOutputQty, Math.max(0, sizeOrderQty - sizeAlreadyTransferredQty));
      }
    }
  }

  const pendingTransferQty = availableOutputQty;
  const isTransferBlocked = availableOutputQty <= 0;

  let blockReason: string | undefined;
  if (deptNormalized === 'washing') {
    if (actualOutputQty <= 0) {
      blockReason = 'Pending Third-Party Receive: 0 pcs received from 3rd-party wash plant. Washing → Finishing Transfer is blocked until goods are received back from the plant.';
    } else if (availableOutputQty <= 0) {
      blockReason = 'All 3rd-Party Wash Received garments for this size have already been transferred to Finishing.';
    }
  }

  const effectiveOrderQty = targetNormSize === 'All Sizes' ? colTotalOrderQty : sizeOrderQty;
  const effectiveBuyerOrderQty = targetNormSize === 'All Sizes' ? colBaseOrderQty : sizeBuyerOrderQty;

  return {
    department,
    styleNo,
    poNo,
    colour,
    size,
    orderQty: effectiveOrderQty,
    buyerOrderQty: effectiveBuyerOrderQty,
    factoryOrderQty: effectiveOrderQty,
    allowanceQty: Math.max(0, effectiveOrderQty - effectiveBuyerOrderQty),
    allowancePct: colAllowancePct,
    actualOutputQty,
    alreadyTransferredQty,
    pendingTransferQty,
    availableOutputQty,
    isTransferBlocked,
    totalColourOutputQty,
    totalColourTransferredQty,
    totalColourPendingQty,
    unit: 'pcs',
    sewingReceiveQty: inboundTotal,
    thirdPartyWashSentQty: targetNormSize === 'All Sizes' ? totalWashSent : exactSizeSentQty,
    thirdPartyWashReceivedQty: actualOutputQty,
    isThirdPartyWash: isStyleWash,
    blockReason
  };
}

/**
 * Returns a comprehensive, size-by-size breakdown of Washing Receive, 3P Wash Sent,
 * 3P Wash Received, Already Transferred to Finishing, and Available for Finishing Transfer.
 */
export function getWashingToFinishingSizeBreakdown(
  styleNo: string,
  poNo: string,
  colour: string
): WashingToFinishingSizeItem[] {
  const sizesData = supabaseDataService.getSizes(styleNo, poNo, colour);
  const sizeKeys = (sizesData.sizes && sizesData.sizes.length > 0 && sizesData.sizes[0] !== 'All Sizes')
    ? sizesData.sizes
    : Object.keys(sizesData.sizeQuantities || {});

  const listToProcess = sizeKeys.length > 0 ? sizeKeys : ['All Sizes'];

  // Outward wash records for this style
  const rawWashes = supabaseDataService.getWashingRecords();
  const washes = rawWashes.filter(
    w => matchesStyle(w.styleNo, styleNo) &&
         matchesPo(w.poNo, poNo) &&
         matchesColour(w.colour, colour)
  );

  // Inbound sewing transfers
  const allTransfers = supabaseDataService.getTransfers();
  const inboundTransfers = allTransfers.filter(
    t => (t.toDepartment || '').trim().toLowerCase() === 'washing' &&
         t.transferType !== 'Return' &&
         t.status !== 'Rejected' &&
         (
           matchesStyle(t.styleNo, styleNo) && matchesPo(t.poNo, poNo) && matchesColour(t.colour, colour) ||
           (t.items && t.items.some(it => matchesStyle(it.styleNo, styleNo) && matchesPo(it.poNo, poNo) && matchesColour(it.colour, colour)))
         )
  );

  return listToProcess.map(sz => {
    const avail = getDepartmentTransferAvailability('Washing', styleNo, poNo, colour, sz);
    const orderQty = avail.orderQty;
    const plantReceivedQty = avail.actualOutputQty; // In washing, actualOutputQty is strictly 3P wash received
    const alreadyTransferredQty = avail.alreadyTransferredQty;
    const availableTransferQty = avail.availableOutputQty;

    // Calculate Inbound Sewing Receive for this specific size
    let sewingReceiveQty = 0;
    inboundTransfers.forEach(t => {
      if (t.items && t.items.length > 0) {
        t.items.forEach(it => {
          if (matchesStyle(it.styleNo || t.styleNo, styleNo) &&
              matchesPo(it.poNo || t.poNo, poNo) &&
              matchesColour(it.colour || t.colour, colour)) {
            if (normalizeSizeName(it.size) === normalizeSizeName(sz) || sz === 'All Sizes') {
              sewingReceiveQty += it.quantity || 0;
            }
          }
        });
      } else {
        const prop = avail.orderQty > 0 && sizesData.totalQty > 0 ? (avail.orderQty / sizesData.totalQty) : 1;
        sewingReceiveQty += Math.round((t.quantity || 0) * prop);
      }
    });

    // Calculate Plant Sent for this specific size
    let plantSentQty = 0;
    washes.forEach(w => {
      let rawItems: any[] | undefined = w.items;
      if ((!rawItems || rawItems.length === 0) && w.remarks && typeof w.remarks === 'string' && w.remarks.includes('__ITEMS_JSON__:')) {
        try {
          const parts = w.remarks.split('__ITEMS_JSON__:');
          const parsed = JSON.parse(parts[1]?.trim() || '[]');
          if (Array.isArray(parsed) && parsed.length > 0) rawItems = parsed;
        } catch {}
      }

      if (rawItems && Array.isArray(rawItems) && rawItems.length > 0) {
        rawItems.forEach(si => {
          if (matchesStyle(si.styleNo || w.styleNo, styleNo) &&
              matchesPo(si.poNo || w.poNo, poNo) &&
              matchesColour(si.colour || w.colour, colour)) {
            if (normalizeSizeName(si.size) === normalizeSizeName(sz) || sz === 'All Sizes') {
              plantSentQty += si.sentQty || 0;
            }
          }
        });
      } else {
        const prop = avail.orderQty > 0 && sizesData.totalQty > 0 ? (avail.orderQty / sizesData.totalQty) : 1;
        plantSentQty += Math.round((w.sentQty || 0) * prop);
      }
    });

    let status: 'Pending Third-Party Receive' | 'Available for Finishing Transfer' | 'Already Transferred' | 'Completed' = 'Pending Third-Party Receive';
    let statusDescription = 'Pending Third-Party Receive';

    if (plantReceivedQty === 0) {
      status = 'Pending Third-Party Receive';
      statusDescription = plantSentQty > 0
        ? `${plantSentQty.toLocaleString()} pcs sent to plant, awaiting return receive`
        : 'Pending Third-Party Receive (0 pcs received)';
    } else if (availableTransferQty > 0) {
      status = 'Available for Finishing Transfer';
      statusDescription = `${availableTransferQty.toLocaleString()} pcs available for Finishing Transfer`;
    } else if (alreadyTransferredQty >= plantReceivedQty && plantReceivedQty > 0) {
      status = 'Already Transferred';
      statusDescription = `All ${plantReceivedQty.toLocaleString()} pcs already transferred to Finishing`;
    }

    const isEligible = plantReceivedQty > 0 && availableTransferQty > 0;

    return {
      styleNo,
      poNo,
      colour,
      size: sz,
      orderQty,
      sewingReceiveQty,
      plantSentQty,
      thirdPartyWashSentQty: plantSentQty,
      plantReceivedQty,
      thirdPartyWashReceivedQty: plantReceivedQty,
      alreadyTransferredQty,
      availableTransferQty,
      isEligible,
      status,
      statusDescription
    };
  });
}

/**
 * Validates an entire transfer payload (single or multi-item) against the Department's available output.
 * Blocks any transfer that exceeds available/pending output qty.
 */
export function validateDepartmentTransfer(
  fromDepartment: string,
  items: ValidateTransferItemInput[],
  transferType: 'Transfer' | 'Return' = 'Transfer',
  excludeTransferId?: string
): TransferValidationResult {
  // Returns are reverse flows (reworks/rejects) so they are governed by inbound goods rather than forward output limits
  if (transferType === 'Return') {
    return {
      isValid: true,
      errors: [],
      itemValidations: items.map(it => ({
        styleNo: it.styleNo,
        poNo: it.poNo,
        colour: it.colour,
        size: it.size || 'All Sizes',
        requestedQty: it.quantity,
        actualOutputQty: 999999,
        alreadyTransferredQty: 0,
        availableOutputQty: 999999,
        isValid: true
      }))
    };
  }

  const isWashing = (fromDepartment || '').trim().toLowerCase() === 'washing';
  const errors: string[] = [];
  const itemValidations = items.map(item => {
    const sz = item.size || 'All Sizes';
    const avail = getDepartmentTransferAvailability(
      fromDepartment,
      item.styleNo,
      item.poNo,
      item.colour,
      sz,
      excludeTransferId
    );

    let isValid = true;
    let error: string | undefined;

    if (avail.actualOutputQty <= 0) {
      isValid = false;
      if (isWashing) {
        error = `Cannot transfer to Finishing: 0 pcs received from Third-Party Wash Plant for Style "${item.styleNo}" (${item.colour} - ${sz}). Garments must be received back from the wash plant first.`;
      } else {
        error = `No Output Qty available in ${fromDepartment} for Style "${item.styleNo}", PO "${item.poNo}", Colour "${item.colour}", Size "${sz}" (Actual Output: 0 pcs). Cannot initiate transfer.`;
      }
    } else if (item.quantity > avail.availableOutputQty) {
      isValid = false;
      if (avail.availableOutputQty <= 0) {
        if (isWashing) {
          error = `Full Third-Party Wash Received quantity (${avail.actualOutputQty.toLocaleString()} pcs) has already been transferred to Finishing for Style "${item.styleNo}" (${item.colour} - ${sz}). No further transfer is available.`;
        } else {
          error = `Full Output Qty (${avail.actualOutputQty.toLocaleString()} pcs) of ${fromDepartment} has already been transferred for Style "${item.styleNo}" (${item.colour} - ${sz}). No further transfer allowed.`;
        }
      } else {
        if (isWashing) {
          error = `Transfer quantity cannot exceed Third-Party Wash Received available quantity (${avail.availableOutputQty.toLocaleString()} pcs) for Style "${item.styleNo}" (${item.colour} - ${sz}). [3P Wash Received: ${avail.actualOutputQty.toLocaleString()} pcs, Already Transferred: ${avail.alreadyTransferredQty.toLocaleString()} pcs].`;
        } else {
          error = `Transfer Qty (${item.quantity.toLocaleString()} pcs) exceeds Available Output Qty (${avail.availableOutputQty.toLocaleString()} pcs) in ${fromDepartment} for Style "${item.styleNo}" (${item.colour} - ${sz}). [Actual Output: ${avail.actualOutputQty.toLocaleString()} pcs, Already Transferred: ${avail.alreadyTransferredQty.toLocaleString()} pcs].`;
        }
      }
    }

    if (!isValid && error) {
      errors.push(error);
    }

    return {
      styleNo: item.styleNo,
      poNo: item.poNo,
      colour: item.colour,
      size: sz,
      requestedQty: item.quantity,
      actualOutputQty: avail.actualOutputQty,
      alreadyTransferredQty: avail.alreadyTransferredQty,
      availableOutputQty: avail.availableOutputQty,
      isValid,
      error
    };
  });

  return {
    isValid: errors.length === 0,
    errors,
    itemValidations
  };
}
