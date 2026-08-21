import { CuttingEntry, InterDeptTransfer } from '../types';
import { normalizeSizeName, isAssortedOrMultiSize, extractSizesFromMultiSize } from './sewingCalculationUtils';

export interface CuttingRowSewingStats {
  sewingSent: number;
  inputBalance: number;
  transferredPercent: number;
  isFullyTransferred: boolean;
}

/**
 * Calculates line-by-line exact Sewing Sent and Input Balance for cutting entries.
 * Accurately matches Cutting -> Sewing transfers (including itemized and All Sizes transfers)
 * across entries matching (styleNo, poNo, colour, size).
 */
export function calculateCuttingEntriesSewingStats(
  entries: CuttingEntry[],
  transfers: InterDeptTransfer[]
): Map<string, CuttingRowSewingStats> {
  const resultMap = new Map<string, CuttingRowSewingStats>();

  // Filter transfers from Cutting to Sewing (both Dispatched, In-Transit, and Received)
  const cutToSewTransfers = transfers.filter(
    t => t.fromDepartment === 'Cutting' && t.toDepartment === 'Sewing'
  );

  // Group cutting entries by Style, PO, Colour
  const spcGroups = new Map<string, CuttingEntry[]>();

  for (const entry of entries) {
    const sStyle = (entry.styleNo || '').trim().toUpperCase();
    const sPo = (entry.poNo || '').trim().toUpperCase();
    const sCol = (entry.colour || '').trim().toUpperCase();
    const groupKey = `${sStyle}|${sPo}|${sCol}`;

    if (!spcGroups.has(groupKey)) {
      spcGroups.set(groupKey, []);
    }
    spcGroups.get(groupKey)!.push(entry);
  }

  // Process each Style-PO-Colour group
  for (const [groupKey, groupEntries] of spcGroups.entries()) {
    const [styleNo, poNo, colour] = groupKey.split('|');

    // Find all transfers matching this Style, PO, Colour
    const matchingTransfers = cutToSewTransfers.filter(t => {
      const matchStyle =
        (t.styleNo || '').trim().toUpperCase() === styleNo ||
        (t.items && t.items.some(it => (it.styleNo || '').trim().toUpperCase() === styleNo));

      const matchPo =
        !t.poNo ||
        !poNo ||
        (t.poNo || '').trim().toUpperCase() === poNo ||
        (t.items && t.items.some(it => (it.poNo || '').trim().toUpperCase() === poNo));

      const matchCol =
        !t.colour ||
        !colour ||
        (t.colour || '').trim().toUpperCase() === colour ||
        (t.items && t.items.some(it => (it.colour || '').trim().toUpperCase() === colour));

      return matchStyle && matchPo && matchCol;
    });

    // Map of transferred quantity by normalized size
    const transferredBySize = new Map<string, number>();
    let allSizesPool = 0;

    const processTransferItem = (rawSize: string | undefined | null, itQty: number) => {
      if (itQty <= 0) return;
      const isMulti = isAssortedOrMultiSize(rawSize);
      const normSz = normalizeSizeName(rawSize);

      if (!isMulti) {
        const curr = transferredBySize.get(normSz) || 0;
        transferredBySize.set(normSz, curr + itQty);
        return;
      }

      // If multi-size (e.g. "30, 32, 34, 36" or "All Sizes")
      const subSizes = extractSizesFromMultiSize(rawSize || '');
      if (subSizes.length > 0) {
        // Find matching entries for these sub-sizes in groupEntries
        const matchingSubEntries = groupEntries.filter(e => subSizes.includes(normalizeSizeName(e.size)));
        const totalSubTarget = matchingSubEntries.reduce(
          (sum, e) => sum + (e.cutQty > 0 ? e.cutQty : (e.orderQty || 0)),
          0
        );

        if (matchingSubEntries.length > 0 && totalSubTarget > 0) {
          let allocated = 0;
          matchingSubEntries.forEach((e, idx) => {
            const eNorm = normalizeSizeName(e.size);
            const targetQty = e.cutQty > 0 ? e.cutQty : (e.orderQty || 0);
            let portion: number;
            if (idx === matchingSubEntries.length - 1) {
              portion = Math.max(0, itQty - allocated);
            } else {
              portion = Math.round((itQty * targetQty) / totalSubTarget);
              allocated += portion;
            }
            const curr = transferredBySize.get(eNorm) || 0;
            transferredBySize.set(eNorm, curr + portion);
          });
          return;
        }
      }

      allSizesPool += itQty;
    };

    for (const t of matchingTransfers) {
      if (t.items && t.items.length > 0) {
        for (const it of t.items) {
          const itStyle = (it.styleNo || t.styleNo || '').trim().toUpperCase();
          const itPo = (it.poNo || t.poNo || '').trim().toUpperCase();
          const itCol = (it.colour || t.colour || '').trim().toUpperCase();

          if (itStyle !== styleNo || (poNo && itPo !== poNo) || (colour && itCol !== colour)) {
            continue;
          }

          processTransferItem(it.size, Number(it.quantity) || 0);
        }
      } else {
        processTransferItem(t.size, Number(t.quantity) || 0);
      }
    }

    // Now calculate for each entry in this group
    for (const entry of groupEntries) {
      const normSz = normalizeSizeName(entry.size);
      const targetQty = entry.cutQty > 0 ? entry.cutQty : (entry.orderQty || 0);

      // Direct size match
      let availableSent = transferredBySize.get(normSz) || 0;

      // If direct match didn't fully cover and allSizesPool has remainder
      if (availableSent < targetQty && allSizesPool > 0) {
        const deficit = targetQty - availableSent;
        const takeFromAll = Math.min(deficit, allSizesPool);
        availableSent += takeFromAll;
        allSizesPool -= takeFromAll;
      } else if (normSz === 'All Sizes' && allSizesPool > 0) {
        availableSent += allSizesPool;
        allSizesPool = 0;
      }

      const allocatedSent = Math.min(targetQty > 0 ? targetQty : availableSent, availableSent);
      const balance = Math.max(0, targetQty - allocatedSent);
      const percent = targetQty > 0 ? Math.min(100, Math.round((allocatedSent / targetQty) * 100)) : 0;
      const isFullyTransferred = targetQty > 0 && allocatedSent >= targetQty;

      resultMap.set(entry.id, {
        sewingSent: allocatedSent,
        inputBalance: balance,
        transferredPercent: percent,
        isFullyTransferred,
      });
    }
  }

  // Any entry not processed gets default 0 sent
  for (const entry of entries) {
    if (!resultMap.has(entry.id)) {
      const targetQty = entry.cutQty > 0 ? entry.cutQty : (entry.orderQty || 0);
      resultMap.set(entry.id, {
        sewingSent: 0,
        inputBalance: targetQty,
        transferredPercent: 0,
        isFullyTransferred: false,
      });
    }
  }

  return resultMap;
}

